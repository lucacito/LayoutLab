# AI Editor — Connect panel redesign (per-assistant setup)

**Date:** 2026-07-21
**Repos touched:** `Divi 5 Deterministic Validator` (plugin) + `layoutlab` (guides/readme price fix)
**Status:** Approved design → ready for implementation plan

## Problem

A customer reached the plugin's Settings tab, hit "Connect now," and got a raw
`mcpServers` JSON snippet with a single label ("Add this to Claude Desktop,
Cursor, or VS Code (MCP)") and a one-line ChatGPT note. They reported:

1. **"idk where to put this"** — the panel never says *where* the config file
   lives (no path, no per-client destination, no merge guidance).
2. **"idk why I would put it there"** — no mental model for what the config does.
3. **"I was going to use OpenAI… I deleted my Claude account"** — they believed
   the product requires a Claude account/subscription. It does not: MCP is an
   open standard, and ChatGPT is supported via OpenAPI Actions.

The team already knows users mis-paste the snippet — `tests/McpConfigSnippetTest.php`
has a test commented *"Reproduces the exact bug the user hit."* Yet the UI still
ships the snippet with no merge guidance and no link to the three detailed
`connect-*-to-divi-5.md` guides that already contain the missing instructions.

## Goal

Redesign the Settings → Connection panel into a guided, tabbed "Connect your
assistant" experience that:

- Tells the user exactly **where** each client's config goes.
- States plainly that **MCP is an open standard — no Claude account required**,
  and gives **ChatGPT/OpenAI its own correct path** (Actions, not MCP).
- Keeps everything needed to succeed **inline in wp-admin**, with a
  **"Full guide →"** link out for screenshots/edge cases.

## Scope

**In:**
- `wp-plugin/src/AdminPage.php` — `viewSettings()` Connection card; extend
  `connection()` to return per-client values.
- `wp-plugin/assets/admin.js` — tab switching (progressive enhancement).
- `wp-plugin/assets/admin.css` — tab + panel styles.
- Price fix: `$79/yr → $30/yr` in `wp-plugin/readme.txt:46` and the three
  `layoutlab/content/guides/connect-*-to-divi-5.md` files.
- Tests: `tests/McpConfigSnippetTest.php` (extend) + a render smoke test.

**Out:** REST routes / `McpHandler` / OpenAPI spec (unchanged). Dashboard
"Connect now" button (already deep-links to Settings; copy unchanged). Any
pricing logic (admin card shows no price).

## Design

### 1. Layout — client picker, 5 tabs

Inside the Connection card, below the (unchanged) API-key row, a segmented tab
row:

```
[ Claude ] [ Cursor ] [ VS Code ] [ ChatGPT ] [ Other MCP client ]
```

One panel visible at a time; `admin.js` toggles `hidden`/`is-active`. All five
panels are rendered server-side into the DOM.

**No-JS fallback:** panels are visible by default (CSS) and JS *hides* the
inactive ones on load — so with JS disabled, all panels render stacked, each
under its own visible heading, and remain fully usable. Never rely on a
default-`hidden` state that only JS can remove.

Above the tabs, one reassurance line (fixes confusion #3):

> **MCP is an open standard — it works with any of these assistants. You don't
> need a Claude account or subscription to use it.**

### 2. Per-tab content model

Each **MCP tab** (Claude, Cursor, VS Code, Other) contains:
- A numbered **1-2-3 step list** naming the exact destination.
- The **config snippet** with a **Copy** button (reuses existing `aied-copy-btn`
  / `aied-snippet` markup + JS).
- The **merge warning** (below).
- A **"Full guide →"** link to the matching divi5lab.com guide.

Tab specifics (sourced from the existing guides — do not invent steps):

- **Claude**
  - *Claude Desktop:* paste into `~/Library/Application Support/Claude/claude_desktop_config.json`
    (macOS) / `%APPDATA%\Claude\claude_desktop_config.json` (Windows); fully quit
    and relaunch (not just close the window).
  - *Claude Code (CLI):* one-liner —
    `claude mcp add --transport http ai-editor-divi5 <MCP_URL> --header "Authorization: Bearer <KEY>"`.
    *(Verify exact flag syntax against current Claude Code during implementation;
    if unverifiable, link the guide instead of shipping a wrong command.)*
  - Link → `/guides/connect-claude-to-divi-5`.
- **Cursor** — `.cursor/mcp.json` or Settings → MCP; **use agent mode** (chat mode
  won't call tools). Link → `/guides/connect-cursor-to-divi-5`.
- **VS Code** — Settings → Copilot → MCP Servers (search "MCP" if moved); agent
  mode. Link → `/guides/connect-cursor-to-divi-5`.
- **Other MCP client** — generic MCP URL + Bearer header + snippet; copy note:
  "Works with Windsurf and any MCP Streamable-HTTP client."

The **ChatGPT tab** is visually distinct (it is *not* MCP):
- Lead: "ChatGPT uses **Actions**, not MCP."
- Steps: Create a Custom GPT → Actions → **Import from URL** =
  `openapi.json` spec URL → Authentication = API Key, type **Bearer** → paste key.
- Callout: **requires public HTTPS** — `localhost`/unreachable staging won't work
  (ChatGPT calls from OpenAI's servers).
- Link → `/guides/connect-chatgpt-to-divi-5`.

**Merge warning** (on every MCP tab — the documented real bug):

> Already have MCP servers configured? Paste **only** the inner
> `"ai-editor-divi5": { … }` entry into your existing `mcpServers` object — not
> the whole snippet — or you'll get a nested `mcpServers` and it won't load.

### 3. Snippet generation

`connection()` already returns `key`, `mcpUrl`, `specUrl`, and the `mcpServers`
`snippet`. Extend it to return the per-client values the panels need (URLs, the
Bearer header string, and any client-specific snippet variant).

**Flagged risk — verify per-client snippet *format* during implementation:**
client MCP config shapes genuinely differ. VS Code's `mcp.json` uses a
`"servers"` key with `"type": "http"`, not `"mcpServers"`; Claude Desktop's
remote-HTTP handling has historically needed care. The current single snippet is
shipped identically today, so this redesign does **not introduce** a regression —
but because we are now labeling snippets *per client*, give VS Code its correct
shape rather than reusing the Claude/Cursor `mcpServers` snippet. Anything that
cannot be verified against the real client is recorded as an open item and the
tab links to the full guide rather than shipping a guessed format.

### 4. Price fix

Replace `$79/yr` → `$30/yr` (source of truth: pricing page, plugin page, nav,
ProductDoors all show `$30`):
- `wp-plugin/readme.txt:46`
- `content/guides/connect-claude-to-divi-5.md`
- `content/guides/connect-cursor-to-divi-5.md`
- `content/guides/connect-chatgpt-to-divi-5.md`

### 5. Testing

- `tests/McpConfigSnippetTest.php` stays green; add per-client snippet-shape
  assertions (valid JSON, correct top-level key for each variant).
- Render smoke test of `viewSettings()` asserting: all five tab panels present,
  the "no Claude account needed" reassurance line present, the merge warning on
  MCP tabs, each guide link present, and the ChatGPT public-HTTPS callout present.
- No-JS fallback: assert panels render without a default state that only JS can
  undo.

## Out-of-scope notes

- Guides' Pro feature *lists* are left as-is; only the price string changes.
- No changes to licensing, routes, or the OpenAPI spec.

## Open items (resolve during implementation, don't guess)

- Exact `claude mcp add` flag syntax for current Claude Code.
- Correct per-client snippet format for VS Code (`servers`/`type:http`) and
  Claude Desktop remote HTTP. Link to guide where unverifiable.
