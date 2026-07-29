# Divi Cross-Site Clipboard v2: Global Resolution via Divi's Own Endpoints (Design)

**Date:** 2026-07-28
**Status:** Design, POC-gated. Supersedes the load half of
`2026-07-28-divi-cross-site-clipboard-extension-design.md`; the capture/history/
IDB/popup halves of v1 are reused as-is.
**Type:** Evolution of the existing standalone extension
`/Users/Lucas/Documents/JHMG-Local/divi5-copy-paste-extension` (its own repo),
plus a small hosted cloud relay.

---

## 1. Why v2

v1 proved cross-site *paste* cannot work by teleporting the clipboard entry alone:
a Divi 5 element references site-global **presets** and **global colors** by id,
and every Divi representation (clipboard, saved `post_content`, export) keeps those
as references. The definitions live server-side in `wp_options`. On a destination
site those ids are dangling, so Divi silently refuses the paste.

v2's thesis: an extension running in the builder is the **logged-in admin**, so it
can make **authenticated calls to Divi's own endpoints**, including the endpoints
the builder itself uses to read and save global colors and presets. So the
extension can recreate the missing globals on the destination via Divi's supported
server-side code, without a custom plugin on either site.

**This thesis is unproven and POC-gated (see Section 8).** If Divi does not expose
usable read/save endpoints for globals, v2 is not achievable as an extension and
the fallback is a plugin-on-both-sites design (out of scope here).

## 2. Goals / non-goals

**Goals**
- Seamless cross-site copy/paste of Divi 5 module/row/section/page with global
  presets and global colors preserved.
- Extension-only: no custom WordPress plugin on any site.
- Cloud relay transport: a shared clipboard with history, cross-machine, and a
  license gate.
- Chromium + Firefox, one codebase.

**Non-goals (v2.0)**
- Team sharing (relay is designed to allow it later; not built now).
- Media/image transfer fidelity beyond referencing source URLs (tracked as a known
  limitation; revisit after core works).
- Plugin fallback design (documented as the alternative if the POC fails, not
  specced here).

## 3. What is reused from v1 (already built, 22 tests passing)

- WXT + TS + Vitest scaffold, cross-browser build.
- `lib/d5clipboard.ts` (IndexedDB names), `lib/d5-idb.ts` (read/write D5Clipboard,
  connection-closing), `lib/clipboard-ops.ts` (parse/serialize).
- Capture: content-script IDB polling, position-agnostic new-entry detection.
- `lib/history.ts`, `lib/history-store.ts`, `lib/labels.ts`, `lib/entry.ts`.
- Popup picker (`entrypoints/popup`), background hub (`entrypoints/background.ts`).

v2 keeps the capture and history exactly. It replaces the naive "write entry and
hope" load path with a resolve-and-recreate load path.

## 4. Architecture

Four parts:

### 4.1 Divi endpoint adapter (`lib/divi-api.ts`) — the new core
The single module that knows Divi's server-side endpoints (discovered by the POC
capture). Isolated so a Divi change means editing one file (same pattern as
`d5clipboard.ts`). Responsibilities:
- `readGlobalColors(): Promise<GlobalColor[]>` and `readPresets(ids): Promise<Preset[]>`
  (read the definitions the copied element references).
- `ensureGlobalColors(colors)` and `ensurePresets(presets)` (create them on the
  destination if missing, via Divi's authenticated save endpoints; idempotent).
- Uses the builder page's nonce + admin cookies (the extension is the admin).
- Every call funnels through a small fetch helper that attaches the nonce and
  fails quietly + safely (never corrupts the destination).

### 4.2 Portable payload builder (`lib/payload.ts`, pure/testable)
On copy: given the D5Clipboard entry + the globals it references, produce a
self-describing `PortablePayload`:
```
PortablePayload = {
  entry: DiviClipboardEntry,        // the element, references intact
  presets: Preset[],                // definitions of referenced presets
  globalColors: GlobalColor[],      // definitions of referenced gcid tokens
  meta: { sourceHost, diviVersion, copiedAt, type, label }
}
```
Pure functions: extract referenced preset ids and `gcid-` tokens from an entry;
assemble the payload; validate a payload's shape.

### 4.3 Cloud relay (hosted)
Small service on the existing Vercel/Stripe stack. Stores `PortablePayload`s keyed
to the user's license/account. Endpoints:
- `POST /clip` (store a payload, returns id) — license-gated.
- `GET /clips` (list recent for this user) — powers the cross-site history.
- `GET /clip/:id` (fetch one).
Gives history, cross-machine, and the license checkpoint. Payloads are JSON;
size-capped. Auth via the user's license key held in the extension.

### 4.4 Extension flow
- **Copy (source):** capture entry (v1) -> `payload.ts` extracts referenced global
  ids -> `divi-api.readGlobalColors/readPresets` fetches their definitions ->
  assemble `PortablePayload` -> `POST /clip` to relay -> also mirror to local
  history.
- **Paste (destination):** user picks from popup history (relay-backed) -> fetch
  payload -> `divi-api.ensureGlobalColors/ensurePresets` recreate missing globals
  -> write `payload.entry` into D5Clipboard (v1 mechanism, references now resolve)
  -> coach the reload -> user pastes.

## 5. Licensing

Reuse the existing licensing approach used by Lucas's other products (license key
entered in the extension options, validated by the relay). Free tier optional
(e.g. same-machine only) vs paid (cloud/cross-machine). Exact tiers TBD with Lucas;
the relay is the gate.

## 6. Fragility and safety

- All Divi-endpoint knowledge is isolated in `lib/divi-api.ts` with a version note.
  Divi updates may require updating it (accepted; same deal as v1's IDB names).
- `ensure*` operations must be **idempotent** and **non-destructive**: never
  overwrite an existing destination global with the same id; only create missing
  ones. Never touch layout content directly.
- If any resolve/recreate step fails, abort the paste cleanly with a clear message;
  never leave the destination half-modified in a way that breaks the builder.

## 7. Known limitations (v2.0)

- Global-color id collisions: if the destination already has a *different* color
  under the same `gcid-`, we do not overwrite it; the pasted element uses the
  destination's value (documented behavior).
- Images/media reference source URLs; not re-uploaded to the destination media
  library in v2.0.
- Same reload-after-load step as v1 (write to IDB then reload the builder).

## 8. POC gate (must pass before building the relay or full flow)

**Milestone 0, done manually/scripted from the extension in a dev build, no relay:**
1. On Site A: copy an element that uses a global color and a preset. Capture the
   entry + read the referenced global color + preset via the endpoints from the
   network capture.
2. On Site B: via `divi-api.ensureGlobalColors/ensurePresets`, create those globals
   using Divi's authenticated endpoints. Verify (reload) they now exist on Site B.
3. Write the (reference-intact) entry into Site B's D5Clipboard, reload, paste.
4. **Success = the element pastes on Site B with its preset/global-color styling
   intact.**

If Milestone 0 passes, proceed to the plan (relay + full flow, TDD). If it fails
(no usable endpoints, or Divi still refuses), stop: extension-only is not viable
and we escalate to Lucas for the plugin-on-both decision.

## 9. Open items
- The exact Divi 5 endpoints for read/save global color and preset (from the
  network capture in progress).
- Whether reading globals needs an endpoint at all or they are available in the
  builder runtime (either is fine; endpoint is more robust).
- License tiers (free vs paid split).
- Media handling (deferred).
