# Divi5 Cross-Site Copy/Paste Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a free, same-browser Chromium + Firefox extension that captures Divi 5 copied elements into a clipboard history and lets the user load any past item into Divi's clipboard on a different site so native paste works.

**Architecture:** One WXT (WebExtension) codebase in TypeScript producing two builds. A MAIN-world shim (injected as a `<script>` tag for cross-browser portability) wraps `localStorage.setItem` to capture Divi's copied blob; a background service worker owns the history in `browser.storage.local`; a popup lists the history and loads a chosen blob back into Divi's clipboard key. Pure logic (label building, history trim/dedupe, clipboard parsing) lives in framework-free `lib/` modules with Vitest unit tests. Browser-glue (shim, content script, background, popup) is verified by loading the unpacked extension against two local Divi sites.

**Tech Stack:** TypeScript, WXT (`wxt`), Vitest, `browser.*` WebExtension API (provided by WXT), Manifest V3. Code lives in the separate project folder `/Users/Lucas/Documents/JHMG-Local/divi5-copy-paste-extension` (its own git repo). This plan lives in the Divi5Lab repo alongside the spec for continuity.

**Spec:** `docs/superpowers/specs/2026-07-28-divi-cross-site-clipboard-extension-design.md`

## Global Constraints

- Same-browser only. No backend, no account, no cloud, no plugin on any WP site.
- Free. No license check, no paid tier.
- History cap: keep the last **50** items; oldest trims off.
- Dedupe: an identical blob captured consecutively (matches the newest existing item) does not create a duplicate.
- Text labels only. No visual thumbnails.
- Manifest V3. Ship Chromium (Chrome/Edge) and Firefox from **one codebase, two builds**.
- The MAIN-world shim is injected via a `<script>` tag from the content script. Do NOT rely on the manifest `world: "MAIN"` content-script flag (it forks Chrome vs Firefox).
- The Divi clipboard `localStorage` key is isolated as a single named constant with a fallback list (`lib/divi-clipboard.ts`). If Divi renames it, capture stops quietly; the extension never writes page/layout content, only Divi's clipboard key and its own `browser.storage.local`.
- No em dashes in any user-facing copy, README, or comments. Use commas, parentheses, periods, or colons.
- Load then native paste: the extension writes the blob into Divi's clipboard key; the user pastes the native Divi way. The extension never reproduces Divi's paste-targeting.

---

### Task 1: Project scaffold (WXT + TypeScript + Vitest, two-build config)

**Files:**
- Create: `/Users/Lucas/Documents/JHMG-Local/divi5-copy-paste-extension/package.json`
- Create: `.../wxt.config.ts`
- Create: `.../tsconfig.json`
- Create: `.../vitest.config.ts`
- Create: `.../.gitignore`
- Create: `.../entrypoints/background.ts` (stub)
- Create: `.../entrypoints/popup/index.html` (stub)
- Create: `.../entrypoints/popup/main.ts` (stub)
- Create: `.../README.md`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a buildable WXT project. `npm run build` (Chrome) and `npm run build:firefox` both succeed; `npm run test` runs Vitest.

- [ ] **Step 1: Initialize the project and install deps**

```bash
cd /Users/Lucas/Documents/JHMG-Local/divi5-copy-paste-extension
git init
npm init -y
npm install -D wxt typescript vitest @types/node
```

- [ ] **Step 2: Write `package.json` scripts**

Replace the `scripts` block in `package.json` with:

```json
{
  "type": "module",
  "scripts": {
    "dev": "wxt",
    "dev:firefox": "wxt -b firefox",
    "build": "wxt build",
    "build:firefox": "wxt build -b firefox",
    "zip": "wxt zip",
    "zip:firefox": "wxt zip -b firefox",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Write `wxt.config.ts`**

```ts
import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Divi5 Cross-Site Copy/Paste",
    description: "Copy Divi 5 sections, rows, modules, and pages on one site and paste them on another. Same browser, free, no account.",
    permissions: ["storage", "activeTab", "tabs", "scripting"],
    host_permissions: ["<all_urls>"],
    browser_specific_settings: {
      gecko: { id: "divi5-copy-paste@divi5lab.com" }
    }
  }
});
```

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "extends": "./.wxt/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "types": ["node"]
  }
}
```

- [ ] **Step 5: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node"
  }
});
```

- [ ] **Step 6: Write stub entrypoints so the build has content**

`entrypoints/background.ts`:
```ts
export default defineBackground(() => {
  // wired up in later tasks
});
```

`entrypoints/popup/index.html`:
```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Divi5 Copy/Paste</title></head>
  <body><div id="app"></div><script type="module" src="./main.ts"></script></body>
</html>
```

`entrypoints/popup/main.ts`:
```ts
document.querySelector("#app")!.textContent = "Divi5 Copy/Paste";
```

- [ ] **Step 7: Write `.gitignore`**

```
node_modules
.wxt
.output
*.zip
```

- [ ] **Step 8: Write a short `README.md`**

Document: what it does (one paragraph, no em dashes), `npm run dev`, `npm run build` / `build:firefox`, and "load unpacked from `.output/chrome-mv3`".

- [ ] **Step 9: Verify both builds succeed**

Run: `npm run build && npm run build:firefox`
Expected: both complete, producing `.output/chrome-mv3/` and `.output/firefox-mv2/` (or `firefox-mv3`) with a `manifest.json`.

- [ ] **Step 10: Verify Vitest runs (no tests yet is fine)**

Run: `npm run test`
Expected: Vitest runs and reports "no test files found" or 0 tests, exit 0.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold WXT extension with chrome+firefox builds and vitest"
```

---

### Task 2: Shared types

**Files:**
- Create: `.../lib/types.ts`
- Test: `.../tests/types.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type ItemType = "module" | "row" | "section" | "page"`
  - `interface HistoryItem { id: string; type: ItemType; label: string; diviJson: string; sourceHost: string; copiedAt: number }`
  - Message union `Message` (see code) used by content script, background, popup.

- [ ] **Step 1: Write the failing test**

`tests/types.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import type { HistoryItem, ItemType } from "../lib/types";
import { ITEM_TYPES } from "../lib/types";

describe("types", () => {
  it("exposes the four item types", () => {
    expect(ITEM_TYPES).toEqual(["module", "row", "section", "page"]);
  });
  it("builds a HistoryItem shape", () => {
    const item: HistoryItem = {
      id: "x", type: "section" as ItemType, label: "L",
      diviJson: "{}", sourceHost: "a.com", copiedAt: 1
    };
    expect(item.type).toBe("section");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/types.test.ts`
Expected: FAIL, cannot find `../lib/types`.

- [ ] **Step 3: Write `lib/types.ts`**

```ts
export type ItemType = "module" | "row" | "section" | "page";

export const ITEM_TYPES: ItemType[] = ["module", "row", "section", "page"];

export interface HistoryItem {
  id: string;
  type: ItemType;
  label: string;
  diviJson: string;
  sourceHost: string;
  copiedAt: number;
}

export type Message =
  | { type: "CAPTURE"; diviJson: string; sourceHost: string; copiedAt: number }
  | { type: "GET_HISTORY" }
  | { type: "LOAD"; id: string }
  | { type: "DELETE"; id: string }
  | { type: "CLEAR" }
  | { type: "WRITE_CLIPBOARD"; key: string; value: string };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts tests/types.test.ts
git commit -m "feat: shared HistoryItem and Message types"
```

---

### Task 3: Discover the Divi 5 clipboard key and record fixtures (spike)

This task nails the one external unknown the whole extension depends on. It produces real captured fixtures that later tasks test against.

**Files:**
- Create: `.../lib/divi-clipboard.ts` (constants only in this task)
- Create: `.../tests/fixtures/README.md`
- Create: `.../tests/fixtures/section.divi.json` (real captured blob)
- Create: `.../tests/fixtures/row.divi.json`
- Create: `.../tests/fixtures/module.divi.json`
- Create: `.../tests/fixtures/fixtures.meta.json` (records expected type + childCount per fixture)

**Interfaces:**
- Consumes: nothing.
- Produces: `DIVI_CLIPBOARD_KEYS: string[]` and `DIVI_CLIPBOARD_KEY: string` (primary). Real fixture files + a `fixtures.meta.json` mapping each fixture filename to `{ type, childCount }` for Task 4's parser tests.

- [ ] **Step 1: Capture the key from a live Divi 5 site**

Procedure (manual, documented in `tests/fixtures/README.md`):
1. Open a Divi 5 site in the builder. Open DevTools console.
2. Run `Object.keys(localStorage)` and note candidates (look for names containing `clipboard`, `copy`, `et_`, or `divi`).
3. Copy a section in the builder, re-run `Object.keys(localStorage)`, and diff: the key whose value just appeared/changed is the clipboard key.
4. Record `localStorage.getItem("<key>")` for a section, a row, and a module.

- [ ] **Step 2: Save the three real blobs as fixtures**

Save each captured value verbatim to `tests/fixtures/section.divi.json`, `row.divi.json`, `module.divi.json`.

- [ ] **Step 3: Record expected parse results**

`tests/fixtures/fixtures.meta.json` (fill childCount from what you actually copied, e.g. a section containing 3 rows):
```json
{
  "section.divi.json": { "type": "section", "childCount": 3 },
  "row.divi.json": { "type": "row", "childCount": 2 },
  "module.divi.json": { "type": "module", "childCount": 0 }
}
```

- [ ] **Step 4: Write `lib/divi-clipboard.ts` constants**

Use the real key discovered in Step 1 as the primary; keep any observed variants as fallbacks:
```ts
// Discovered by live inspection on 2026-07-2x. See tests/fixtures/README.md.
// If Divi renames this in an update, add the new value at the front here.
export const DIVI_CLIPBOARD_KEYS: string[] = [
  "<PRIMARY_KEY_FROM_STEP_1>"
  // add fallbacks/variants if observed
];

export const DIVI_CLIPBOARD_KEY = DIVI_CLIPBOARD_KEYS[0];
```

- [ ] **Step 5: Document the whole-page finding**

In `tests/fixtures/README.md`, record how a full page is represented: does copying/using page-level actions write another `localStorage` key (if so, capture and add it), or is a full page only available via the portability export? This decides Task 10's mechanism. If page is export-only, note it explicitly.

- [ ] **Step 6: Commit**

```bash
git add lib/divi-clipboard.ts tests/fixtures
git commit -m "spike: pin Divi 5 clipboard localStorage key + capture real fixtures"
```

---

### Task 4: Clipboard parser (type + child count)

**Files:**
- Create: `.../lib/parse-clipboard.ts`
- Test: `.../tests/parse-clipboard.test.ts`

**Interfaces:**
- Consumes: `ItemType` from `lib/types`; fixtures + `fixtures.meta.json` from Task 3.
- Produces: `parseClipboard(raw: string): { type: ItemType; childCount: number } | null`. Returns `null` for input that is not a recognizable Divi clipboard blob (so the background can ignore unrelated `localStorage` writes).

- [ ] **Step 1: Write the failing test (driven by the real fixtures)**

`tests/parse-clipboard.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseClipboard } from "../lib/parse-clipboard";

const dir = dirname(fileURLToPath(import.meta.url));
const meta = JSON.parse(readFileSync(join(dir, "fixtures/fixtures.meta.json"), "utf8"));

describe("parseClipboard", () => {
  for (const [file, expected] of Object.entries<any>(meta)) {
    it(`parses ${file} as ${expected.type} with ${expected.childCount} children`, () => {
      const raw = readFileSync(join(dir, "fixtures", file), "utf8");
      expect(parseClipboard(raw)).toEqual(expected);
    });
  }

  it("returns null for non-Divi input", () => {
    expect(parseClipboard('{"unrelated":true}')).toBeNull();
    expect(parseClipboard("not json")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/parse-clipboard.test.ts`
Expected: FAIL, cannot find `../lib/parse-clipboard`.

- [ ] **Step 3: Implement `lib/parse-clipboard.ts` against the real fixture shape**

Inspect the fixture JSON structure from Task 3 and implement to satisfy the tests. Representative implementation to adapt to the actual shape (map Divi's element tag to `ItemType`, count immediate children):
```ts
import type { ItemType } from "./types";

// Map Divi's element identifier to our ItemType. Adjust the tag strings and the
// traversal to match the real fixture structure captured in Task 3.
function classify(node: any): ItemType | null {
  const tag: string = node?.type ?? node?.name ?? node?.component ?? "";
  if (/section/i.test(tag)) return "section";
  if (/row/i.test(tag)) return "row";
  if (/module|text|image|button|blurb/i.test(tag)) return "module";
  return null;
}

function childrenOf(node: any): any[] {
  return node?.children ?? node?.content ?? node?.inner ?? [];
}

export function parseClipboard(raw: string): { type: ItemType; childCount: number } | null {
  let data: any;
  try { data = JSON.parse(raw); } catch { return null; }
  // Divi may wrap the copied element; unwrap to the root node. Adjust per fixture.
  const root = data?.root ?? data?.module ?? data?.[0] ?? data;
  const type = classify(root);
  if (!type) return null;
  const childCount = type === "module" ? 0 : childrenOf(root).length;
  return { type, childCount };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/parse-clipboard.test.ts`
Expected: PASS for all fixtures and the null cases. Iterate on the traversal until green.

- [ ] **Step 5: Commit**

```bash
git add lib/parse-clipboard.ts tests/parse-clipboard.test.ts
git commit -m "feat: parse Divi clipboard blob into type + child count"
```

---

### Task 5: Label builder

**Files:**
- Create: `.../lib/labels.ts`
- Test: `.../tests/labels.test.ts`

**Interfaces:**
- Consumes: `ItemType` from `lib/types`.
- Produces:
  - `relativeTime(from: number, now: number): string`
  - `buildLabel(p: { type: ItemType; childCount: number; sourceHost: string; copiedAt: number; now: number }): string`

- [ ] **Step 1: Write the failing test**

`tests/labels.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { relativeTime, buildLabel } from "../lib/labels";

const NOW = 1_000_000_000_000;

describe("relativeTime", () => {
  it("shows just now under a minute", () => {
    expect(relativeTime(NOW - 30_000, NOW)).toBe("just now");
  });
  it("shows minutes, hours, days", () => {
    expect(relativeTime(NOW - 2 * 60_000, NOW)).toBe("2m ago");
    expect(relativeTime(NOW - 3 * 3_600_000, NOW)).toBe("3h ago");
    expect(relativeTime(NOW - 5 * 86_400_000, NOW)).toBe("5d ago");
  });
});

describe("buildLabel", () => {
  it("labels a section with pluralized rows", () => {
    expect(buildLabel({ type: "section", childCount: 3, sourceHost: "site-a.com", copiedAt: NOW - 120_000, now: NOW }))
      .toBe("Section · 3 rows · from site-a.com · 2m ago");
  });
  it("uses singular for a single child", () => {
    expect(buildLabel({ type: "section", childCount: 1, sourceHost: "site-a.com", copiedAt: NOW, now: NOW }))
      .toBe("Section · 1 row · from site-a.com · just now");
  });
  it("omits the child clause for a module", () => {
    expect(buildLabel({ type: "module", childCount: 0, sourceHost: "b.com", copiedAt: NOW, now: NOW }))
      .toBe("Module · from b.com · just now");
  });
  it("labels a full page with sections", () => {
    expect(buildLabel({ type: "page", childCount: 4, sourceHost: "b.com", copiedAt: NOW, now: NOW }))
      .toBe("Full page · 4 sections · from b.com · just now");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/labels.test.ts`
Expected: FAIL, cannot find `../lib/labels`.

- [ ] **Step 3: Implement `lib/labels.ts`**

```ts
import type { ItemType } from "./types";

export function relativeTime(from: number, now: number): string {
  const s = Math.max(0, Math.floor((now - from) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TITLE: Record<ItemType, string> = {
  module: "Module", row: "Row", section: "Section", page: "Full page"
};
// Plural noun for the immediate children of each type. Module has none.
const CHILD_NOUN: Record<ItemType, string | null> = {
  module: null, row: "modules", section: "rows", page: "sections"
};

export function buildLabel(p: {
  type: ItemType; childCount: number; sourceHost: string; copiedAt: number; now: number;
}): string {
  const parts: string[] = [TITLE[p.type]];
  const noun = CHILD_NOUN[p.type];
  if (noun && p.childCount > 0) {
    const singular = noun.replace(/s$/, "");
    parts.push(`${p.childCount} ${p.childCount === 1 ? singular : noun}`);
  }
  parts.push(`from ${p.sourceHost}`);
  parts.push(relativeTime(p.copiedAt, p.now));
  return parts.join(" · ");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/labels.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/labels.ts tests/labels.test.ts
git commit -m "feat: build history item labels"
```

---

### Task 6: History pure logic (add, dedupe, trim, remove, build item)

**Files:**
- Create: `.../lib/history.ts`
- Test: `.../tests/history.test.ts`

**Interfaces:**
- Consumes: `HistoryItem` from `lib/types`; `buildLabel` from `lib/labels`.
- Produces:
  - `MAX_HISTORY = 50`
  - `addToHistory(list: HistoryItem[], item: HistoryItem): HistoryItem[]`
  - `removeFromHistory(list: HistoryItem[], id: string): HistoryItem[]`
  - `buildHistoryItem(args: { id: string; diviJson: string; parsed: { type: ItemType; childCount: number }; sourceHost: string; copiedAt: number; now: number }): HistoryItem`

- [ ] **Step 1: Write the failing test**

`tests/history.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { addToHistory, removeFromHistory, buildHistoryItem, MAX_HISTORY } from "../lib/history";
import type { HistoryItem } from "../lib/types";

function item(id: string, json = `{"j":"${id}"}`): HistoryItem {
  return { id, type: "section", label: id, diviJson: json, sourceHost: "a.com", copiedAt: 0 };
}

describe("addToHistory", () => {
  it("prepends new items", () => {
    const out = addToHistory([item("a")], item("b"));
    expect(out.map(i => i.id)).toEqual(["b", "a"]);
  });
  it("dedupes an identical blob captured right after the newest", () => {
    const list = [item("a", '{"same":1}')];
    const out = addToHistory(list, item("b", '{"same":1}'));
    expect(out.map(i => i.id)).toEqual(["a"]);
  });
  it("caps the list at MAX_HISTORY", () => {
    let list: HistoryItem[] = [];
    for (let i = 0; i < MAX_HISTORY + 10; i++) list = addToHistory(list, item(`i${i}`));
    expect(list.length).toBe(MAX_HISTORY);
    expect(list[0].id).toBe(`i${MAX_HISTORY + 9}`);
  });
});

describe("removeFromHistory", () => {
  it("removes by id", () => {
    expect(removeFromHistory([item("a"), item("b")], "a").map(i => i.id)).toEqual(["b"]);
  });
});

describe("buildHistoryItem", () => {
  it("assembles a labeled item", () => {
    const it = buildHistoryItem({
      id: "x", diviJson: "{}", parsed: { type: "section", childCount: 2 },
      sourceHost: "a.com", copiedAt: 1000, now: 1000
    });
    expect(it).toMatchObject({ id: "x", type: "section", sourceHost: "a.com", copiedAt: 1000 });
    expect(it.label).toBe("Section · 2 rows · from a.com · just now");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/history.test.ts`
Expected: FAIL, cannot find `../lib/history`.

- [ ] **Step 3: Implement `lib/history.ts`**

```ts
import type { HistoryItem, ItemType } from "./types";
import { buildLabel } from "./labels";

export const MAX_HISTORY = 50;

export function addToHistory(list: HistoryItem[], item: HistoryItem): HistoryItem[] {
  if (list.length > 0 && list[0].diviJson === item.diviJson) return list;
  return [item, ...list].slice(0, MAX_HISTORY);
}

export function removeFromHistory(list: HistoryItem[], id: string): HistoryItem[] {
  return list.filter(i => i.id !== id);
}

export function buildHistoryItem(args: {
  id: string;
  diviJson: string;
  parsed: { type: ItemType; childCount: number };
  sourceHost: string;
  copiedAt: number;
  now: number;
}): HistoryItem {
  return {
    id: args.id,
    type: args.parsed.type,
    label: buildLabel({
      type: args.parsed.type,
      childCount: args.parsed.childCount,
      sourceHost: args.sourceHost,
      copiedAt: args.copiedAt,
      now: args.now
    }),
    diviJson: args.diviJson,
    sourceHost: args.sourceHost,
    copiedAt: args.copiedAt
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/history.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/history.ts tests/history.test.ts
git commit -m "feat: history add/dedupe/trim/remove + item builder"
```

---

### Task 7: History storage wrapper

**Files:**
- Create: `.../lib/history-store.ts`
- Test: `.../tests/history-store.test.ts`

**Interfaces:**
- Consumes: `HistoryItem` from `lib/types`; WXT's auto-imported `browser` (or `webextension-polyfill`) at runtime.
- Produces:
  - `getHistory(): Promise<HistoryItem[]>`
  - `setHistory(list: HistoryItem[]): Promise<void>`
  - The store is dependency-injected so it is unit-testable: `createHistoryStore(area: StorageArea)` where `StorageArea` has `get`/`set`. The module also exports default `getHistory`/`setHistory` bound to `browser.storage.local`.

- [ ] **Step 1: Write the failing test with a fake storage area**

`tests/history-store.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createHistoryStore } from "../lib/history-store";
import type { HistoryItem } from "../lib/types";

function fakeArea() {
  const data: Record<string, unknown> = {};
  return {
    async get(key: string) { return { [key]: data[key] }; },
    async set(obj: Record<string, unknown>) { Object.assign(data, obj); }
  };
}

const item: HistoryItem = { id: "a", type: "row", label: "L", diviJson: "{}", sourceHost: "a.com", copiedAt: 0 };

describe("history store", () => {
  it("returns [] when empty", async () => {
    const s = createHistoryStore(fakeArea());
    expect(await s.getHistory()).toEqual([]);
  });
  it("round-trips a list", async () => {
    const s = createHistoryStore(fakeArea());
    await s.setHistory([item]);
    expect(await s.getHistory()).toEqual([item]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/history-store.test.ts`
Expected: FAIL, cannot find `../lib/history-store`.

- [ ] **Step 3: Implement `lib/history-store.ts`**

```ts
import type { HistoryItem } from "./types";

const STORAGE_KEY = "history";

export interface StorageArea {
  get(key: string): Promise<Record<string, unknown>>;
  set(obj: Record<string, unknown>): Promise<void>;
}

export function createHistoryStore(area: StorageArea) {
  return {
    async getHistory(): Promise<HistoryItem[]> {
      const r = await area.get(STORAGE_KEY);
      return (r[STORAGE_KEY] as HistoryItem[]) ?? [];
    },
    async setHistory(list: HistoryItem[]): Promise<void> {
      await area.set({ [STORAGE_KEY]: list });
    }
  };
}

// Runtime binding to the extension's local storage (WXT provides `browser`).
const runtimeStore = createHistoryStore(browser.storage.local as unknown as StorageArea);
export const getHistory = runtimeStore.getHistory;
export const setHistory = runtimeStore.setHistory;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/history-store.test.ts`
Expected: PASS. (The runtime `browser` reference is not exercised by the test; only `createHistoryStore` with the fake is.)

- [ ] **Step 5: Commit**

```bash
git add lib/history-store.ts tests/history-store.test.ts
git commit -m "feat: browser.storage.local history wrapper (injectable for tests)"
```

---

### Task 8: MAIN-world shim + content script (capture and load paths)

**Files:**
- Create: `.../lib/shim.ts`
- Create: `.../entrypoints/divi.content.ts`
- Test: `.../tests/shim.test.ts`

**Interfaces:**
- Consumes: `DIVI_CLIPBOARD_KEYS`, `DIVI_CLIPBOARD_KEY` from `lib/divi-clipboard`; `Message` from `lib/types`.
- Produces: a content script that (a) injects the shim into MAIN world via a `<script>` tag, (b) relays captured blobs to the background as `CAPTURE`, (c) on `WRITE_CLIPBOARD` writes the value into `localStorage` (content scripts share the page's `localStorage`, so no MAIN world needed for writing). `lib/shim.ts` exports `diviClipboardShim(keys: string[]): void` (dependency-free so `.toString()` injection works) and `buildShimSource(keys: string[]): string`.

- [ ] **Step 1: Write the failing test for the injectable shim source**

`tests/shim.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildShimSource } from "../lib/shim";

describe("buildShimSource", () => {
  it("produces a self-invoking string carrying the keys", () => {
    const src = buildShimSource(["ETclip", "et_clipboard"]);
    expect(src).toContain("localStorage.setItem");
    expect(src).toContain("ETclip");
    expect(src).toContain("et_clipboard");
    // must be an immediately-invoked expression (no external references)
    expect(src.trim().startsWith("(")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/shim.test.ts`
Expected: FAIL, cannot find `../lib/shim`.

- [ ] **Step 3: Implement `lib/shim.ts`**

```ts
// Runs in the page's MAIN world. Must be fully self-contained (no imports,
// no closure references) so `.toString()` injection works across browsers.
export function diviClipboardShim(keys: string[]): void {
  const original = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key: string, value: string) {
    original(key, value);
    try {
      if (keys.indexOf(key) !== -1) {
        window.postMessage({ __divi5cp: true, kind: "capture", key, value }, "*");
      }
    } catch (_e) {
      // never let our hook break the host page
    }
  };
}

export function buildShimSource(keys: string[]): string {
  return `(${diviClipboardShim.toString()})(${JSON.stringify(keys)});`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/shim.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the content script**

`entrypoints/divi.content.ts`:
```ts
import { DIVI_CLIPBOARD_KEYS, DIVI_CLIPBOARD_KEY } from "../lib/divi-clipboard";
import { buildShimSource } from "../lib/shim";
import type { Message } from "../lib/types";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_start",
  main() {
    // Inject the capture shim into the page's MAIN world via a <script> tag
    // (portable across Chrome and Firefox; avoids manifest world:"MAIN").
    const s = document.createElement("script");
    s.textContent = buildShimSource(DIVI_CLIPBOARD_KEYS);
    (document.head || document.documentElement).appendChild(s);
    s.remove();

    // Relay captured blobs from the shim to the background.
    window.addEventListener("message", (e) => {
      if (e.source !== window) return;
      const d = e.data;
      if (!d || d.__divi5cp !== true || d.kind !== "capture") return;
      browser.runtime.sendMessage({
        type: "CAPTURE",
        diviJson: d.value,
        sourceHost: location.host,
        copiedAt: Date.now()
      } satisfies Message);
    });

    // Load a chosen blob back into Divi's clipboard key. Content scripts share
    // the page's localStorage, so a direct write is enough (no MAIN world).
    browser.runtime.onMessage.addListener((msg: Message) => {
      if (msg.type === "WRITE_CLIPBOARD") {
        localStorage.setItem(msg.key || DIVI_CLIPBOARD_KEY, msg.value);
        return Promise.resolve({ ok: true });
      }
    });
  }
});
```

- [ ] **Step 6: Verify the build still succeeds**

Run: `npm run build`
Expected: PASS; `.output/chrome-mv3/manifest.json` lists the content script.

- [ ] **Step 7: Commit**

```bash
git add lib/shim.ts entrypoints/divi.content.ts tests/shim.test.ts
git commit -m "feat: MAIN-world capture shim + content script capture/load relay"
```

---

### Task 9: Background service worker (message hub)

**Files:**
- Modify: `.../entrypoints/background.ts`

**Interfaces:**
- Consumes: `getHistory`/`setHistory` (`lib/history-store`); `addToHistory`/`removeFromHistory`/`buildHistoryItem` (`lib/history`); `parseClipboard` (`lib/parse-clipboard`); `DIVI_CLIPBOARD_KEY` (`lib/divi-clipboard`); `Message` (`lib/types`).
- Produces: handlers for `CAPTURE`, `GET_HISTORY`, `LOAD`, `DELETE`, `CLEAR`. `GET_HISTORY`/`DELETE`/`CLEAR` resolve to the current `HistoryItem[]`; `LOAD` resolves `{ ok: boolean }`.

- [ ] **Step 1: Implement the background hub**

`entrypoints/background.ts`:
```ts
import type { HistoryItem, Message } from "../lib/types";
import { getHistory, setHistory } from "../lib/history-store";
import { addToHistory, removeFromHistory, buildHistoryItem } from "../lib/history";
import { parseClipboard } from "../lib/parse-clipboard";
import { DIVI_CLIPBOARD_KEY } from "../lib/divi-clipboard";

let idCounter = 0;
function newId(): string {
  idCounter += 1;
  return `${Date.now()}-${idCounter}`;
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(async (msg: Message): Promise<HistoryItem[] | { ok: boolean } | undefined> => {
    switch (msg.type) {
      case "CAPTURE": {
        const parsed = parseClipboard(msg.diviJson);
        if (!parsed) return; // ignore writes that are not Divi clipboard blobs
        const list = await getHistory();
        const item = buildHistoryItem({
          id: newId(),
          diviJson: msg.diviJson,
          parsed,
          sourceHost: msg.sourceHost,
          copiedAt: msg.copiedAt,
          now: Date.now()
        });
        await setHistory(addToHistory(list, item));
        return;
      }
      case "GET_HISTORY":
        return await getHistory();
      case "DELETE": {
        const list = await getHistory();
        const next = removeFromHistory(list, msg.id);
        await setHistory(next);
        return next;
      }
      case "CLEAR":
        await setHistory([]);
        return [];
      case "LOAD": {
        const list = await getHistory();
        const item = list.find(i => i.id === msg.id);
        if (!item) return { ok: false };
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return { ok: false };
        await browser.tabs.sendMessage(tab.id, { type: "WRITE_CLIPBOARD", key: DIVI_CLIPBOARD_KEY, value: item.diviJson });
        return { ok: true };
      }
    }
  });
});
```

- [ ] **Step 2: Verify the build**

Run: `npm run build && npm run build:firefox`
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add entrypoints/background.ts
git commit -m "feat: background message hub (capture/get/load/delete/clear)"
```

---

### Task 10: Popup UI (history list, Load with coaching, delete, clear, funnel link)

**Files:**
- Modify: `.../entrypoints/popup/index.html`
- Modify: `.../entrypoints/popup/main.ts`
- Create: `.../entrypoints/popup/style.css`

**Interfaces:**
- Consumes: `HistoryItem`/`Message` (`lib/types`); background handlers via `browser.runtime.sendMessage`.
- Produces: rendered history, per-row Load (shows inline "Loaded ✓, now right-click, Paste in Divi"), per-row delete, Clear all, a persistent bottom coaching line, and an AI Editor link.

- [ ] **Step 1: Write the popup HTML**

`entrypoints/popup/index.html`:
```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Divi5 Copy/Paste</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <header>
      <strong>Divi5 Copy/Paste</strong>
      <button id="clear" type="button">Clear all</button>
    </header>
    <ul id="list"></ul>
    <p id="empty" hidden>Nothing copied yet. Copy a section, row, or module in the Divi builder and it shows up here.</p>
    <footer>
      <p class="hint">Click Load, then in Divi: right-click, Paste.</p>
      <a id="promo" href="https://divi5lab.com/ai-editor" target="_blank" rel="noopener">Powered by AI Editor for Divi 5</a>
    </footer>
  </body>
</html>
```

- [ ] **Step 2: Write the popup styles**

`entrypoints/popup/style.css` (minimal, readable, ~320px wide popup):
```css
body { width: 340px; margin: 0; font: 13px/1.4 system-ui, sans-serif; }
header { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-bottom: 1px solid #eee; }
#list { list-style: none; margin: 0; padding: 0; max-height: 360px; overflow-y: auto; }
#list li { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #f2f2f2; }
#list .label { flex: 1; }
#list .loaded { color: #197b30; }
button { cursor: pointer; }
footer { padding: 10px 12px; border-top: 1px solid #eee; }
.hint { margin: 0 0 6px; color: #555; }
#promo { font-size: 12px; }
#empty { padding: 16px 12px; color: #666; }
```

- [ ] **Step 3: Write the popup logic**

`entrypoints/popup/main.ts`:
```ts
import type { HistoryItem, Message } from "../../lib/types";

const listEl = document.querySelector<HTMLUListElement>("#list")!;
const emptyEl = document.querySelector<HTMLParagraphElement>("#empty")!;

function send<T>(msg: Message): Promise<T> {
  return browser.runtime.sendMessage(msg) as Promise<T>;
}

function render(items: HistoryItem[]) {
  listEl.innerHTML = "";
  emptyEl.hidden = items.length > 0;
  for (const item of items) {
    const li = document.createElement("li");

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = item.label;

    const load = document.createElement("button");
    load.type = "button";
    load.textContent = "Load";
    load.addEventListener("click", async () => {
      const res = await send<{ ok: boolean }>({ type: "LOAD", id: item.id });
      if (res.ok) {
        label.className = "label loaded";
        label.textContent = "Loaded ✓, now in Divi: right-click, Paste.";
      }
    });

    const del = document.createElement("button");
    del.type = "button";
    del.textContent = "×";
    del.title = "Remove";
    del.addEventListener("click", async () => {
      const items2 = await send<HistoryItem[]>({ type: "DELETE", id: item.id });
      render(items2);
    });

    li.append(label, load, del);
    listEl.append(li);
  }
}

document.querySelector("#clear")!.addEventListener("click", async () => {
  const items = await send<HistoryItem[]>({ type: "CLEAR" });
  render(items);
});

send<HistoryItem[]>({ type: "GET_HISTORY" }).then(render);
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: PASS; popup assets present in `.output/chrome-mv3/`.

- [ ] **Step 5: Manual smoke test (load unpacked)**

1. `npm run dev` (opens Chrome with the extension) or load `.output/chrome-mv3` unpacked at `chrome://extensions`.
2. On a Divi 5 builder site, copy a section. Open the popup: the item appears with a correct label.
3. Click Load: the row shows the "Loaded ✓" coaching text.
4. On a second Divi site's builder, open the popup, click Load on that item, then right-click, Paste. The section pastes.
5. Delete an item and Clear all both update the list.

- [ ] **Step 6: Commit**

```bash
git add entrypoints/popup
git commit -m "feat: popup history UI with load/coaching/delete/clear + funnel link"
```

---

### Task 11: Whole-page capture and load (page type)

Depends on the Task 3 Step 5 finding. Two mechanisms; implement the one the spike identified.

**Files:**
- Modify: `.../lib/divi-clipboard.ts` (if page uses an additional localStorage key)
- Modify: `.../entrypoints/divi.content.ts` (page capture trigger, if needed)
- Modify: `.../lib/parse-clipboard.ts` (recognize the page shape, return `type: "page"`)
- Create: `.../tests/fixtures/page.divi.json` + extend `fixtures.meta.json`

**Interfaces:**
- Consumes: everything from Tasks 3, 4, 8.
- Produces: `page`-typed history items that capture the full layout and load it back so the whole page can be pasted/imported.

- [ ] **Step 1: Capture a real page fixture**

Using the Task 3 procedure, capture the full-page representation. Save to `tests/fixtures/page.divi.json` and add to `fixtures.meta.json`:
```json
"page.divi.json": { "type": "page", "childCount": 4 }
```

- [ ] **Step 2: Extend the parser test and parser**

The `tests/parse-clipboard.test.ts` loop already iterates `fixtures.meta.json`, so it now asserts the page fixture too. Run:
`npx vitest run tests/parse-clipboard.test.ts`
Expected: FAIL for `page.divi.json` until the parser recognizes the page shape.

Update `classify`/`childrenOf` in `lib/parse-clipboard.ts` so a full-page blob returns `type: "page"` with its section count. Re-run until PASS.

- [ ] **Step 3: Wire page capture (mechanism per spike)**

- If the spike found page uses **another localStorage key**: add that key to `DIVI_CLIPBOARD_KEYS` in `lib/divi-clipboard.ts`. Capture then flows through the existing shim with no content-script change. Verify the build.
- If the spike found page is **export/builder-state only**: add a "Capture current page" button to the popup that sends a `CAPTURE_PAGE` message; the content script reads the page layout from Divi's builder state (documented in the spike) and posts it as a `CAPTURE` with the page blob. Add the `CAPTURE_PAGE` variant to `Message` in `lib/types.ts` and handle it in the content script.

Document which branch was taken at the top of `lib/divi-clipboard.ts`.

- [ ] **Step 4: Manual smoke test**

Copy/capture a full page on Site A, confirm a "Full page ..." item appears, Load on Site B, and paste/import the whole page.

- [ ] **Step 5: Run the full test suite**

Run: `npm run test`
Expected: all suites PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: whole-page (page type) capture and load"
```

---

### Task 12: Cross-browser packaging + README + manual test matrix

**Files:**
- Modify: `.../README.md`
- Create: `.../docs/manual-test-matrix.md`

**Interfaces:**
- Consumes: the whole extension.
- Produces: shippable zips for both stores and documented verification.

- [ ] **Step 1: Produce both store zips**

Run: `npm run zip && npm run zip:firefox`
Expected: two zips in the project root / `.output`, one per browser.

- [ ] **Step 2: Verify unpacked loads in both browsers**

- Chrome/Edge: load `.output/chrome-mv3` at `chrome://extensions` (Developer mode).
- Firefox: load the built manifest via `about:debugging` -> This Firefox -> Load Temporary Add-on.
Confirm the popup opens and capture works in each.

- [ ] **Step 3: Write the manual test matrix doc**

`docs/manual-test-matrix.md`: table of {module, row, section, page} × {capture appears with right label, Load then paste works on a second site, delete, clear} across Chrome and Firefox. This is the release checklist.

- [ ] **Step 4: Finalize the README**

Document install-from-store (placeholder store URLs), install-unpacked for dev, the Divi-key fragility note (if capture stops after a Divi update, update `DIVI_CLIPBOARD_KEYS`), and the same-browser-only limitation. No em dashes.

- [ ] **Step 5: Commit and tag v1**

```bash
git add -A
git commit -m "chore: cross-browser zips, README, manual test matrix (v1)"
git tag v1.0.0
```

---

## Self-Review Notes

**Spec coverage:**
- Summary/mechanism (shim capture, load, native paste): Tasks 8, 9, 10.
- Goals (module/row/section/page cross-site, history, zero install, chromium+firefox): Tasks 4-11.
- Non-goals honored: no backend/account (all local), text labels only (Task 5), no thumbnails, no pinning, no auto-paste (Load then native paste in Task 10).
- Positioning/funnel link: Task 10 promo link; README (Task 12).
- Architecture (3 parts, clean boundaries): content/shim (Task 8), background (Task 9), popup (Task 10); pure lib (Tasks 2-7).
- Data model + 50 cap + dedupe: Tasks 2, 6, 7.
- Two capture paths (typed items, whole page): Tasks 4, 11.
- Divi key fragility (single constant + fallbacks, quiet-safe failure): Task 3; README note Task 12.
- Cross-browser one-codebase-two-builds + script-tag shim injection: Tasks 1, 8, 12.
- Testing (label gen, trim/dedupe, serialization shape; manual two-site matrix): Tasks 5, 6, 7 (unit) and Tasks 10, 12 (manual).

**Type consistency:** `HistoryItem`, `ItemType`, `Message` defined in Task 2 and used unchanged in Tasks 6-10. `parseClipboard` returns `{ type, childCount }` (Task 4), consumed by `buildHistoryItem` (Task 6) and the background (Task 9). `buildShimSource`/`diviClipboardShim` (Task 8) consumed by the content script (Task 8). `DIVI_CLIPBOARD_KEY(S)` (Task 3) consumed by Tasks 8, 9, 11.

**Known inspection-dependent points:** Task 3 discovers the real Divi key and JSON shape; Task 4's parser traversal and Task 11's page mechanism are finalized against the captured fixtures. This is intentional (the external format cannot be invented) and is isolated to those tasks with real-fixture tests as the acceptance gate.
