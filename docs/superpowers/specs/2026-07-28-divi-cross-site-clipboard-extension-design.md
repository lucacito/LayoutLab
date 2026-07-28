# Divi Cross-Site Clipboard: Browser Extension (Design)

**Date:** 2026-07-28 (revised same day after live Divi 5 inspection)
**Status:** Approved design, ready for implementation plan
**Type:** Standalone product in its own separate repo/folder, `divi5-copy-paste-extension` (distinct from the Divi5Lab marketplace and the AI Editor plugin). This spec lives here for continuity; the extension itself is its own codebase.

---

## 1. Summary

A free, standalone Chromium + Firefox browser extension that gives Divi 5 users
**cross-site copy/paste with a clipboard history picker**. It is fully
client-side: no backend, no account, no cloud, no plugin installed on any
WordPress site.

**How Divi 5 actually stores the clipboard (confirmed by live inspection):** Divi 5
does NOT use `localStorage` (that was Divi 4). It uses an **IndexedDB** database
named `D5Clipboard`, with a single object store `clipboard` holding three records:

- `items`: a JSON **string** that parses to an **array of clipboard entries**.
  Each entry looks like:
  `{ clipboardType: "module", origin: "<uuid>", payload: { moduleIds: ["<uuid>"], moduleType: "row" | "section" | <module type>, moduleObjects: { "<uuid>": { children: [...], ...attrs } } } }`
  The real element type is in `payload.moduleType`; `moduleObjects` is the full
  nested tree. Divi keeps multiple past entries here (observed ~14).
- `timestamp`: an integer (ms) updated on each copy.
- `lastDependencyChange`: an integer.

IndexedDB is origin-scoped (per domain), which is exactly why Divi's native copy
cannot cross sites. The extension acts as the shared channel: it reads
`D5Clipboard` on Site A, keeps a cross-site history of entries, and writes a
chosen entry back into `D5Clipboard` on Site B so Divi's **native paste** uses it.

We move the entry. Divi does the actual paste.

**Confirmed Divi behavior (from the site owner):**
- Divi's paste uses **only the last/current item**; there is **no clipboard
  history UI** in Divi. (So a cross-site history picker is genuinely new.)
- A copied item **survives a full builder reload**, i.e. Divi reads its clipboard
  from IndexedDB on builder load. This makes the load path reliable (see 9).

## 2. Goals / non-goals

**Goals**
- Copy a Divi module, row, section, or whole page on one site and paste it on a
  different site, in the same browser.
- Expose a browsable history picker of recently copied items (Divi exposes none).
- Zero install on the WordPress sites. Zero account. Zero backend.
- Ship on Chromium (Chrome/Edge) and Firefox.

**Non-goals (v1, YAGNI)**
- No cross-machine / cross-browser sync (that would require a backend; explicitly
  out of scope, see Positioning).
- No team sharing.
- No visual thumbnails (text labels only).
- No pinning or manual renaming of history items.
- No direct/auto paste into the page (we place the entry as Divi's current
  clipboard; the user pastes natively).

## 3. Positioning

Same-browser, free, and clean. Marketed as the **cross-site reuse** answer for
Divi builders, with the **cross-site clipboard history picker** as the hero
feature (Divi 5 stores past copies internally but gives users no picker and pastes
only the last item, so both the picker and the cross-site reach are things Divi
does not provide).

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
| History picker | No | Yes, cross-site |
| Price | Paid bundle | Free |

**Honest caveat:** the paid plugins can copy off a rendered **frontend**; this
extension reads the builder's IndexedDB clipboard, so copying happens **inside the
Divi builder**. For people building sites that is where they already work, so it
is not a meaningful loss, but it is the one thing the plugins do that we do not.

**Business role:** free utility used as a lead magnet / top-of-funnel for the
paid AI Editor for Divi 5. The popup links to the AI Editor. No license check,
no paid tier (a paid tier would require a backend and break "clean/free").

## 4. Architecture

Three parts with clean, single-purpose boundaries. Because Divi uses IndexedDB
(which content scripts can access directly on the page's origin), there is **no
MAIN-world script injection** anywhere. This removes the most fragile part of the
original design.

### 4.1 Content script: "talk to Divi's IndexedDB"
Injected into pages running the Divi builder. Responsibilities:
- **Capture:** IndexedDB has no cross-context change event, so the content script
  polls the small `timestamp` record on a light interval (about 1s) while on a
  builder page. When `timestamp` changes, it reads `items`, and forwards any new
  entries to the background.
- **Load:** on request, open `D5Clipboard`, place the chosen entry as Divi's
  current/last clipboard item, write `items` back, and bump `timestamp`.
- The content script only reads/writes the `D5Clipboard` database. It never mutates
  page/layout content directly.

### 4.2 Background service worker: "own the cross-site history"
- Receives new entries from the content script.
- Derives the label from the entry (`payload.moduleType` + child count from
  `moduleObjects`).
- Stores, dedupes, and trims the history in `browser.storage.local`.
- Serves the history to the popup and relays "load this entry" to the active tab.

### 4.3 Popup UI: "the picker"
- Renders the history list: each row shows its label, a **Load** button, and an
  **×** delete control.
- After Load, an inline coaching line: "Loaded, now reload the Divi builder and
  paste." A persistent one-liner at the bottom states the same for first-timers.
- A **Clear all** control and a link to the AI Editor for Divi 5 (funnel).

## 5. Data model

Divi's clipboard entry (what we read from and write to `D5Clipboard.clipboard.items`):
```
DiviClipboardEntry = {
  clipboardType: "module",
  origin: string,           // uuid
  payload: {
    moduleIds: string[],
    moduleType: string,     // "row" | "section" | a module type | (page: TBD by fixture)
    moduleObjects: Record<string, { children?: string[], [attr: string]: unknown }>
  }
}
```

Our history item stored in `browser.storage.local`:
```
HistoryItem = {
  id: string,               // our stable id
  type: "module" | "row" | "section" | "page",  // mapped from payload.moduleType
  label: string,            // derived, e.g. "Row · 4 modules · from site-a.com · 2m ago"
  entry: DiviClipboardEntry,// the exact Divi entry, re-injected verbatim on load
  sourceHost: string,
  copiedAt: number
}
```

- **History size:** keep the last **50** items; oldest trims off.
- **Dedupe:** an entry whose `origin` (or serialized payload) matches the newest
  existing item is not duplicated.

## 6. Item types

The type comes from `payload.moduleType`:
- `section`, `row`, and single modules map to `section` / `row` / `module`.
- **Whole page:** determined by fixture during implementation (either a distinct
  `moduleType` for a full layout, or a full-page copy that yields a `section`-set).
  Child counts come from walking `moduleObjects`.

## 7. Known fragility

Everything hinges on Divi's IndexedDB names and entry shape, which are Divi's, not
ours.

- The database/store/record names and the entry field paths are isolated as named
  constants (`lib/d5clipboard.ts`).
- If Elegant Themes changes them in a Divi update, **capture/load stops** until we
  update those constants. Accepted: if Divi changes it, we update the extension.
- Failure mode is **quiet and safe**: the extension only ever reads/writes the
  `D5Clipboard` database and its own `browser.storage.local`, so a Divi change can
  break capture/load but can **never corrupt a layout**.

## 8. Cross-browser

**One codebase, two packaged builds.** Not two separately maintained extensions.

- Manifest V3 WebExtension. All logic (content script, background, popup, history,
  labels, IndexedDB access) is written once and normalized across `chrome.*` /
  `browser.*` via WXT's `browser` global.
- A small build step emits two artifacts (`build:chrome`, `build:firefox`) that
  differ only in a handful of manifest keys (Chrome service-worker background vs.
  Firefox `browser_specific_settings` add-on id).
- IndexedDB access from a content script works identically in both browsers, so
  the capture/load core is fully shared with no per-browser forks.
- Two store listings (Chrome Web Store, Firefox Add-ons); one source tree.

## 9. UX flow

1. In the Divi builder on Site A, the user copies a module/row/section (or a whole
   page). The content script sees `timestamp` change, reads the new entry, and it
   appears at the top of the history with a label.
2. On Site B's Divi builder, the user opens the popup, sees the history, and clicks
   **Load** on an item.
3. The extension writes that entry as Divi's current clipboard item in Site B's
   `D5Clipboard`. The row shows: "Loaded, now reload the Divi builder and paste."
4. The user **reloads the builder** (Divi reads its clipboard from IndexedDB on
   load, confirmed) and pastes the native Divi way (right-click Paste, or
   Ctrl/Cmd+V). Divi enforces valid paste targets; the extension does not.

**Reload note:** the reload step is the guaranteed path because copied items
survive a reload. During implementation we test whether Divi picks up the injected
entry **without** a reload (live re-read on paste); if it does, the reload step is
dropped from the coaching copy.

## 10. Testing & safety

**Unit tests (pure logic):**
- Type mapping + label generation from a Divi clipboard entry (type from
  `payload.moduleType`, child count from `moduleObjects`, relative time).
- History trim (cap 50) and dedupe logic.
- Entry serialization / round-trip (the entry we store equals the entry we
  re-inject).

**Manual test matrix (two local Divi 5 sites, A and B):**
- For each of module / row / section / page: copy on A, item appears in history
  with correct label/type, **Load** on B, reload builder, paste succeeds and
  matches. Also test the no-reload case to decide whether reload is required.

**Safety invariants:**
- The extension only reads/writes the `D5Clipboard` database and its own
  `browser.storage.local`. It never writes page/layout content directly.
- A Divi update can break capture/load; it can never corrupt a layout.

## 11. Open items for the implementation plan
- Confirm which array position in `items` is the "current/last" entry Divi pastes
  (front vs back), and whether `timestamp` alone determines it. Determine by
  copying a known element and observing where it lands.
- Confirm the whole-page representation (`payload.moduleType` value or structure).
- Confirm whether paste picks up an injected entry without a builder reload.
- Firefox manifest/background divergence specifics.
