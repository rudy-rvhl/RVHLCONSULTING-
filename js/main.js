/* ============================================================
   RVHL CONSULTING — cinematic scroll engine
   Lenis smooth scroll + GSAP ScrollTrigger + canvas frame scrub
   ============================================================ */
(function () {
  'use strict';

  var docEl = document.documentElement;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasLibs = typeof Lenis !== 'undefined' && typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';

  if (reducedMotion || !hasLibs) {
    // Leave the static, fully-readable version in place.
    return;
  }
  docEl.classList.remove('no-cinema');

  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Lenis smooth scroll ---------- */
  var lenis = new Lenis({
    lerp: 0.09,
    smoothWheel: true,
    syncTouch: false
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
  gsap.ticker.lagSmoothing(0);

  // Anchor links scroll through Lenis
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      var target = id.length > 1 && document.querySelector(id);
      if (target) { e.preventDefault(); lenis.scrollTo(target, { offset: 0 }); }
    });
  });

  /* ---------- canvas frame sequence ---------- */
  var canvas = document.getElementById('film-canvas');
  var ctx = canvas.getContext('2d', { alpha: false });
  var FRAME_COUNT = parseInt(canvas.dataset.frameCount, 10);
  var FRAME_PATH = canvas.dataset.framePath;
  var poster = document.querySelector('.stage-poster');

  var images = new Array(FRAME_COUNT);
  var status = new Uint8Array(FRAME_COUNT); // 0=idle 1=loading 2=ready
  var currentFrame = 0;
  var renderedFrame = -1;
  var posterHidden = false;

  function frameSrc(i) {
    var n = String(i + 1);
    while (n.length < 4) n = '0' + n;
    return FRAME_PATH + 'frame_' + n + '.webp';
  }

  function load(i, cb) {
    if (status[i]) return;
    status[i] = 1;
    var done = function (img) {
      status[i] = 2;
      images[i] = img;
      if (cb) cb(i);
      // repaint if the newly loaded frame is closer to target than what's shown
      if (nearestReady(currentFrame) === i) render(true);
    };
    var fail = function () { status[i] = 0; if (cb) cb(i); };
    if (window.createImageBitmap) {
      // decode off the main thread: scrubbing never pays a decode cost
      fetch(frameSrc(i)).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.blob();
      }).then(function (b) { return createImageBitmap(b); }).then(done).catch(fail);
    } else {
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () {
        if (img.decode) img.decode().then(function () { done(img); }, function () { done(img); });
        else done(img);
      };
      img.onerror = fail;
      img.src = frameSrc(i);
    }
  }

  function nearestReady(i) {
    if (status[i] === 2) return i;
    for (var d = 1; d < FRAME_COUNT; d++) {
      if (i - d >= 0 && status[i - d] === 2) return i - d;
      if (i + d < FRAME_COUNT && status[i + d] === 2) return i + d;
    }
    return -1;
  }

  /* progressive preload: coarse pass first, then fill, capped concurrency */
  var queue = [];
  (function buildQueue() {
    var step;
    var added = {};
    for (step = 16; step >= 1; step = step >> 1) {
      for (var i = 0; i < FRAME_COUNT; i += step) {
        if (!added[i]) { added[i] = true; queue.push(i); }
      }
    }
  })();
  var inflight = 0, MAX_INFLIGHT = 8;
  function pump() {
    while (inflight < MAX_INFLIGHT && queue.length) {
      var i = queue.shift();
      if (status[i]) continue;
      inflight++;
      load(i, function () { inflight--; pump(); });
    }
  }
  pump();

  /* cover-fit draw */
  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  function resize() {
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    renderedFrame = -1;
    render(true);
  }
  window.addEventListener('resize', resize);

  function render(force) {
    var i = nearestReady(currentFrame);
    if (i < 0) return;
    if (!force && i === renderedFrame) return;
    renderedFrame = i;
    var img = images[i];
    var cw = canvas.width, ch = canvas.height;
    var iw = img.width || img.naturalWidth, ih = img.height || img.naturalHeight;
    var s = Math.max(cw / iw, ch / ih);
    var dw = iw * s, dh = ih * s;
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    if (!posterHidden && poster) {
      posterHidden = true;
      poster.style.opacity = '0';
    }
  }

  /* ---------- film timeline ---------- */
  var film = document.getElementById('film');
  var progressBar = document.getElementById('film-progress');
  var stageDim = document.querySelector('.stage-dim');

  /* scroll sets a target; a per-tick lerp glides the frame to it so fast
     wheels never jump ten frames in one paint */
  var targetProgress = 0;
  var displayFrame = 0;

  ScrollTrigger.create({
    trigger: film,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: function (self) {
      targetProgress = self.progress;
      progressBar.style.transform = 'scaleX(' + self.progress + ')';
    }
  });

  gsap.ticker.add(function () {
    var target = targetProgress * (FRAME_COUNT - 1);
    displayFrame += (target - displayFrame) * 0.24;
    if (Math.abs(target - displayFrame) < 0.4) displayFrame = target;
    var f = Math.max(0, Math.min(FRAME_COUNT - 1, Math.round(displayFrame)));
    if (f !== currentFrame) {
      currentFrame = f;
      render(false);
    }
  });

  /* scene choreography: one master timeline scrubbed across the film track.
     Timeline time is normalized 0..1 == film progress. */
  var tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: film,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.35
    }
  });

  function show(scene) { gsap.set(scene, { visibility: 'visible' }); }

  var heroScene = '#scene-hero';
  var visionScene = '#scene-vision';
  var globalScene = '#scene-global';
  var servicesScene = '#scene-services';

  gsap.set([heroScene, visionScene, globalScene, servicesScene], { visibility: 'visible' });

  /* HERO — visible on load, letters track in via intro tween (below);
     scrolls away 0.02 → 0.12 */
  gsap.set(heroScene, { opacity: 1 });
  tl.to(heroScene, { opacity: 0, y: -60, duration: 0.10 }, 0.02)
    .set(heroScene, { visibility: 'hidden' }, 0.13);

  /* VISIONARY LEADERSHIP — 0.16 → 0.34 (during the reveal of the man) */
  gsap.set(visionScene, { opacity: 0 });
  tl.set(visionScene, { visibility: 'visible' }, 0.15)
    .fromTo(visionScene, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.06 }, 0.16)
    .to(visionScene, { opacity: 0, y: -50, duration: 0.06 }, 0.30)
    .set(visionScene, { visibility: 'hidden' }, 0.37);

  /* GLOBAL IMPACT — 0.42 → 0.60 (ascension over Manhattan / atmosphere) */
  gsap.set(globalScene, { opacity: 0 });
  tl.set(globalScene, { visibility: 'visible' }, 0.41)
    .fromTo(globalScene, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.06 }, 0.42)
    .to(globalScene, { opacity: 0, y: -50, duration: 0.06 }, 0.56)
    .set(globalScene, { visibility: 'hidden' }, 0.63);

  /* INFINITE POSSIBILITIES — 0.68 → end (universe) */
  gsap.set(servicesScene, { opacity: 0 });
  gsap.set(servicesScene + ' .service', { opacity: 0, y: 30 });
  tl.set(servicesScene, { visibility: 'visible' }, 0.66)
    .fromTo(servicesScene, { opacity: 0 }, { opacity: 1, duration: 0.05 }, 0.68)
    .fromTo(servicesScene + ' .service', { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.05, stagger: 0.035 }, 0.71)
    .to(servicesScene, { opacity: 0, y: -40, duration: 0.06 }, 0.92)
    .set(servicesScene, { visibility: 'hidden' }, 0.99);

  /* dim the stage once the page continues past the film */
  gsap.to(stageDim, {
    opacity: 1,
    ease: 'none',
    scrollTrigger: {
      trigger: '#after',
      start: 'top bottom',
      end: 'top 45%',
      scrub: true
    }
  });

  /* ---------- hero letter tracking-in (on load) ---------- */
  var h1 = document.querySelector('#scene-hero h1');
  var text = h1.textContent;
  h1.textContent = '';
  var frag = document.createDocumentFragment();
  for (var c = 0; c < text.length; c++) {
    var span = document.createElement('span');
    if (text[c] === ' ') { span.className = 'char space'; span.innerHTML = '&nbsp;'; }
    else { span.className = 'char'; span.textContent = text[c]; }
    frag.appendChild(span);
  }
  h1.appendChild(frag);
  gsap.fromTo('#scene-hero .char',
    { opacity: 0, letterSpacing: '0.6em', filter: 'blur(6px)' },
    { opacity: 1, letterSpacing: '0.18em', filter: 'blur(0px)', duration: 2.2, ease: 'power3.out', stagger: 0.045, delay: 0.5 });
  gsap.fromTo('#scene-hero .kicker, #scene-hero .tagline, #scene-hero .scroll-cue',
    { opacity: 0 }, { opacity: 1, duration: 1.6, ease: 'power2.out', delay: 1.6 });

  /* ---------- post-film reveals ---------- */
  gsap.utils.toArray('#after .reveal').forEach(function (el, idx) {
    gsap.to(el, {
      opacity: 1, y: 0, duration: 1.1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%' },
      delay: (idx % 5) * 0.06
    });
  });

  resize();
})();
