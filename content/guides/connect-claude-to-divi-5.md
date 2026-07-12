---
title: How to Connect Claude to Divi 5 (AI Page Editing via MCP)
description: Step-by-step guide to connecting Claude Desktop to your Divi 5 site with the AI Editor plugin and editing pages in plain English, safely.
date: 2026-07-12
keywords: claude divi, divi 5 ai editor, claude mcp wordpress, edit divi with ai
---

If you've used Claude Desktop for coding or research, you've probably seen it reach for a tool mid-conversation — searching the web, reading a file, running a command. **MCP (Model Context Protocol)** is the open standard that makes that possible: it's a small, structured way for an AI assistant to discover a set of tools a server exposes, call them, and read back the results. The [AI Editor for Divi 5](/plugins/divi-5-ai-editor) plugin turns your WordPress site into exactly that kind of MCP server, so Claude can list your pages, read their layouts, and — with your permission — change them, all without you touching the Divi builder.

This guide walks through connecting Claude Desktop to a Divi 5 site in about five minutes.

## What you need first

- A WordPress site running **Divi 5** (not Divi 4 — the plugin talks to Divi 5's module schema specifically) on **WordPress 6.0+** and **PHP 8.1+**.
- The [AI Editor for Divi 5](/plugins/divi-5-ai-editor) plugin installed and activated. The free tier is enough to follow this whole guide.
- Claude Desktop installed on your machine.

## Step 1: Get your connection details from WordPress

In your WP admin sidebar, open the **AI Editor** menu, then click the **Settings** tab (the page opens on the Dashboard tab by default — the connection panel lives under Settings). The connection panel shows three things you'll need:

1. Your site's **MCP URL** — something like `https://yoursite.com/wp-json/ai-editor-divi5/v1/mcp`.
2. An **API key** (used as a Bearer token) — this is what proves the request came from you, so treat it like a password.
3. A **ready-to-paste config snippet** already filled in with both of the above.

You don't need to construct anything by hand; copy the snippet as-is.

## Step 2: Find your Claude Desktop config file

Claude Desktop reads its MCP server list from a JSON file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

If the file doesn't exist yet, create it — Claude Desktop will pick it up on next launch. If you already have other MCP servers configured (a filesystem server, a GitHub server, whatever), you're adding one more entry to the existing `mcpServers` object, not replacing the file.

## Step 3: Paste the snippet and restart

The plugin's snippet is a **full config file**, not a fragment — it looks like `{"mcpServers":{"ai-editor-divi5":{...}}}`, complete with the outer braces. How you use it depends on what's already in your config file:

- **No config file yet (or it's empty):** paste the snippet exactly as given — the whole thing, outer braces included — as the entire contents of `claude_desktop_config.json`. Save.
- **You already have a config file with other MCP servers in it:** don't paste the whole snippet, or you'll end up with an `mcpServers` object nested inside your existing `mcpServers` object, which Claude Desktop won't read correctly. Instead, copy just the inner entry — the `"ai-editor-divi5": { ... }` part — and add it as a new sibling key inside your existing `mcpServers` object, alongside your other servers, separated by a comma. Save.

Either way, the result should have exactly one top-level `mcpServers` key in the file, with `ai-editor-divi5` as one of its entries.

Quit Claude Desktop fully and relaunch it (not just close the window). On a successful connection, you'll see the Divi tools available when you start a new chat — Claude will mention it can see your site, or you can ask it directly.

Quit Claude Desktop fully and relaunch it (not just close the window). On a successful connection, you'll see the Divi tools available when you start a new chat — Claude will mention it can see your site, or you can ask it directly.

## Step 4: Try your first prompts

Start small so you can see the tools in action before trusting Claude with anything real:

- **"List my Divi pages."** Claude calls the plugin's page-listing tool and shows you what it can see — a good sanity check that the connection actually works.
- **"Show me the layout of my Home page."** Claude reads the page's structure without changing anything.
- **"Change the hero heading on Home to 'Built for speed, priced for growth.'"** This is the real test: Claude proposes a change, and you watch what happens next.

## Why validation matters here

That last prompt is where the plugin earns its keep. Every change Claude proposes — no matter how it's phrased or how the model interpreted your instruction — passes through a **deterministic validator** before anything is written to your database. If the proposed layout violates Divi 5's actual module schema (a malformed attribute, an impossible nesting, a missing required field), the validator rejects it and hands back the exact violation, and Claude uses that message to self-correct and try again. You never end up with a half-broken page because the AI "thought" something was valid Divi markup when it wasn't. This is the same validator used to gate every layout in [our catalog](/browse) before it's published — see [Divi 5 Design Tips](/guides/divi-5-design-tips) for the design rules it enforces alongside structural validity.

Practically, this means you can let Claude make real edits without babysitting the builder afterward to check for breakage. Worst case, an edit gets rejected and Claude tries a different approach; it can't silently corrupt the page.

## Free vs. Pro

The **free tier** covers everything above: listing pages, reading layouts, updating existing pages, dry-run validation, and all of the plugin's built-in guides (style, site structure, section recipes). That's enough for the vast majority of "edit my existing site" work.

**Pro** ($79/yr, one license for unlimited sites) unlocks the tools that create things rather than edit them: building new pages from scratch, setting the site's front page, assembling the primary menu, writing site-wide custom CSS, and proposing reviewed PHP snippets. If you find yourself asking Claude to "build a new pricing page" and it can edit but not create, that's the free/Pro line — see the full breakdown on the [plugin page](/plugins/divi-5-ai-editor).

## Troubleshooting

**Claude doesn't show any tools after restart.** Double-check the JSON is valid (a missing comma anywhere in the file breaks the whole config) and confirm you fully quit Claude Desktop rather than just closing the window.

**"Unauthorized" errors.** The API key was likely mistyped or regenerated — copy it fresh from the AI Editor connection panel.

**Claude can see pages but every edit is rejected.** That's the validator doing its job, not a bug — ask Claude to show you the violation message, which explains exactly what's wrong so it can adjust.

Ready to try it? [Get the AI Editor for Divi 5](/plugins/divi-5-ai-editor) — the free tier edits existing pages; Pro builds whole sites.
