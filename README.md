# papangue.agency

One-page landing site for Papangue, an ecommerce studio: from turnkey CMS stores to AI agents (agentic commerce).

## Concept

Vertical scrolling tells the story of a business growing up, in 4 stacked chapters (full-height sticky scenes, each with its own color):

1. **Lancer** (sun yellow) :: CMS store: Shopify, WooCommerce, Magento
2. **Structurer** (emerald) :: headless & custom: Next.js, PIM, ERP
3. **Amplifier** (raspberry) :: data & growth: SEO, CRO, marketplaces
4. **Automatiser** (crimson) :: AI agents: support, restocking, pricing

Each chapter delivers its content on a **till receipt** (monospace, barcode, torn edge), the site's visual motif.

## Files

- `index.html` :: structure and content
- `styles.css` :: design system (tokens in `:root`), scenes, receipt, responsive, `prefers-reduced-motion`
- `app.js` :: two layers:
  - **base** (always on): progress thread, active chapter in the rail, IntersectionObserver reveals
  - **enhanced** (GSAP + ScrollTrigger + Lenis from CDN): scroll inertia, smooth anchors, depth (the covered scene recedes), entry parallax (numbers, receipts, decor), receipts that "print", ticker driven by scroll speed, magnetic buttons
- `shape.js` :: a 3D shape (Three.js from CDN, sphere or cube depending on `SHAPE`) in close-up behind each chapter 01 to 04, never seen whole. On desktop it is tone on tone with the scene color; it rolls into place on entry, keeps turning while the scene is covered, and drifts very slowly. Each chapter's framing lives in `STAGING`. On mobile it takes the text color of the "CH.0x ↓" button and sits at a random spot near the bottom of the scene. Without WebGL the scene keeps its flat color; with `prefers-reduced-motion` the shape stays in its final pose.

## Run locally

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

(Or open `index.html` directly: only Google Fonts need the network.)

## Technical notes

- Headings in Spline Sans Mono caps, same treatment as the receipt headers (`PAPANGUE ★ CHAPITRE 01`); body text in Schibsted Grotesk. Fonts from Google Fonts with system fallbacks.
- GSAP 3.13 + ScrollTrigger + Lenis 1.3 + Three.js r149 loaded from CDN; if the CDN is down or the user prefers `prefers-reduced-motion`, the page falls back cleanly to the base layer (no dependency required).
- Sticky stacking and depth effects are disabled below 900px (normal flow, rail hidden).
- Deliberately single-theme (no dark mode): each scene owns its color.
