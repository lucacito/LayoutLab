---
title: How to Convert Elementor to Divi 5 (Step-by-Step)
description: Move an Elementor page or full kit into real Divi 5 modules — export, install the free converter, upload, review the conversion report, publish.
date: 2026-07-11
updated: 2026-07-11
keywords: convert elementor to divi, elementor to divi migration, elementor to divi 5
---

If you've ever tried to hand-rebuild an Elementor page in Divi, you know the tedium: open both builders side by side, eyeball every section, recreate each widget as the nearest Divi module, and hope you didn't drop a setting along the way. A conversion plugin exists specifically to remove that afternoon. This guide walks through the actual process end to end — what you export, what you install, what the output looks like, and when the free tier stops being enough.

## What "converting" actually means

Elementor and Divi describe pages with two different, incompatible JSON schemas — an Elementor export is a tree of Elementor widgets, and Divi 5 expects a tree of Divi modules. Neither builder understands the other's file natively. A converter's job is to walk the Elementor tree and rebuild it as the nearest equivalent Divi 5 structure: a heading widget becomes a Text module, an Elementor image becomes an Image module, an Elementor form becomes Divi's native Form module, and so on. The output isn't a screenshot or an embed — it's real, editable Divi 5 markup that opens in the visual builder like any layout you'd download from [our catalog](/browse).

## Step 1: Export from Elementor

In Elementor, open the page you want to move and use its built-in export. You have two options depending on scope:

- **Single page (JSON).** From the page's editor, use Elementor's "Export as Template" (or the equivalent site-export option scoped to one page) to produce a `.json` file describing just that page's widget tree.
- **Full kit (ZIP).** If you're moving an entire site — multiple pages plus global settings like headers, footers, and theme colors — Elementor's Kit export bundles everything into a single ZIP.

The single-page JSON path is what the free converter handles. The kit ZIP path needs Pro (more on that below).

## Step 2: Install the free converter

Install **[Elementor → Divi 5](https://wordpress.org/plugins/jhmg-converter-for-elementor-to-divi/)** from the WordPress.org plugin directory — search "Elementor to Divi 5" in wp-admin under **Plugins → Add New**, or download it directly from wp.org. It's free, with no page limit: you can run as many single-page conversions as you need. Activate it like any other plugin.

## Step 3: Upload in Tools → Elementor → Divi 5

Once activated, the converter adds a screen under **Tools → Elementor → Divi 5** in your WordPress admin. Upload the JSON file you exported in step 1. The plugin parses the Elementor widget tree and maps each widget to its Divi 5 equivalent — it currently covers **140+ widget mappings**, spanning Elementor's core widgets (heading, text editor, image, button, icon list, form, tabs, accordion, columns, and the rest of the standard kit) plus common structural patterns like nested sections and inner columns.

## Step 4: Review the conversion report

After the upload finishes, the plugin generates a **conversion report** — a summary of what mapped cleanly, what mapped with an approximation (for example, an Elementor widget with no exact Divi 5 counterpart gets the closest structural match), and anything it couldn't map at all. Read this before you touch the page. It's the difference between "the import looked fine" and actually knowing what changed. Most single-page conversions come back with a clean report; the exceptions are usually third-party Elementor addon widgets outside the core set, which have no guaranteed mapping.

## Step 5: Publish

Open the converted page in the Divi 5 builder the same way you'd open any layout — it's now a real page with Divi modules, not an import artifact. From here, treat it exactly like [a layout you downloaded from the catalog](/guides/how-to-import-a-divi-5-layout): check it at desktop and mobile widths, fix anything the report flagged, wire up links, and publish. Because the output is native Divi 5 markup, everything downstream — global presets, the Theme Builder, responsive editing — works normally.

## When you need Pro

The free plugin is intentionally scoped to single pages, and that covers a lot of real migrations — moving one landing page, one service page, one blog template. Three situations push you into **[Elementor → Divi 5 Pro](/plugins/elementor-to-divi-5)** ($49/yr, unlimited sites):

1. **You're migrating a whole site, not one page.** Pro imports the full kit ZIP in one pass instead of exporting and uploading page by page.
2. **You use Elementor's global header/footer.** Pro maps those into Divi 5's Theme Builder, so your site-wide navigation and footer survive the move instead of needing to be rebuilt by hand.
3. **You rely on Elementor's global colors and typography.** Pro carries those global styles across as Divi 5 design variables, so a single preset edit still restyles the whole site after conversion — the same workflow described in [Divi 5 Design Tips](/guides/divi-5-design-tips).

Pro also includes a year of updates and priority support, and one license activates on every site you own or build for clients.

## What doesn't convert perfectly (and why)

No automated converter is lossless across two different builder architectures, and it's worth being honest about where the seams show:

- **Custom CSS on individual widgets** carries over as custom CSS on the matching Divi module where possible, but very builder-specific hacks (Elementor motion effects, certain third-party addon widgets) may need a manual rebuild of that one element.
- **Popups and dynamic-content widgets** from Elementor Pro don't have a Divi 5 equivalent in the same form and are flagged in the conversion report rather than silently dropped.
- **Fonts** referenced in the Elementor file but not installed on your Divi 5 site fall back the same way any layout import would — set your preferred fonts in Divi's global presets after conversion.

None of these are conversion bugs; they're the honest edges of moving between two different schemas. The conversion report exists so you find them in five minutes, not after a client does.

## Why bother instead of rebuilding by hand

For a single page, hand-rebuilding might take an hour and the converter might take five minutes plus a ten-minute review — that math alone justifies it. For a full site, the gap widens dramatically: a ten-page site with a shared header and footer is a multi-day rebuild by hand and a same-afternoon migration with Pro. Either way, once the page lives in Divi 5, it benefits from everything Divi 5 does well — the preset-driven styling system, the Theme Builder, and (if you ever want a starting point instead of a blank page) our [free Divi 5 layout catalog](/free-divi-layouts) to pull sections from.

If you're weighing whether to migrate at all versus starting fresh, browsing [the full catalog](/browse) first is worth ten minutes — sometimes the fastest path off Elementor is importing a validated Divi 5 section rather than converting the old one. And once your site is on Divi 5, see [Free vs Premium Divi Layouts](/guides/free-vs-premium-divi-layouts) for how the free catalog and the Pro plugins fit together, or check current [pricing](/pricing) for the full toolkit.
