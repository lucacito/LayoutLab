// The pipeline's OWN image-selection guide for marketplace layout generation.
//
// Deliberately NOT scraped from the sibling validator repo's ImageGuide.php: since the
// plugin's WordPress.org rework that guide is built dynamically (media-library-first,
// a catalogue of plugin-bundled local images, a list_media_images tool), none of which
// is usable here. Our layouts are generated offline and exported as JSON that customers
// import, so every image must be a self-contained REMOTE https URL. The strategy and
// verified keyless URL patterns are adapted from the validator's earlier ImageGuide
// (validator history, commit 8060d1c) with all plugin-only tooling and licence wording
// removed. placehold.co and friends are intentionally absent: pipeline/content-lint.ts
// rejects them (PLACEHOLDER_IMAGE), and pipeline/images.ts later swaps loremflickr URLs
// for real stock photos.
export const IMAGE_GUIDE_MARKDOWN = `# Divi 5 Image Intelligence Guide

Images are not decoration. Each one does a job for its section. Pick visuals by
ROLE, never at random. A page where the hero shows a real product, testimonials
have real faces, and cards share one consistent ratio reads as a polished
template; the same layout with random unrelated photos reads as an empty
generator. Pair this with the style guide (the image module's attribute shape)
and the landing guide (the section's conversion job).

## Self-contained remote images only (hard rule)
These layouts are generated offline and exported as JSON that customers import
into their own sites. Every image \`src\` must therefore be a self-contained,
absolute \`https://\` URL on one of the keyless remote sources below. NEVER use
plugin-local or site-relative paths (\`/wp-content/...\`, \`assets/images/...\`),
NEVER use double-brace template tokens (anything in \`{{ }}\` form), and NEVER leave a \`src\`
empty. Do not assume any media library, bundled file or helper tool exists.

## Step 0 — read the context, then derive keywords
Before choosing any image, fix five things (from the brief / the page you're
building): **page type, industry, section purpose, tone/style, audience.** Turn
them into 1–3 concrete search keywords per image. Examples:
- SaaS hero → \`dashboard,laptop\`  ·  SaaS team → \`startup,team\`
- Restaurant hero → \`restaurant,interior\`  ·  menu → \`food,plating\`
- Architecture → \`modern,building\`  ·  Fitness → \`gym,training\`
- Public transport → \`tram,city\` / \`bus,commute\` / \`station,people\`
Use the most specific noun that still returns photos (city + subject beats a
proper place name a stock search won't have).

## The source toolkit (all keyless: no API key, work as-is)
Choose the source by the image's ROLE:

| Role / need | Source | URL pattern (verified) |
|---|---|---|
| **Relevant real photo** (hero, lifestyle, industry, blog/card) | **LoremFlickr** | \`https://loremflickr.com/{w}/{h}/{kw1},{kw2}?lock={n}\` |
| Generic / abstract / texture / safe fallback | **Picsum** | \`https://picsum.photos/seed/{keyword}/{w}/{h}\` |
| **Avatar / face** (testimonial, team, profile) | **Random User** | \`https://randomuser.me/api/portraits/{men\\|women}/{0-99}.jpg\` |
| Avatar (alt, sized square) | **Pravatar** | \`https://i.pravatar.cc/{size}?img={1-70}\` |

Notes that make images look intentional, not random:
- **LoremFlickr returns a keyword-matched photo.** Comma-separate up to ~3 tags.
  Grayscale variant: \`https://loremflickr.com/g/{w}/{h}/{kw}?lock={n}\`.
- **Picsum has NO keyword search.** The seed only makes it *stable*, not
  *relevant*. Use Picsum only where the subject doesn't matter (abstract
  backgrounds, textures, fallback). For a subject that matters, use LoremFlickr.
- \`source.unsplash.com\` is **retired (503)**: never use it.
- **placehold.co / via.placeholder / dummyimage and similar labeled-placeholder
  hosts are NOT allowed.** The pipeline's content lint rejects them. When no
  real photo fits, fall back to Picsum with a descriptive seed instead.

## Stable images — pin every one (critical)
A generated page must show the SAME image on every load. Always pin:
- LoremFlickr → add \`?lock={n}\` (a fixed integer per image; vary n so different
  images differ).
- Picsum → use \`/seed/{keyword}/\` (never the random \`/{w}/{h}\` form).
- Avatars → fixed index (\`/men/32.jpg\`, \`?img=12\`).
Give each distinct image a distinct lock/seed/index so a grid isn't all the same
photo, but keep them fixed so nothing reshuffles.

## Section-by-section rules
- **Hero**: one large, real, on-topic visual (product/UI, lifestyle, or
  industry scene). LoremFlickr with the page's core keywords. Never a generic
  grey or unrelated image here. Request it wide (see ratios).
- **Testimonials**: real face + name + role + company per quote. Avatar source
  (Random User or Pravatar). Keep avatars clearly stand-ins for sample people;
  do NOT imply a real named person endorsed the product.
- **Team**: professional portraits, ONE consistent avatar source and style
  across all members (don't mix Random User men with cartoon avatars).
- **Blog / news / cards**: category-relevant photos (LoremFlickr by topic), all
  at the SAME dimensions/ratio so the grid is even.
- **Feature / "how it works"**: prefer an icon over stock photography; not every
  feature needs a photo.
- **Logos / clients**: use text wordmarks or icons in the layout itself rather
  than image placeholders, unless a Picsum seed image is unavoidable.

## Sizes & aspect ratios — request at the display ratio
Pick one ratio per section and request the image at it, so Divi never has to
stretch/crop awkwardly:
- Full-width hero/CTA bg: \`1600x900\` (16:9) or \`1920x1080\`
- Split-section image: \`1000x800\` (5:4) or \`1000x1100\` (portrait)
- Card / blog grid: \`800x600\` (4:3) **or** \`800x534\` (3:2). Pick ONE and reuse
  it for every card in that grid
- Avatar: \`300x300\` (1:1)
Keep every card in a grid identical in size; mismatched ratios are the #1 tell of
an auto-generated page.

## Fallback order (per image)
1. Subject matters → **LoremFlickr** (\`?lock\`).
2. A real face → **Random User / Pravatar**.
3. Subject doesn't matter, or nothing fits → **Picsum** (\`/seed/\`).
Never leave an image module without a \`src\`.

## Quality
Use the divi/image module shape from the style guide (its required
\`image.innerContent.{bp}.value.src\`). Keep ratios consistent within a section,
round corners to match the page's card radius, and request images at display
size rather than oversized.
`;
