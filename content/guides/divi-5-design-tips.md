---
title: "Divi 5 Design Tips: 10 Rules Our Layout Generator Follows"
description: The ten design rules enforced across thousands of generated Divi 5 layouts — spacing rhythm, button hierarchy, palette discipline, mobile-first checks and more.
date: 2026-07-08
updated: 2026-07-08
keywords: divi design tips, divi 5 design, web design rules, divi layout best practices
---

Every layout in [our catalog](/browse) is produced by a generation pipeline, which forced us to do something human designers rarely do: write the design rules down. A person can "just feel" that a section is off; a pipeline needs the feeling specified. These are ten of the rules we enforce — mechanically, on every layout — and they're just as useful applied by hand to pages you build yourself.

## 1. One primary action per section

Every section gets at most one visually-primary button; anything else is a ghost/secondary style. When two solid, saturated buttons sit side by side, they cancel each other's urgency. This rule is enforced hardest in [hero sections](/divi-hero-sections) and [CTA sections](/type/cta), where "which button do you want clicked?" must have exactly one answer.

## 2. Spacing works in a rhythm, not per-module

Vertical spacing follows a scale (a consistent unit multiplied — never arbitrary per-module padding). The eye reads consistent spacing as intentional even when it can't say why. When you customize an imported layout, resist nudging one section's padding "to fit" — change the scale or leave it, because a single off-rhythm gap reads as a mistake page-wide.

## 3. The palette is decided once, used everywhere

Each layout commits to a small palette — background, surface, text, one accent (sometimes two) — before any section is designed, and every module draws from it. Nothing samples a new blue "because this card wanted one." When you import, this discipline is what makes rebranding fast: consistent color usage means a handful of preset edits propagate everywhere, which is the workflow described in [the import walkthrough](/guides/how-to-import-a-divi-5-layout).

## 4. Buttons are centered deliberately, or not at all

Alignment is a statement: centered buttons under centered copy, left-aligned buttons under left-aligned copy. A lone button drifting against its text block's alignment is one of the most common defects in template-land — common enough that we built automated detection for it and swept our own catalog. Machines are better than tired humans at noticing a button eleven pixels off axis.

## 5. Mobile is a design target, not a side effect

Every layout is rendered and screenshotted at desktop and phone widths before publication, and the phone rendering is judged, not assumed. Column stacking order, hero text size at 390px, and tap-target spacing are explicit checks. When you evaluate any template anywhere, look at the mobile artifact first — it's where undesigned templates confess, a point the [restaurant guide](/guides/best-divi-5-layouts-for-restaurants) makes at length for menu pages.

## 6. Real modules, always

A pricing table is pricing modules; a form is a form module; nothing interactive is faked as an image. This is a hard gate in our pipeline — layouts are structurally validated against Divi 5's module schema, and a "button" that isn't a button module fails. The reason is the buyer's second week, not the first: fake modules survive the demo and die at the first content edit. The full argument is in [Free vs Premium Divi Layouts](/guides/free-vs-premium-divi-layouts).

## 7. One icon family per layout

Icons from mixed families — outlined here, filled there, different stroke weights — make a features grid look assembled from spare parts. Each generated layout draws from a single icon system. Applied manually: when you swap icons in an imported [features section](/type/features), replace all of them or none.

## 8. Typography carries hierarchy; decoration doesn't

Headline, subhead, body, caption — four sizes with consistent weights, applied uniformly. If a section needs a box, a gradient and an animation to look important, its type hierarchy failed. The *minimal* and *corporate* styles in [the style taxonomy](/style/minimal) demonstrate this most nakedly, which is why they age best.

## 9. Photography follows the subject, or gets replaced

Stock imagery must match the section's actual subject — a finance layout gets finance-adjacent imagery, not generic handshakes. Off-subject photos are a defect class we actively hunt (an automated pipeline is gullible about "professional-looking" images, so this check became part of human review before layouts go live). When you customize, the same rule applies to your own uploads: a mediocre relevant photo beats a beautiful irrelevant one.

## 10. Delete before you decorate

The last pass on every generated layout is subtractive: any element that doesn't serve the section's one job gets removed. Dividers, third accent colors, a second decorative shape — the default answer is no. Pages built from our layouts start minimal on purpose; it's far easier to add personality to a clean structure than to recover clarity from a busy one.

## Using these rules on layouts you didn't get from us

The point of writing rules down is that they transfer. Auditing a template from anywhere — the [built-in Divi library](/elegant-themes-layouts), another shop, your own archive: check the button hierarchy (rule 1), squint at the spacing rhythm (2), count the palette (3), open the mobile view (5), and click a "button" to see if it's real (6). Five checks, two minutes, and you'll have a better read on quality than any marketplace star rating gives you.

And if you'd rather start from files where the rules were enforced by machine before a human ever approved them — that's the [whole catalog](/divi-layouts), with the [free shelf](/free-divi-layouts) as the zero-risk way to check our homework.
