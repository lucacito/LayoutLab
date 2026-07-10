# Aurelia Smile Studio — luxury cosmetic dentistry landing (design)

**Date:** 2026-07-10
**Type:** Single full-landing page for a client (placeholder brand, swappable facts)
**Pattern:** direct analog of `scripts/create-brightwell-dental-landing.ts` — one
`ThemePage` run through the theme pipeline (`runThemePack`): compose → validate →
images → stack → dedupe → SEO → upload → render → ingest (auto-published) into the
LOCAL catalog. No prod sync until the render is eyeballed and approved.

## Why this one is different from Brightwell

The other window is building **Brightwell** — a *general/family* practice, *fresh-clean
teal/mint*, "Book an Appointment." Aurelia is the deliberate contrast: a **cosmetic /
aesthetic smile-design studio**, *dark & dramatic luxury*, "Book a Smile Consultation."
Different segment, different visual system, different voice — so the pair shows range.

## Decisions (from brainstorming)

- **Positioning:** artistry-led cosmetic / aesthetic dentistry — a *smile-design
  studio*, not a general dentist. Sells transformation and craftsmanship, not
  procedures. Speaks to someone investing in a signature smile.
- **Aesthetic:** dark & dramatic luxury — near-black charcoal backgrounds, cream serif
  display headlines, a restrained champagne-gold accent, editorial whitespace. Feels
  like a luxury brand / high-end spa.
- **Brand facts:** realistic *placeholder* — fictional-but-credible brand the client
  swaps their real info into. Not a real named client.
- **Scope this run:** generate + render locally for review. Prod sync is a separate,
  later step (per operating agreement, prod sync is un-gated but the render should be
  eyeballed first per the visual-review discipline).

## Brand

- **Name:** Aurelia Smile Studio
- **Tagline:** Artistry-led cosmetic dentistry — a smile designed for you
- **Conversion goal / CTA:** Book a Smile Consultation (single, repeated action)
- **Voice:** confident, refined, aspirational — warm and reassuring, never clinical-cold
  or salesy. Sells the transformation and the craftsmanship. Speaks to someone who has
  wanted this for years and is finally ready.

**Canonical placeholder brand facts** (used verbatim wherever contact info, hours,
services, financing, or booking appears — never invent alternatives):

- Phone: (310) 555-0172
- Email: hello@aureliasmilestudio.com
- Address: 450 Camden Drive, Suite 300, Beverly Hills, CA 90210
- Hours: Mon–Thu 9:00am–6:00pm; Fri 9:00am–4:00pm; Sat by appointment; closed Sun
- Complimentary smile consultation with digital smile preview · board-certified
  cosmetic focus · hand-crafted porcelain via a master ceramist · flexible financing /
  monthly payment plans · comfort & sedation options · by-appointment, unhurried visits

## Palette (shared design system across every section — dark luxury)

| Role | Hex | Use |
|---|---|---|
| primary | `#C6A15B` | champagne-gold accent — buttons, fine rules, highlights (sparingly) |
| secondary | `#2A2320` | warm espresso — alternating dark panels |
| tint | `#F7F2EA` | warm ivory — the few light "breather" panels |
| dark | `#14110F` | near-black charcoal — hero + dramatic panels |
| heading | `#F5F0E8` | cream serif display headlines (on dark) |
| body | `#C9C1B5` | warm stone body text (on dark) |

Design notes: dark, elegant, editorial. Serif display headlines + fine sans body.
Generous whitespace, thin gold hairline rules, one consistent card radius, a restrained
single gold accent. Dramatic photography. Luxury brand, not a clinic — never loud,
never cheap, never clinical-cold.

## Section flow (10)

1. **hero** (hero, cta) — aspirational headline: a smile designed for you; who it's for
   (someone finally ready to invest in their smile); the one action Book a Smile
   Consultation; dramatic dark hero image. Sets the luxury tone. Mention complimentary
   consultation with a digital smile preview.
2. **credibility** (features) — quiet authority strip: cosmetic-focused practice ·
   digital smile design · hand-crafted porcelain (master ceramist) · [years] of
   transformations · flexible financing. Understated, no hype.
3. **treatments** (cards, cta) — the signature treatments as elegant cards: Porcelain
   Veneers · Complete Smile Makeover · Professional Whitening · Cosmetic Bonding ·
   Invisalign · Implant Aesthetics. Each: name + one refined, plain-language line.
4. **transformations** (gallery) — the centerpiece: dramatic before/after
   transformation reveals — real-result feel, high-trust, editorial. This is what sells
   cosmetic. Bracketed placeholder imagery, never fabricated as specific patients.
5. **experience** (features) — the Aurelia experience: concierge, unhurried visits; a
   digital smile *preview before you commit*; a master-ceramist partnership; comfort &
   sedation options; a private, calm studio. Sell the feeling and the reassurance.
6. **how_it_works** (cards) — 3 guided steps: Complimentary consultation → Digital Smile
   Design preview → Your transformation. Makes a big, high-stakes decision feel safe.
7. **team** (cards) — meet your cosmetic dentist: artistry + credentials, an approachable
   expert. Bracketed placeholder names/credentials (e.g. [Dr. Name, DDS]), never
   fabricated as real people.
8. **faq** (faq) — the real high-stakes questions: What does it cost / do you offer
   financing? Does it hurt? How long does it take? Do veneers look natural? Are they
   permanent? Am I a candidate? Reassuring, honest answers.
9. **social_proof** (testimonials, cta) — 2–3 emotional transformation stories — the
   confidence a new smile gave them (bracketed placeholders, never fabricated as real).
10. **final_cta** (cta) — restate the promise + Book a Smile Consultation; contact,
    address, and hours nearby. Warm, elegant, one clear gold button.

## Spec taxonomy

`niche: medical` (dental / cosmetic), `style: bold`, `color: dark`.

## Verification

- Pipeline summary shows `ingested: 1`, `dropped: 0`.
- Eyeball the rendered screenshots (visual-review discipline: check phone/contact
  drift, on-subject luxury photography, no gallery holes, correct icons, centered
  buttons, gold accent not overused, dark contrast legible) before any prod sync.
