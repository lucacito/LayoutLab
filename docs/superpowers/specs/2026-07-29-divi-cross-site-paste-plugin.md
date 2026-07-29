# Divi 5 Cross-Site Copy/Paste: WordPress Plugin (Design)

**Date:** 2026-07-29
**Status:** Design, ready for build planning. Supersedes the extension approach
(`2026-07-28-divi-cross-site-clipboard-*`), which is proven-blocked at the preset wall.
**Type:** New standalone WordPress plugin (its own repo), installed on source and
destination sites, plus a small transport (cloud relay).

---

## 1. Why a plugin (what the extension proved)

Building the extension established the full Divi 5 model and one hard limit:

- **Colors are solvable client-side** (Divi's `global-data/global-colors` +
  `global-variables` REST endpoints merge partial writes). Proven end-to-end.
- **Presets are not.** Divi refuses to paste an element whose `modulePreset` does
  not resolve to an existing destination preset. Recreating them requires writing
  the **entire** preset set (a real site had 331), and the endpoint **guards
  against partial writes** (`preset_count_decreased`). Writing the full set
  requires **reading** the current set, which Divi exposes **nowhere** the browser
  can reach (no GET, guarded POST, absent from the builder bootstrap, live only in
  app-frame JS memory). Remapping to a universal preset also fails (`_initial` is
  not universal).

**A plugin dissolves this.** Server-side PHP has direct `get_option`/`update_option`
access to Divi's own storage (and can call Divi's PHP manager classes). It can
**read** the full preset + color set, merge in the incoming ones, and **write** the
full valid set, using Divi's own code paths, no REST guards to defeat, no memory
spelunking, and it is robust across Divi versions.

## 2. Goals / non-goals

**Goals**
- Seamless cross-site copy/paste of a Divi 5 element with **presets and global
  colors preserved** (the thing the extension could not do).
- Server-authoritative dependency resolution via Divi's own PHP.
- Chromium + Firefox + any browser (it is a site plugin, not an extension).

**Non-goals (v1)**
- Team sharing (later).
- Fonts / dynamic content / images fidelity beyond a documented baseline (add
  after presets+colors land).

## 3. Architecture

Installed on **both** sites. Each install has a PHP half and a builder-JS half.
Transport moves one payload from source to destination.

### 3.1 Source (copy)
1. Builder JS (enqueued by the plugin) reads the copied element from Divi's
   `D5Clipboard` IndexedDB (mechanism already reverse-engineered: DB `D5Clipboard`,
   store `clipboard`, record `items`, newest entry at the array end).
2. JS POSTs that entry to the plugin's **source REST endpoint**.
3. PHP resolves dependencies: reads the referenced **presets** and **global colors**
   (+ variables) from Divi's server-side storage, and returns a **self-contained
   PortablePayload** `{ entry, presets[], colors{}, variableColors{}, meta{ diviVersion, sourceHost } }`.
4. JS uploads the payload to the transport (relay), keyed to the user/license.

### 3.2 Destination (paste)
1. Builder JS pulls the payload from the transport (a picker UI lists recent items).
2. JS POSTs it to the plugin's **destination REST endpoint**.
3. PHP recreates dependencies non-destructively: reads the destination's current
   presets + colors, **merges** in the payload's, and writes the full valid sets
   back via Divi's own storage/save (satisfying the count guard because PHP sends
   the complete set).
4. JS writes the payload's `entry` into the destination `D5Clipboard` (reference
   intact, now resolvable) and prompts a builder reload; the user pastes natively.

### 3.3 Transport
Cloud relay (small hosted service on the existing Vercel/Stripe stack): `POST /clip`,
`GET /clips`, `GET /clip/:id`, license-gated. Gives history, cross-machine, team
later, and a licensing checkpoint. (Alternative considered: OS-clipboard carry, no
backend, but weaker; relay chosen for the product.)

## 4. What is reused

- **Divi endpoint + data-model knowledge** (`docs/divi-endpoints.md` from the
  extension repo): exact shapes of global-colors, global-variables, preset sync,
  and the nonce model. The plugin PHP writes the same shapes.
- **D5Clipboard read/write** mechanics (entry shape, newest-at-end, inject-then-reload).
- **Pure logic** already written + tested in the extension repo (mergeById,
  mergePresetGroups, extract referenced preset/color ids, pickByIds) ports directly
  to the payload/resolution layer (JS or reimplemented in PHP).

## 5. Licensing

Licensed like Lucas's other plugins (license key validated by the relay). Free vs
paid split TBD; the relay is the gate. Naturally monetizable (unlike the free
extension), which also resolves the earlier monetization question.

## 6. Known constraints

- **Both sites need the plugin** (source resolves, destination recreates; neither
  can be skipped). This is inherent and matches the paid competitors.
- **Compatible Divi versions** across sites (the preset/color storage format can
  move between Divi 5 builds). Detect and warn on mismatch.
- Reload-after-inject on the destination (same as the extension).

## 7. Build phases

- **Phase 0 (spike):** locate Divi 5's server-side preset + global-color storage
  (wp_options keys and/or Divi PHP manager classes) by inspecting Divi source. Prove
  PHP can read the full preset set and write it back merged. This is the make-or-break
  gate the extension failed; confirm it before building UI.
- **Phase 1:** plugin scaffold + source/destination REST endpoints + PHP resolution
  (presets + colors). CLI/curl test: resolve on A, recreate on B, verify B's presets.
- **Phase 2:** builder JS (read/write D5Clipboard, call endpoints) + a paste flow on
  one site (self-paste) proving injection resolves.
- **Phase 3:** cross-site via the cloud relay + a picker UI (history).
- **Phase 4:** licensing, polish, packaging, both-site install docs.

## 8. Open items
- Exact Divi 5 preset/global-color storage (Phase 0 spike).
- Transport final choice (relay assumed) + relay hosting details.
- License tiers.
- Fonts/dynamic/images fidelity (post-v1).
- Repo/name for the new plugin.
