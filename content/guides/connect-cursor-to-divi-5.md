---
title: How to Connect Cursor (or VS Code Copilot) to Divi 5
description: Connect Cursor's agent mode or VS Code Copilot to a Divi 5 site over MCP and edit real pages from your editor, with every change validated first.
date: 2026-07-12
keywords: cursor divi, divi 5 mcp, cursor agent mode wordpress, vs code copilot divi
---

Cursor and VS Code Copilot are built for editing code, but both now speak **MCP (Model Context Protocol)** — the standard that lets an AI assistant discover and call tools exposed by an external server. The [AI Editor for Divi 5](/plugins/divi-5-ai-editor) plugin exposes your WordPress site as one of those servers, so an editor you already use for everyday development can also read and edit your Divi 5 pages in plain English, with a deterministic validator standing between the AI and your database.

This guide covers both editors, since they share the same underlying idea and mostly differ in where the config file lives.

## Prerequisites

- Divi 5 (Divi 4 won't work — the plugin targets Divi 5's module schema specifically) on WordPress 6.0+ and PHP 8.1+.
- The [AI Editor for Divi 5](/plugins/divi-5-ai-editor) plugin installed and active. Free tier is sufficient for everything in this guide.
- Cursor or VS Code with the Copilot extension, whichever you use day to day.

## Step 1: Get the connection details

In WP admin, open the **AI Editor** menu, then click the **Settings** tab (the page opens on the Dashboard tab by default — the connection panel lives under Settings). The connection panel gives you your site's MCP URL (`https://yoursite.com/wp-json/ai-editor-divi5/v1/mcp`), an API key to use as a Bearer token, and a config snippet you can paste directly — you don't need to hand-assemble the JSON yourself.

## Step 2: Add the server in Cursor

Cursor reads MCP servers from `.cursor/mcp.json` in your project, or you can configure it globally through **Settings → MCP**. Either add a new entry to that file with the URL and Bearer key from the plugin's snippet, or use the Settings UI if you prefer a form over hand-editing JSON — both write to the same config.

Once saved, open Cursor's **agent mode** (as opposed to plain inline chat) — this is the mode that actually calls tools rather than just suggesting text, and it's what you want here. You should see the Divi tools listed as available before you send your first prompt.

## Step 2 (alternative): Add the server in VS Code Copilot

VS Code Copilot has its own MCP configuration, managed through the Copilot settings rather than a project file — check **Settings → Copilot → MCP Servers** (the exact location shifts between VS Code releases, so search "MCP" in settings if the path has moved). Paste the URL and API key from the same connection panel. Copilot's agent mode is the one that calls tools; standard chat mode won't reach the plugin.

## Step 3: Try it

Whichever editor you're in, start with something low-stakes to confirm the connection before asking for real changes:

- **"List my Divi pages."** Confirms the tools are actually wired up.
- **"Show me the layout of my Home page."** A read-only check — nothing changes yet.
- **"Change the hero heading on Home to 'Built for speed, priced for growth.'"** The real test: watch the agent propose the edit and report back what happened.

## Why agent mode matters

Both Cursor and Copilot distinguish between a chat mode that only talks and an **agent mode** that can actually invoke tools and act on their results. MCP tool calls only happen in agent mode — if you're in plain chat and ask Cursor to change your hero heading, it'll describe what it would do rather than doing it, because it has no tool access in that mode. If your first prompt gets a description instead of an action, that's almost always the fix: switch modes, not troubleshoot the connection.

## The validator is doing the real safety work

Whichever tool proposes the edit, the request lands on the same plugin backend, and every layout change passes through a **deterministic validator** before it's written to your site. If the proposed change doesn't match Divi 5's real module schema — malformed attributes, invalid nesting, a missing required field — the validator rejects it and returns the exact violation, which the assistant uses to correct itself and retry. This is the same validator that gates every layout in [our catalog](/browse) before publication (see [Divi 5 Design Tips](/guides/divi-5-design-tips) for the design rules layered on top of pure structural validity). It means an agent that's confidently wrong about Divi's schema still can't leave your page broken — the change simply doesn't save.

## Free vs. Pro

Free covers listing pages, reading pages, updating existing ones, dry-run validation, and the plugin's bundled guides — plenty for iterating on a site that already exists, which is most of what developers use an editor-based workflow for anyway.

**Pro** ($79/yr, unlimited sites on one license) adds the tools that build rather than edit: creating new pages, setting the front page, assembling the primary menu, site-wide custom CSS, and reviewed PHP snippet proposals. If you're scaffolding a new site section entirely from an agent prompt, that's Pro territory — full comparison on the [plugin page](/plugins/divi-5-ai-editor).

## Troubleshooting

**Tools aren't showing up.** Confirm you're in agent mode, not chat mode — this is the single most common cause in both editors.

**Config changes aren't taking effect.** Restart the editor fully; MCP server lists are typically read once at startup.

**Edits keep getting rejected.** Ask the agent to show the validator's violation message — it's specific enough to tell you exactly what about the proposed layout was invalid, and the agent should retry with that information.

Ready to try it? [Get the AI Editor for Divi 5](/plugins/divi-5-ai-editor) — the free tier edits existing pages; Pro builds whole sites.
