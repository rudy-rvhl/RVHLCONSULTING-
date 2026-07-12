# RVHL CONSULTING — cinematic scroll site

An award-style one-page cinematic website for RVHL Consulting. Scrolling scrubs a
continuous AI-generated film — the **Inception Move** — from an extreme macro of a
piercing blue eye, out to a consultant in his Manhattan corner office above Central
Park, up through the atmosphere, past Earth, into an infinite golden-nebula universe.

## Stack

- **Static site** — no build step. Deploy the repo root to any static host
  (GitHub Pages, Netlify, Vercel, Cloudflare Pages).
- **Lenis** smooth scroll + **GSAP ScrollTrigger** choreography (vendored in `vendor/`).
- **Canvas frame sequence** (`assets/frames/frame_0001.webp …`) scrubbed by scroll —
  the Apple-style technique. Progressive coarse-to-fine preloading.
- **Fonts**: Cormorant Garamond (display serif) + Inter (sans), self-hosted in `assets/fonts/`.
- Full SEO: semantic fallback content for crawlers/no-JS/reduced-motion,
  Schema.org JSON-LD (ProfessionalService, WebSite, Blog, BlogPosting, FAQPage,
  BreadcrumbList), OpenGraph/Twitter cards, `sitemap.xml`, `robots.txt`.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Structure

```
index.html            one-page cinematic site (film + partners + journal + contact)
blog/                 The RVHL Journal (index + weekly essays)
css/main.css          design system: off-black, gold, serif/sans
js/main.js            scroll engine: Lenis + ScrollTrigger + canvas scrub
assets/frames/        the film as a webp frame sequence (scroll-scrubbed)
assets/posters/       keyframe stills (hero poster, section art, og-image)
assets/fonts/         self-hosted woff2
vendor/               lenis.min.js, gsap.min.js, ScrollTrigger.min.js
```

## Editing content

- **Partners** — edit the block between `<!-- PARTNERS:START -->` and
  `<!-- PARTNERS:END -->` in `index.html`.
- **Contact** — the `#contact` section in `index.html` (phone, email) and the
  JSON-LD block in `<head>`.
- **Journal** — each post is a standalone HTML file in `blog/`. Add a card
  between `<!-- POSTS:START -->` / `<!-- POSTS:END -->` in `blog/index.html`
  and in `index.html` (home page shows the latest three), and append the URL
  to `sitemap.xml`. A weekly automation writes and publishes one essay per week.

## The film

The sequence was generated with a Fal.ai pipeline (Nano Banana Pro keyframes;
Seedance 2.0 / Kling v3 Pro image-to-video, 5 s per clip, 1080p, chained
last-frame → first-frame for seamless continuity), then extracted to webp frames:

```bash
# per clip, 12 fps, 1280px wide
ffmpeg -i clip.mp4 -vf "fps=12,scale=1280:-2" -quality 72 frames/frame_%04d.webp
```

Regenerating requires a `FAL_KEY`; the prompts for every shot are recorded in
the generation metadata (`prompt.md`) kept with the source clips.
