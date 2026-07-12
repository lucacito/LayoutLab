---
title: How to Import a Divi 5 Layout (Step-by-Step)
description: The complete walkthrough for importing a Divi 5 layout JSON file — portability panel, common errors, and how to make an imported section match your site.
date: 2026-07-08
updated: 2026-07-08
keywords: import divi layout, divi 5 json, divi portability, divi layout tutorial
---

Importing a layout is the single most common thing people do with Divi after installing it, and it is also where most "this template is broken" complaints actually come from — not from the file, but from the import path. This guide walks through the whole process for Divi 5, from download to a section that looks native on your site, including the failure modes we see most often.

## What you're importing

A Divi layout ships as a **JSON file**. It isn't a plugin, a theme, or a zip of images — it's a structured description of sections, rows, columns and modules, with all their design settings. When you import it, Divi rebuilds that structure inside your page. Every layout on [Divi5Lab](/divi-layouts) is exactly this kind of file, generated natively for Divi 5 and validated against the builder's real module schema before it's published, so the structure that arrives is the structure you saw in the screenshots.

Two flavors matter in practice:

- **Section layouts** — one hero, one pricing table, one testimonial wall. You'll usually import these *into* an existing page. Browse them by type under [hero sections](/divi-hero-sections), [pricing tables](/divi-pricing-tables), or the full [sections collection](/divi-sections).
- **Full-page layouts** — a complete landing page from hero to footer, imported into an empty page. Find these under [landing pages](/divi-landing-pages).

## Step 1: Download the JSON

From any layout page, click the download button. Free sections ask for an email; the file you receive is complete — no watermark, no locked modules. Keep it somewhere you'll find it again; the [license](/license) allows reuse on unlimited sites, so one download serves many projects.

## Step 2: Open the target page in the Divi builder

Create or edit the page where the layout should live, and enter the Divi 5 builder. If this is a full-page import, start from a blank page — mixing a full-page layout into a page that already has content works, but you'll spend time deleting duplicate heroes and footers afterward.

## Step 3: Use the portability panel

In the builder, open the **portability** options (the up/down arrow icon), switch to the **Import** tab, and choose your JSON file. Divi parses the file and inserts the layout. On a healthy import you'll see the sections appear immediately, fully styled.

One checkbox deserves attention: **"Replace existing content."** Ticked, it wipes the page and inserts the layout — right for full pages, wrong for adding a section. Unticked, the imported sections are appended after your current content, and you drag them into position.

## Step 4: Verify the import

Before styling anything, scroll the whole page at desktop width, then check mobile in the builder's responsive preview. You're looking for three things: every module rendered (no empty gray placeholders), images loaded, and spacing intact at the 390-pixel width where most visitors will actually see the page. Layouts from our catalog are screenshotted at both widths on their product pages — the [layout you downloaded](/browse) should match its screenshots exactly.

## Step 5: Make it yours

Work in this order and you'll avoid redoing things:

1. **Copy first.** Replace headlines, body text and button labels while the design is untouched — it keeps you honest about text length. A headline twice as long as the demo copy will wrap differently, and it's better to discover that before you've restyled everything.
2. **Images second.** Swap demo imagery for your own at similar aspect ratios.
3. **Colors and fonts last.** In Divi 5, prefer editing global presets over per-module overrides — one preset change restyles every button in the layout at once. Our layouts use consistent module styling precisely so preset-level edits propagate cleanly.
4. **Wire the links.** Buttons and menus import with placeholder or empty targets; set real URLs.

## Common problems and their real causes

**"The import button does nothing."** Almost always a file-size limit on the server (`upload_max_filesize` / `post_max_size` in PHP). Full-page layouts with many sections can exceed conservative defaults. Raise the limits or ask your host.

**"Modules look unstyled."** Usually a caching plugin serving stale CSS. Clear the site cache and regenerate Divi's static CSS. If the problem persists in an incognito window, then look deeper.

**"The layout imported but looks nothing like the preview."** Check that you're on Divi 5, not Divi 4 — Divi 5 layouts describe modules and options that the old builder doesn't understand. Everything in [our Divi 5 template catalog](/divi-5-templates) targets the current builder specifically.

**"Fonts are different."** Layouts reference font names; if a font isn't available on your site, Divi falls back. Set your preferred fonts in the global presets after import.

## Building pages from multiple imports

The section-first workflow — import a hero from one layout, pricing from another, an FAQ from a third — is the fastest way to build a page that doesn't look like a template. It works best when the sections share structural standards, which is the point of a validated library: every section in [the catalog](/browse) passes the same deterministic checks, so combining them is a palette-matching exercise, not a repair job. If you'd rather skip the assembly entirely, [full landing pages](/divi-landing-pages) come pre-composed — and like every layout on the site, they're free to download.

## FAQ

**Do I need any plugin besides Divi?** No. Import uses Divi's built-in portability system.

**Can I re-import the same file into several sites?** Yes — the commercial license covers unlimited sites you own or build for clients.

**Will importing overwrite my theme settings?** No. A layout import affects only the page you import into (plus the "replace existing content" toggle described above).

For a broader look at what separates free files worth importing from the ones that waste your evening, see [Free vs Premium Divi Layouts](/guides/free-vs-premium-divi-layouts).
