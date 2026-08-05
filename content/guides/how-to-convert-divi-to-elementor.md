---
title: How to Convert Divi to Elementor (Free Plugin + Manual Steps)
description: The free Divi to Elementor converter is live on wordpress.org — what it does, how to run your first conversion, and how to migrate by hand instead.
date: 2026-07-11
updated: 2026-08-05
keywords: convert divi to elementor, divi to elementor, divi to elementor migration
---

Search "convert Divi to Elementor" and most of what you'll find is guidance for the opposite direction — plenty of people move onto Divi, fewer document moving off it. This guide covers the tool we built for that move, how to run it, and how to do the same migration by hand if you'd rather not install anything.

## The plugin is live on wordpress.org

The free **[Divi → Elementor](/plugins/divi-to-elementor)** converter is published in the WordPress.org plugin directory. Search **JHMG Converter For Divi to Elementor** under `Plugins → Add New` in your WordPress admin, or install it from [the directory listing](https://wordpress.org/plugins/jhmg-converter-for-divi-to-elementor/).

You need Elementor active on the destination site. You do **not** need a Divi license there — the converter reads Divi's exported JSON, so the site you're importing into never has to run Divi at all.

## What it does

The plugin converts Divi pages and templates into Elementor's widget format, built around the same conversion-report philosophy as our [Elementor → Divi 5 converter](/guides/how-to-convert-elementor-to-divi-5):

- **35+ Divi modules mapped to Elementor widgets.** Text, image, button, blurb, testimonial, pricing table, form, tabs, accordion, gallery, and the rest of Divi's core module set each get a defined Elementor equivalent, not a generic fallback.
- **Support for Divi's export formats.** The converter reads what Divi actually produces — standard page exports (`et_builder`) and Divi Builder Library exports (`et_builder_layouts`) — rather than requiring you to reshape the file first.
- **A conversion report for every run**, flagging anything that mapped approximately or couldn't be mapped, the same way the Elementor-to-Divi direction does — so you know exactly what to check before you trust the output.
- **Converted pages arrive as drafts.** Nothing publishes itself. You review each page in the Elementor editor and publish when it looks right.

### Running your first conversion

1. In Divi, open **Divi Library → Portability** and export the layout you want as a JSON file.
2. In WordPress, go to **Tools → Divi → Elementor** and upload that JSON.
3. The converter creates an Elementor draft and hands you a results page with edit, preview, and publish links, plus the conversion report for that run.

The free plugin converts one file per import — the first layout inside it. If your export contains several layouts, the report says so and points at Pro.

### What Pro adds

**[Divi to Elementor Pro](/plugins/divi-to-elementor)** ($25/yr, unlimited sites) covers the parts of a whole-site migration the free plugin deliberately leaves out:

- **Batch conversion** — upload several export files and convert every layout inside them in one run, instead of one file at a time.
- **WooCommerce mapping** — Divi's WooCommerce modules map to Elementor Pro's WooCommerce widgets, so a store keeps selling after the move. (Displaying them needs Elementor Pro on the destination site.)
- **Theme Builder import** — Divi Theme Builder headers and footers convert into Elementor Library templates.

## Why leave Divi for Elementor at all

We build almost everything we publish for Divi 5 and we're not shy about preferring it, but real reasons to move the other direction exist: a client standardizes their agency stack on Elementor, a project depends on a specific Elementor-only addon, or a team's existing skill set is Elementor-first and retraining isn't worth it for one project. A migration tool should exist for that decision regardless of which builder we'd pick ourselves — see the fuller comparison in [Divi 5 vs Elementor Templates](/guides/divi-5-vs-elementor-templates) if you're still weighing the choice rather than executing a move you've already decided on.

## The manual alternative

If you'd rather not install anything, moving a Divi page to Elementor by hand is a rebuild, not a conversion — but it's a faster rebuild if you work in the right order:

1. **Inventory the page section by section.** List every section in your Divi page (hero, features, testimonial, CTA, footer) before you touch Elementor. This becomes your checklist and stops you from missing a section midway through.
2. **Rebuild structure before content.** In Elementor, recreate the row/column layout for one section at a time — matching column counts and widths — before filling in text and images. Structure mismatches compound if you fix them after content is in place.
3. **Match modules to widgets deliberately.** Divi's Blurb module has no single-widget Elementor equivalent; it's usually an Icon Box or a manually composed icon + heading + text stack. Divi's Pricing Table module maps reasonably to Elementor's Price Table widget. Take the mapping decisions from this guide's module list above as your reference even while doing it by hand.
4. **Carry over global styles last.** Note your Divi global colors and font choices, then set the equivalent values in Elementor's Site Settings once the structural rebuild is done — same "presets last" order recommended for [importing any layout](/guides/how-to-import-a-divi-5-layout), just running in reverse.
5. **QA at both breakpoints.** Check desktop and the 390px mobile width before calling a section done; Elementor's responsive controls don't inherit Divi's column-stacking decisions automatically.

For a single simple page, this is an afternoon. For a full site, it's the exact multi-day tax the batch converter is built to remove.

## A note on what transfers

The converter maps Divi module settings — colors, fonts, spacing, borders, backgrounds — to their Elementor equivalents, and most visual properties come across correctly. Some things don't, by design:

- **Divi-specific features** with no Elementor equivalent (custom CSS classes tied to Divi selectors, shortcode-based modules outside the supported list) are passed through as HTML or skipped, and the report names them.
- **Code modules and imported CSS are sanitized.** An uploaded JSON file is untrusted input, so markup is filtered through WordPress's standard post allowlist and imported CSS has scripts and `@import` rules stripped. Anything removed is reported per module so you can rebuild that piece with an Elementor widget.

That last point is deliberate: a converter that silently executed whatever was in an export file would be a security hole, so the plugin tells you what it dropped instead of pretending the conversion was lossless.

## Still deciding?

If the appeal is a specific layout style rather than the builder itself, [browse the free Divi 5 catalog](/browse) — the section or page you're picturing may already exist as a validated Divi 5 layout, at which point there's nothing to migrate. Otherwise, check [pricing](/pricing) for the current state of both converters and their Pro tiers.
