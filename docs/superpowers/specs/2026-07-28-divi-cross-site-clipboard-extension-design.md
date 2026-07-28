# Divi Cross-Site Clipboard — Browser Extension (Design)

**Date:** 2026-07-28
**Status:** Approved design, ready for implementation plan
**Type:** Standalone product (separate repo/distribution from the Divi5Lab marketplace and the AI Editor plugin). This spec lives here for continuity; the extension itself is its own codebase.

---

## 1. Summary

A free, standalone Chromium + Firefox browser extension that gives Divi 5 users
**cross-site copy/paste with a clipboard history**. It is fully client-side: no
backend, no account, no cloud, no plugin installed on any WordPress site.

It works by exploiting one fact: Divi's copy/paste stores the copied layout as a
JSON blob in the page's `localStorage`, and `localStorage` is scoped per-origin
(per domain). That per-origin scoping is exactly why Divi's native copy cannot
cross sites. Extension storage is **not** origin-scoped, so the extension acts as
a shared channel: it captures the blob when you copy on Site A, keeps a labeled
history, and writes a chosen blob back into Divi's clipboard slot on Site B so
Divi's **native paste** picks it up.

We move the blob. Divi does the actual paste.

## 2. Goals / non-goals

**Goals**
- Copy a Divi module, row, section, or whole page on one site and paste it on a
  different site, in the same browser.
- Keep a browsable history of recently copied items (not just the last one).
- Zero install on the WordPress sites. Zero account. Zero backend.
- Ship on Chromium (Chrome/Edge) and Firefox.

**Non-goals (v1, YAGNI)**
- No cross-machine / cross-browser sync (that would require a backend; explicitly
  out of scope, see Positioning).
- No team sharing.
- No visual thumbnails (text labels only).
- No pinning or manual renaming of history items.
- No direct/auto paste into the page (we load into Divi's clipboard; the user
  pastes natively).

## 3. Positioning

Same-browser, free, and clean. Marketed as the **cross-site reuse** answer for
Divi builders, with **clipboard history** as the hero feature.

We deliberately do **not** brand this as a "Divi Cloud replacement." Divi Cloud's
core value is cloud sync across machines and teams; this extension is
same-browser-only and cannot honor that promise without the backend we are
choosing not to build. Overpromising there produces empty-history surprise on a
second machine and 1-star reviews on a free product. Suggested framing:
**"Divi Cloud's cross-site copy/paste, free, no account, no cloud."**

### Competitive context
The paid alternatives (Divi Essential's "Live Copy Paste", DiviBuilderAddons'
CCPS) are **WordPress plugins** that must be installed and configured on every
site, and toggled per element. Our edge:

| | Paid plugins (Divi Essential / CCPS) | This extension |
|---|---|---|
| Install | Plugin on every site (source + destination) | Once in the browser, nothing on the sites |
| Setup | Per-element "Live Copy" toggle | None; it just watches |
| Reach | Only sites where the plugin is installed/configured | Any Divi site you open in the builder |
| History | No (last-copied passthrough) | Yes, labeled history |
| Price | Paid bundle | Free |

**Honest caveat:** the paid plugins can copy off a rendered **frontend**; this
extension reads the builder's clipboard, so copying happens **inside the Divi
builder**. For people building sites that is where they already work, so it is
not a meaningful loss, but it is the one thing the plugins do that we do not.

**Business role:** free utility used as a lead magnet / top-of-funnel for the
paid AI Editor for Divi 5. The popup links to the AI Editor. No license check,
no paid tier (a paid tier would require a backend and break "clean/free").

## 4. Architecture

Three parts with clean, single-purpose boundaries.

### 4.1 Content script (+ MAIN-world shim) — "talk to Divi"
Injected into pages running the Divi builder. Responsibilities:
- **Capture:** `localStorage` does not fire a `storage` event in the same tab
  that wrote the value, so passive listening does not work. A tiny shim is
  injected into the **page's own JS context (MAIN world)** that wraps
  `localStorage.setItem`. When Divi writes to its clipboard key, the shim sees
  the value immediately and forwards it to the extension (isolated-world content
  script -> background). Polling the key on a timer is the fallback only if the
  shim fails; it is laggy and wasteful, so it is not the default.
- **Load:** on request from the popup/background, write a chosen item's JSON back
  into Divi's clipboard `localStorage` key so Divi's native paste consumes it.
- The content script never mutates page/layout content directly. It only reads
  and writes Divi's own clipboard key.

### 4.2 Background service worker — "own the data"
- Receives captured items from the content script.
- Builds the text label from the Divi JSON (type, element count, source host,
  time).
- Stores, dedupes, and trims the history in `chrome.storage.local`.
- Serves the history to the popup and relays "load this item" requests to the
  active tab's content script.

### 4.3 Popup UI — "show the data"
- Renders the history list: each row shows its label, a **Load** button, and an
  **×** delete control.
- A persistent one-line coaching hint at the bottom (so first-timers understand
  the flow before clicking).
- A **Clear all** control.
- A link to the AI Editor for Divi 5 (funnel).

## 5. Data model

History item stored in `chrome.storage.local`:

```
{
  id: string,            // stable unique id
  type: "module" | "row" | "section" | "page",
  label: string,         // derived, e.g. "Section · 3 rows · from site-a.com · 2m ago"
  diviJson: string,      // the exact blob Divi uses on its clipboard
  sourceHost: string,    // origin/host the item was copied from
  copiedAt: number       // timestamp
}
```

- **History size:** keep the last **50** items; oldest trims off. Bounded so
  storage stays small.
- **Dedupe:** identical consecutive captures of the same blob do not create
  duplicate entries.

## 6. Two capture paths (typed items)

- **module / row / section** — all ride Divi's `localStorage` clipboard key; one
  mechanism (the MAIN-world shim).
- **page (whole layout)** — Divi does not put a full page on the clipboard the
  same way; the full-page representation is the **portability export** (page-level
  JSON). This needs a second hook: intercept Divi's page-export, or pull the full
  layout from the builder state, and store it as a `type: "page"` item. Loading a
  page item uses the whole-page path rather than the paste-a-section path.

The item `type` is captured at capture time and drives both the label and the
correct load behavior.

## 7. The Divi clipboard key (known fragility)

Everything hinges on Divi's clipboard `localStorage` key name (and the page-export
mechanism). These are Divi's, not ours.

- The key name is isolated as a **single named constant** with a **fallback list**.
- If Elegant Themes renames it in a Divi update, **capture stops** until we ship
  an updated constant. This is accepted: if Divi changes it, we rewrite/update the
  extension.
- Failure mode is **quiet and safe**: capture simply stops. Because the extension
  only ever touches Divi's clipboard key and its own storage, a Divi change can
  break capture but can **never corrupt a layout**.
- **First implementation task:** inspect a live Divi 5 copy to confirm the actual
  clipboard key name and the whole-page export shape.

## 8. Cross-browser

- Manifest V3 WebExtension, shared codebase.
- Chromium (Chrome/Edge) and Firefox. The WebExtension API is shared; expected
  divergence is limited to manifest details and background/service-worker
  handling on Firefox. Any real fork is flagged in the implementation plan.
- Two store listings (Chrome Web Store, Firefox Add-ons).

## 9. UX flow

1. In the Divi builder on Site A, the user copies a module/row/section (or exports
   a page). The shim captures it; it appears at the top of history with a label.
2. On Site B's Divi builder, the user opens the extension popup, sees the history,
   and clicks **Load** on an item.
3. The clicked row shows an inline confirmation, e.g. **"Loaded ✓ — now
   right-click -> Paste in Divi."** A persistent one-liner at the bottom of the
   popup states the same for first-timers.
4. The user pastes the native Divi way (right-click -> Paste, or the paste button).
   Divi enforces valid paste targets/placement; the extension does not.

## 10. Testing & safety

**Unit tests (pure logic):**
- Label generation from Divi JSON (type, counts, host, relative time).
- History trim (cap at 50) and consecutive-dedupe logic.
- Item serialization / storage shape.

**Manual test matrix (two local Divi 5 sites, A and B):**
- For each of module / row / section / page: copy on A -> item appears in history
  with correct label/type -> **Load** on B -> native paste succeeds and matches.
- Divi paste-target rules still enforced by Divi (e.g. cannot paste a section
  inside a row).

**Safety invariants:**
- The extension only reads/writes Divi's own clipboard key and its own
  `chrome.storage.local`. It never writes page/layout content directly.
- A Divi update can break **capture**; it can never **corrupt** a layout.

## 11. Open items for the implementation plan
- Confirm the exact Divi 5 clipboard `localStorage` key name (+ fallbacks).
- Confirm the whole-page capture mechanism (intercept export vs. read builder
  state) and its JSON shape.
- Decide the repo location / project name for the standalone extension.
- Firefox manifest/background divergence specifics.
