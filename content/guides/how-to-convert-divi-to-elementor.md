---
title: How to Convert Divi to Elementor (Current Status + Manual Steps)
description: The Divi to Elementor converter is pending wordpress.org review — what it will do, how to join the notify list, and how to migrate manually today.
date: 2026-07-11
updated: 2026-07-11
keywords: convert divi to elementor, divi to elementor, divi to elementor migration
---

Search "convert Divi to Elementor" and most of what you'll find is guidance for the opposite direction — plenty of people move onto Divi, fewer document moving off it. This guide covers both the tool we've built for that move and, honestly, where it stands today: it isn't live yet. Here's the real status, what it will do once it ships, and how to make the move by hand in the meantime.

## The honest status: pending review

The free **[Divi → Elementor](/plugins/divi-to-elementor)** plugin is finished and **submitted to the WordPress.org plugin directory, awaiting review**. Every plugin on wp.org goes through a manual review queue before it's listed and installable from `Plugins → Add New` — there's no way to skip that, and no fixed timeline the reviewers commit to. We're not going to claim it's "available now" when it isn't; that's the kind of stale claim this exact guide exists to avoid.

If you want it the moment it clears review, join the notify list at [/plugins/divi-to-elementor](/plugins/divi-to-elementor) — leave your email and we'll send one message when the plugin goes live on wp.org, nothing else.

## What it will do once it's live

The plugin converts Divi pages and templates into Elementor's widget format, built around the same conversion-report philosophy as our [Elementor → Divi 5 converter](/guides/how-to-convert-elementor-to-divi-5):

- **35+ Divi modules mapped to Elementor widgets.** Text, image, button, blurb, testimonial, pricing table, form, tabs, accordion, gallery, and the rest of Divi's core module set each get a defined Elementor equivalent, not a generic fallback.
- **Batch conversion.** Convert many pages in a single run instead of exporting and uploading one at a time — the practical requirement for moving a whole site rather than a single page.
- **Support for all three Divi export formats.** Whether your Divi content was exported as a single layout, a full page, or a complete site/theme-builder export, the converter reads the format Divi actually produces rather than requiring you to reshape it first.
- **A conversion report for every run**, flagging anything that mapped approximately or couldn't be mapped, the same way the Elementor-to-Divi direction does — so you know exactly what to check before you trust the output.

Pro tiers follow after the free plugin ships, adding Divi Theme Builder template conversion, WooCommerce module/widget mapping, and the same batch-conversion tooling at a larger scale — priced the same as our other Pro plugin, $49/yr for unlimited sites. None of that is available yet either; it's downstream of the free plugin's approval.

## Why leave Divi for Elementor at all

We build almost everything we publish for Divi 5 and we're not shy about preferring it, but real reasons to move the other direction exist: a client standardizes their agency stack on Elementor, a project depends on a specific Elementor-only addon, or a team's existing skill set is Elementor-first and retraining isn't worth it for one project. A migration tool should exist for that decision regardless of which builder we'd pick ourselves — see the fuller comparison in [Divi 5 vs Elementor Templates](/guides/divi-5-vs-elementor-templates) if you're still weighing the choice rather than executing a move you've already decided on.

## The manual alternative, right now

Until the plugin clears review, moving a Divi page to Elementor is a rebuild, not a conversion — but it's a faster rebuild if you work in the right order:

1. **Inventory the page section by section.** List every section in your Divi page (hero, features, testimonial, CTA, footer) before you touch Elementor. This becomes your checklist and stops you from missing a section midway through.
2. **Rebuild structure before content.** In Elementor, recreate the row/column layout for one section at a time — matching column counts and widths — before filling in text and images. Structure mismatches compound if you fix them after content is in place.
3. **Match modules to widgets deliberately.** Divi's Blurb module has no single-widget Elementor equivalent; it's usually an Icon Box or a manually composed icon + heading + text stack. Divi's Pricing Table module maps reasonably to Elementor's Price Table widget. Take the mapping decisions from this guide's module list above as your reference even while doing it by hand.
4. **Carry over global styles last.** Note your Divi global colors and font choices, then set the equivalent values in Elementor's Site Settings once the structural rebuild is done — same "presets last" order recommended for [importing any layout](/guides/how-to-import-a-divi-5-layout), just running in reverse.
5. **QA at both breakpoints.** Check desktop and the 390px mobile width before calling a section done; Elementor's responsive controls don't inherit Divi's column-stacking decisions automatically.

For a single simple page, this is an afternoon. For a full site, it's the exact multi-day tax the batch plugin is built to remove — which is the whole reason we built it, and why the notify list matters if a site migration is actually on your calendar.

## What to do while you wait

Three sensible options, depending on your timeline:

- **On a deadline now:** follow the manual steps above. They're slower but they work today, and nothing about them becomes wasted effort once the plugin ships — you'll just do the next migration faster.
- **Flexible timeline:** [join the notify list](/plugins/divi-to-elementor) and hold off. Batch conversion for a multi-page site is worth the wait if you're not against a deadline.
- **Not committed to Elementor yet:** reconsider whether the move is necessary. If the appeal is a specific layout style rather than the builder itself, [browse the free Divi 5 catalog](/browse) — the section or page you're picturing may already exist as a validated Divi 5 layout, at which point there's nothing to migrate.

We'll update this guide and the [plugins page](/plugins) the moment the review clears; check [pricing](/pricing) for the current state of both converters and their Pro tiers.
