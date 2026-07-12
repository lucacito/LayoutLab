---
title: Elementor to Divi 5 Migration Checklist
description: A pre-flight inventory, conversion order, QA checklist, and rollback plan for moving an Elementor site to Divi 5 without breaking anything.
date: 2026-07-11
updated: 2026-07-11
keywords: elementor to divi checklist, divi 5 migration, elementor to divi migration plan
---

A single-page conversion is forgiving — convert it, review the report, fix what's flagged, publish. A whole-site migration is not: skip the inventory step and you'll discover a missing global font on page nine of twelve, after you've already announced the new site is live. This checklist is the plan we'd run for a real site migration, in order, with the reasoning for each step so you can adapt it instead of following it blindly.

## Before you convert anything: the inventory

Do this on paper (or a spreadsheet) before opening either builder. A migration without an inventory turns into a migration where you find out what you missed by way of a support email.

**Pages.** List every page on the live site, including ones not linked from the main navigation — legal pages, old landing pages still getting traffic, thank-you pages behind a form. Anything not on this list won't get migrated, because nobody will remember it exists until it 404s.

**Templates.** Note anything built with Elementor's Theme Builder: the global header, the global footer, single-post templates, archive templates, 404 pages. These aren't page content — they're structural, and [Elementor → Divi 5 Pro](/plugins/elementor-to-divi-5) is what carries them into Divi 5's Theme Builder. The free single-page converter doesn't touch these.

**Global styles.** Write down your Elementor global color palette (hex values) and global font choices (family + weights in use). You'll need these to verify the conversion carried them over — or to set them by hand if you're on the free tier and converting page by page.

**Forms.** List every form on the site and what it does on submit — email notification, CRM webhook, redirect. Elementor Pro forms and Divi's Form module aren't a 1:1 mapping of every setting; submission behavior is the thing most worth re-testing by hand after conversion, not assuming the report covers.

**Third-party widgets.** Flag any Elementor Pro addon widgets from outside the core set (popup builders, custom carousel plugins, page-builder addons from other vendors). These are the pieces most likely to need a manual rebuild — see the "what doesn't convert perfectly" section of [How to Convert Elementor to Divi 5](/guides/how-to-convert-elementor-to-divi-5).

## Choosing your conversion order

Don't convert pages in whatever order they appear in your CMS. Convert in this order instead:

1. **Global styles and templates first**, via [Elementor → Divi 5 Pro](/plugins/elementor-to-divi-5) if you're moving header/footer/global colors, or by manually setting Divi 5's design variables to match your inventory if you're on the free tier. Every page you convert afterward should land on top of styles that are already correct, not styles you'll fix retroactively across a dozen pages.
2. **One representative page next**, ideally your most structurally complex one (the one with the most section types). Convert it, review the report closely, and use it to learn what your specific site's conversion looks like before you commit to the rest.
3. **The remaining pages**, batched if you're on Pro or one at a time via **Tools → Elementor → Divi 5** if you're on the free single-page tier. Keep the original Elementor page in a draft/unpublished state until its Divi 5 replacement passes QA — don't delete your only copy before you've verified the new one.
4. **Low-traffic and legal pages last.** They matter less to get right immediately, but they're still on your inventory list from step one, so they still get done.

## QA checklist, per page

Run this against every converted page before it goes live — not just the ones that "look off" at a glance, because the ones that look fine on a first scroll are exactly where subtle regressions hide.

- **Responsive check at 390px.** Open the Divi 5 builder's mobile preview. Column stacking order and spacing are the two things conversion is most likely to get approximately right rather than exactly right — verify both, and compare against how the Elementor original behaved on mobile if you're unsure.
- **Every link resolves.** Buttons, menu items, and inline text links all need re-verification — a converted button module can carry a broken or placeholder URL. Click through every link on the page, not just the primary CTA.
- **Forms submit and notify correctly.** Test-submit every converted form and confirm the notification email or webhook still fires. This is the single highest-cost QA miss on this whole list — a broken contact form fails silently from the visitor's side.
- **Fonts match the original.** If a font referenced in the Elementor export isn't installed on your Divi 5 site, Divi falls back to a default. Set your actual brand fonts in Divi's global presets and confirm headings and body text render as intended — the same check covered for any layout import in [How to Import a Divi 5 Layout](/guides/how-to-import-a-divi-5-layout).
- **Images load at full resolution.** Confirm nothing reverted to a placeholder or a lower-resolution asset during conversion, especially hero images and galleries.
- **Compare against the conversion report line by line.** Every item flagged as "approximate" or "unmapped" needs a human decision — either it's fine as converted, or it needs a manual fix. Don't skip anything the report called out just because the page looks okay on the surface.

## Rollback plan

Migrations occasionally go sideways for reasons that have nothing to do with the converter — a plugin conflict, a hosting quirk, a deadline that arrives before QA is finished. Plan for that before you start, not after:

- **Never delete the Elementor original until its Divi 5 replacement has passed the full QA checklist above and been live for at least a few days.** Unpublish it, don't delete it.
- **Keep your original Elementor export files.** If a page needs to go back to Elementor temporarily, having the untouched export means you're re-publishing a known-good page, not reconstructing one from memory.
- **Migrate in a staging environment if the site has meaningful traffic.** Run the full inventory-through-QA sequence on staging, then push the verified pages to production in one pass rather than converting live pages one at a time in front of visitors.
- **If a specific page's conversion has real problems, isolate it.** Publish the pages that passed QA, leave the problem page on Elementor a little longer, and fix it separately rather than blocking the whole migration on one edge case.

## Putting it together

A migration that follows this order — inventory, global styles, one test page, the rest in batches, QA every page, keep a rollback path — turns "we moved the site to Divi 5" from a stressful weekend into a checklist you work through. Start with the converter itself: [How to Convert Elementor to Divi 5](/guides/how-to-convert-elementor-to-divi-5) covers the actual export/upload/review steps this checklist assumes, and if you're moving the other direction instead, see [How to Convert Divi to Elementor](/guides/how-to-convert-divi-to-elementor) for that plugin's status and the manual steps available today. Full plugin details and pricing live on [the plugins page](/plugins) and [pricing](/pricing); once your site lands on Divi 5, [the free layout catalog](/browse) is worth a look before you rebuild any section from scratch.
