---
title: How to Connect ChatGPT to Divi 5 (Custom GPT + Actions)
description: Build a Custom GPT with Actions that edits your Divi 5 site, using the AI Editor plugin's OpenAPI spec and a Bearer API key over HTTPS.
date: 2026-07-12
keywords: chatgpt divi, divi 5 custom gpt, chatgpt actions wordpress, openapi divi editor
---

Claude Desktop and Cursor connect to the [AI Editor for Divi 5](/plugins/divi-5-ai-editor) plugin over **MCP**, but ChatGPT doesn't speak that protocol yet — it uses **Actions**, which call an HTTP API described by an **OpenAPI spec**. The plugin exposes both interfaces from the same backend, so a Custom GPT with Actions gets most of the same tools — list pages, read layouts, propose edits, all gated by the same deterministic validator — just wired up a different way. A couple of Pro tools (site-wide custom CSS and PHP snippet proposals) are MCP-only and aren't exposed over Actions; see "Free vs. Pro" below. This guide walks through that setup.

## Prerequisites

- Divi 5 (not Divi 4) on WordPress 6.0+ and PHP 8.1+.
- The [AI Editor for Divi 5](/plugins/divi-5-ai-editor) plugin installed and active.
- Your site reachable over **public HTTPS**. This is the one hard requirement that's different from the Claude/Cursor setup: ChatGPT calls your site's API from OpenAI's servers, not from your own machine, so `localhost` or an unreachable staging box won't work. A real domain with a valid SSL certificate is required.
- A ChatGPT plan that supports Custom GPTs with Actions.

## Step 1: Get the OpenAPI spec URL and API key

In WP admin, open the **AI Editor** menu, then click the **Settings** tab (the page opens on the Dashboard tab by default — the connection panel lives under Settings). The same connection panel used for the MCP setup also shows an **OpenAPI spec endpoint** for exactly this use case, plus your **API key**. Copy both; you'll need the spec URL to configure the Action and the key for its authentication.

## Step 2: Create a Custom GPT

In ChatGPT, go to **Explore GPTs → Create** (or **My GPTs → Create a GPT**). Give it a name and description — something like "Divi 5 Site Editor" — so you can tell it apart from other GPTs later. You don't need to write elaborate instructions; the Actions schema itself tells the GPT what tools exist and what they do.

## Step 3: Add the Action

In the GPT editor, scroll to **Actions** and click **Create new action**. Rather than pasting the schema by hand, use **Import from URL** and paste the OpenAPI spec URL from your connection panel — ChatGPT fetches the spec and populates every available operation automatically (listing pages, reading layouts, updating pages, and so on, matching whatever tier your license unlocks).

## Step 4: Set authentication

Still in the Actions editor, set **Authentication** to **API Key**, auth type **Bearer**, and paste the API key from the connection panel. This is what proves every request to your site actually comes from you — treat the key like a password and don't paste it anywhere public, including a GPT's public-facing description or instructions field.

## Step 5: Save and test

Save the GPT, then start a conversation with it. Try the same low-stakes prompts you'd use anywhere else:

- **"List my Divi pages."** Confirms the Action is wired correctly and the API key works.
- **"Show me the layout of my Home page."** Read-only, safe to run anytime.
- **"Change the hero heading on Home to 'Built for speed, priced for growth.'"** The real test — watch how the GPT reports the result.

If the first call fails, ChatGPT will usually show you the raw HTTP error, which is the fastest way to tell an auth problem (wrong key, expired key) from a reachability problem (site not actually public over HTTPS).

## Why the validator still protects you here

Actions and MCP are just two doors into the same house. Whether the request comes from Claude over MCP or from your Custom GPT over an Action, every proposed layout change passes through the plugin's **deterministic validator** before anything is saved. An invalid change — a malformed attribute, impossible nesting, a missing required field against Divi 5's real module schema — gets rejected with the exact violation message, and the GPT can use that to retry rather than leaving your page half-broken. This is the identical validator that gates every layout in [our catalog](/browse) before it goes live; see [Divi 5 Design Tips](/guides/divi-5-design-tips) for the design conventions layered on top of raw structural correctness. The transport changes; the safety net doesn't.

## Free vs. Pro

The **free tier** gives your Custom GPT the ability to list pages, read layouts, update existing ones, run dry-run validation, and pull the plugin's built-in style, site, and section guides — enough to have ChatGPT genuinely maintain a site that already exists.

**Pro** ($79/yr, one license across unlimited sites) adds the Actions for creating new pages, setting the front page, and building the primary menu. If your GPT needs to spin up a whole new page rather than edit an existing one, that's the Pro line. Two other Pro tools — site-wide custom CSS and reviewed PHP snippet proposals — are MCP-only for now and aren't available over Actions, so they need an MCP-based assistant like Claude or Cursor instead; details on the [plugin page](/plugins/divi-5-ai-editor).

## Troubleshooting

**"Could not reach your site" during import.** Your site isn't publicly reachable over HTTPS, or the spec URL is wrong — check both from a browser you're not logged into.

**401/403 errors on every call.** The Bearer key wasn't saved correctly in the Action's auth settings, or it was regenerated on the WordPress side after you configured the GPT — copy a fresh one.

**The GPT describes a change instead of making it.** Confirm the Action actually saved (re-open the GPT editor and check the Actions tab shows operations imported) rather than the conversation silently falling back to a plain-text answer.

Ready to try it? [Get the AI Editor for Divi 5](/plugins/divi-5-ai-editor) — the free tier edits existing pages; Pro builds whole sites.
