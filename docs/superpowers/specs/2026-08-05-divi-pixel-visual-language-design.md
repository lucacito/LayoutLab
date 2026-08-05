# Divi5Lab — Divi Pixel visual language, Divi5Lab colors

**Date:** 2026-08-05
**Goal:** Rebuild the look and feel of divi5lab.com to match the design language of
divi-pixel.com, using Divi5Lab's existing palette. No new brand hues.

---

## 1. What we are copying (and what we are not)

We are copying **divi-pixel.com's visual language**, not its content, copy, layout
structure, imagery, or brand. Concretely, the language is:

| Trait | Divi Pixel | Divi5Lab today |
|---|---|---|
| Canvas | Whole page sits on a saturated brand gradient; white is the exception | White / `#F8F9FB`; color is the exception |
| Display type | Poppins 800, 60–74px, tight tracking | Inter 700, 68px max |
| Eyebrow | Uppercase, ~2–3px tracking, accent color, above every section header | Present but small and understated |
| Buttons | Fully pill (`border-radius: 50–100px`), chunky, colored glow shadow | Pill already, but flat and small |
| Cards | 10px radius, big diffuse purple-tinted shadows | 16px radius, neutral grey shadow |
| Product visuals | Overlapping, floating, layered UI screenshots with depth | Single flat inline panels |
| Section transitions | Giant organic curved shapes bleeding between bands | Hairline `border-t` rules |
| Background motifs | Low-opacity line-art shapes, soft blobs, glows | None |
| Footer | Same saturated canvas as the page, light text | White, hairline-separated |

Extracted from Divi Pixel's stylesheet for calibration (their values, our
colors): shadows `0 19px 60px rgba(16,0,76,.13)`, `0 12px 45px -6px rgba(68,0,153,.17)`,
`0 2px 80px -15px rgba(54,0,117,.8)`; H1 `font-weight:800; font-size:60–74px`;
H2 `600 / 37px`; eyebrow `letter-spacing: 2–3px`; radii `10px` cards, `50–100px`
buttons.

## 2. Colors — unchanged

Every existing token in `tailwind.config.ts` keeps its name and value:

```
navy #0B3558   action #635BFF   paper #FFFFFF   mist #F8F9FB   fog #E7EDF6
muted #476788  ink #0A0A0A      border #D4E0ED
g-pink #E55CFF g-purple #8247F5 g-amber #FFA600  g-cyan #0099FF
```

The immersive canvas is built **only from blends of these**, not from new hues:

- `canvas-deep` — `linear-gradient(165deg, navy → mix(navy, action) → action)`
- `canvas-hero` — same, plus a radial `g-purple` glow and a `g-pink` accent bloom
- On-canvas text is `paper` at 100 / 85 / 65% opacity.

`action` (#635BFF) and `g-purple` (#8247F5) already sit in Divi Pixel's violet
family, so the language transfers without a palette change. `navy` supplies the
deep end their `#15022a` occupies.

## 3. Type

- **Display / headings → Poppins** (700/800). This is the single biggest carrier of
  the Divi Pixel feel; Inter cannot produce it.
- **Body → Inter**, unchanged. Poppins at body sizes hurts long-form readability on
  the guides and catalog pages.
- Scale bumped and tightened: `text-display` up to 84px/800/-0.03em,
  `text-h1` to 72px/800, `text-h2` to 52px/700.
- New `.eyebrow` utility: uppercase, 13px, weight 700, `letter-spacing: .18em`.

## 4. Scope — which surfaces get which treatment

**Full immersive treatment** (canvas gradients, curves, floating stacks, blobs):
home, plugins index + 3 plugin pages, pricing, about, contact, guides index, and
all `CtaBand` instances.

**Token refresh only** (Poppins headings, pill buttons, rounder cards, purple
shadows — but light surfaces retained): browse, layout/pack detail, taxonomy
landings, account, admin.

Rationale: the catalog's product is layout **screenshots**. Thumbnails need a
neutral ground to read against; a saturated canvas behind hundreds of previews
would fight the merchandise and hurt conversion. Divi Pixel has no equivalent
grid, so there is nothing to copy there. Marketing carries the identity; the
catalog inherits the tokens so the two never look like different sites.

## 5. Components

**New**
- `Eyebrow` — uppercase tracked label, `tone: 'light' | 'dark'`.
- `SectionShell` — owns section rhythm: `tone` (`paper | mist | deep | hero`),
  `curve` (`none | top | bottom | both`), optional decorative blobs, padding scale.
- `FloatingStack` — overlapping layered panels with staggered float animation and
  depth shadows; the Divi Pixel product-shot motif, built from our existing code
  motifs rather than screenshots.

**Reworked**
- `Button` — `size` (sm/md/lg), `variant` (primary/secondary/ghost/onDark);
  full pill; primary carries an `action`-tinted glow.
- `Card` — `tone` (`paper | glass`); glass = translucent white over canvas with a
  light border, for cards sitting on the gradient.
- `SectionTitle` — centered display sizing, integrated eyebrow, `tone` support.
- `Header` — transparent over the hero, solidifies on scroll; circular icon
  buttons; pill CTA.
- `Footer` — moved onto `canvas-deep`; uppercase tracked column heads.
- `AnnouncementBar`, `CtaBand`, `ProductDoors`, `FreeLayoutsBand`, `StatStrip`,
  `VerdictCard`, `ValidatorChatDemo` — restyled to the new tokens.

## 6. Homepage section rhythm (after)

1. **Hero** — `canvas-hero`, transparent header over it, centered eyebrow →
   84px display headline → lead → two pill CTAs → stat strip, with a
   `FloatingStack` of validator/converter panels below, curving into §2.
2. **Problem band** — deep canvas, centered, decorative blob.
3. **Mechanism** — paper, two-column, numbered steps + `VerdictCard` floated.
4. **Three doors** — mist, curved top, glass-free cards with hover lift.
5. **Demo** — deep canvas, `ValidatorChatDemo` floating on the gradient.
6. **Free layouts** — paper, pill email capture.
7. **Guides** — mist.
8. **CTA band** — `canvas-deep`, curved top, into the footer's matching canvas.

## 7. Motion

- Existing `anim-rise` retained.
- New `float` keyframe (6s ease-in-out translateY ±10px) on stacked panels,
  staggered per layer.
- Header background/shadow transition on scroll.
- All of it inside the existing `prefers-reduced-motion` guard in `globals.css`.

## 8. Constraints

- No change to routing, data, copy, SEO metadata, JSON-LD, or commerce logic. This
  is presentation only.
- No new color values in `tailwind.config.ts` beyond gradient blends of existing
  tokens.
- Poppins loaded via `next/font/google` alongside Inter, `display: swap`, subset
  latin — no third-party font request.
- Contrast: on-canvas body text stays at or above 4.5:1 against the darkest
  gradient stop.

## 9. Verification

`npm run typecheck`, `npm run lint`, `npm run build`, then Playwright screenshots
of `/`, `/plugins`, `/pricing`, `/browse` at 1440px and 390px, compared against
the pre-change captures.
