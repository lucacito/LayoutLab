# Brightwell Family Dental — landing page (design)

**Date:** 2026-07-10
**Type:** Single full-landing page for a client (placeholder brand, swappable facts)
**Pattern:** direct analog of `scripts/create-radiology-landing.ts` — one `ThemePage`
run through the theme pipeline (`runThemePack`): compose → validate → images →
stack → dedupe → SEO → upload → render → ingest (auto-published) into the LOCAL
catalog. No prod sync until the render is eyeballed and approved.

## Decisions (from brainstorming)

- **Brand facts:** realistic *placeholder* — fictional-but-credible brand the client
  swaps their real info into. Not a real named client.
- **Positioning:** family / general dentistry — warm, reassuring, community feel.
- **Aesthetic:** "fresh clean teal/mint" — bright, light, generous whitespace, a
  single teal accent, soft rounded cards.
- **Scope this run:** generate + render locally for review. Prod sync is a
  separate, later step (per operating agreement, prod sync is un-gated but the
  render should be eyeballed first per the visual-review discipline).

## Brand

- **Name:** Brightwell Family Dental
- **Tagline:** Gentle, modern dentistry for your whole family
- **Conversion goal / CTA:** Book an Appointment (single, repeated action)
- **Voice:** warm, reassuring, plain-language, comfort-first — never salesy, never
  clinical-cold. Speaks to a busy parent who wants a dentist the whole family trusts.

**Canonical placeholder brand facts** (used verbatim wherever contact info,
hours, services, insurance, or booking appears — never invent alternatives):

- Phone: (503) 555-0184
- Email: hello@brightwelldental.com
- Address: 128 Cedar Street, Suite 4, Portland, OR 97205
- Hours: Mon–Thu 8:00am–6:00pm; Fri 8:00am–4:00pm; Sat by appointment; closed Sun
- Accepting new patients · most insurance accepted · flexible financing/payment
  plans · same-day emergency care · kids welcome · comfort/sedation options for
  anxious patients

## Palette (shared design system across every section)

| Role | Hex | Use |
|---|---|---|
| primary | `#0D9488` | buttons, accents |
| secondary | `#0E7490` | supporting cyan-teal |
| tint | `#F0FDFA` | alternating soft panels |
| dark | `#134E4A` | deep-teal dark panels |
| heading | `#0F172A` | slate headings |
| body | `#334155` | body text |

Design notes: bright and clean, generous whitespace, soft rounded cards with one
consistent radius and a single soft shadow, thin dividers, a single teal accent
used sparingly. Trustworthy, friendly, uncluttered — never loud, never cold.

## Section flow (10)

1. **hero** (hero, cta) — warm welcome; gentle modern family dentistry; who it's
   for; the one action Book an Appointment; bright friendly office/family image.
2. **trust** (features) — quiet credibility strip: accepting new patients · most
   insurance accepted · gentle comfort-first care · same-day emergencies · kids
   welcome.
3. **services** (cards, cta) — Checkups & Cleanings · Fillings & Crowns · Teeth
   Whitening & Cosmetic · Children's Dentistry · Invisalign Clear Aligners ·
   Emergency Dental Care. Each: name + one-line plain-language note.
4. **why** (features) — why families choose Brightwell: comfort-first care, on-time
   appointments, transparent pricing, whole-family scheduling under one roof,
   modern tech, a friendly team. Sell reassurance, not features.
5. **how_it_works** (cards) — 3 easy steps: Book your visit → Relaxed first exam →
   Simple care plan. Low-stress, new-patient friendly.
6. **gallery** (gallery) — bright, welcoming photos of the office, team, and happy
   patients.
7. **team** (cards) — meet the dentist + team; a warm face-of-the-practice section
   to build trust (bracketed placeholder names/credentials, never fabricated).
8. **faq** (faq) — real questions: Do you take my insurance? Accepting new
   patients? Nervous about the dentist? Do you see kids? Dental emergencies?
   Payment plans?
9. **social_proof** (testimonials, cta) — 2–3 short patient quotes (bracketed
   placeholders, never fabricated as real).
10. **final_cta** (cta) — restate the promise + Book an Appointment; contact +
    hours nearby.

## Spec taxonomy

`niche: medical` (dental practice), `style: minimal`, `color: light`.

## Verification

- Pipeline summary shows `ingested: 1`, `dropped: 0`.
- Eyeball the rendered screenshots (visual-review discipline: check phone/contact
  drift, on-subject photography, no gallery holes, correct icons, centered
  buttons) before any prod sync.
