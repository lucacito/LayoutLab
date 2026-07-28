# Divi5 Cross-Site Copy/Paste Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a free, same-browser Chromium + Firefox extension that captures Divi 5 copied elements from Divi's `D5Clipboard` IndexedDB into a cross-site history picker, and loads any past entry back into Divi's clipboard on a different site so native paste works.

**Architecture:** One WXT (WebExtension) codebase in TypeScript, two builds. Divi 5 stores its clipboard in **IndexedDB** (`D5Clipboard` DB, `clipboard` store, `items` record = JSON string array of entries). A content script reads/writes that IndexedDB directly (no MAIN-world injection): it polls the `timestamp` record to capture new entries, and on load places a chosen entry as Divi's current clipboard item. A background service worker owns the cross-site history in `browser.storage.local`; a popup shows the picker. Pure logic (type mapping, labels, history trim/dedupe, items array ops) lives in framework-free `lib/` modules with Vitest tests. Browser glue is verified against two local Divi sites.

**Tech Stack:** TypeScript, WXT (`wxt`), Vitest, `browser.*` WebExtension API, IndexedDB, Manifest V3. Code lives in `/Users/Lucas/Documents/JHMG-Local/divi5-copy-paste-extension` (its own git repo). This plan lives in the Divi5Lab repo alongside the spec.

**Spec:** `docs/superpowers/specs/2026-07-28-divi-cross-site-clipboard-extension-design.md`

## Global Constraints

- Same-browser only. No backend, no account, no cloud, no plugin on any WP site. Free.
- Divi 5 clipboard = IndexedDB `D5Clipboard` / store `clipboard` / records `items` (JSON string array), `timestamp` (int ms), `lastDependencyChange` (int). Entry shape: `{ clipboardType: "module", origin: string, payload: { moduleIds: string[], moduleType: string, moduleObjects: Record<string, {children?: string[], ...}> } }`. Real type is `payload.moduleType`.
- All Divi IndexedDB names and field paths are isolated in `lib/d5clipboard.ts` constants. If Divi changes them, capture/load stops quietly; the extension only touches `D5Clipboard` and its own `browser.storage.local`, never page/layout content.
- Content script accesses IndexedDB directly. NO MAIN-world script injection.
- History cap: last **50**; oldest trims off. Dedupe: an entry matching the newest existing item (by `origin`) is not duplicated.
- Text labels only. Manifest V3. Chromium + Firefox from one codebase, two builds.
- Load path: place the chosen entry as Divi's current clipboard item, then the user **reloads the Divi builder** and pastes natively. (Divi reads its clipboard from IndexedDB on load; confirmed items survive reload.) The extension never reproduces Divi's paste-targeting.
- No em dashes in any user-facing copy, README, or comments. Use commas, parentheses, periods, or colons.

---

### Task 1: Project scaffold (WXT + TypeScript + Vitest, two-build config)

**Files:**
- Create: `.../package.json`, `.../wxt.config.ts`, `.../tsconfig.json`, `.../vitest.config.ts`, `.../.gitignore`, `.../README.md`
- Create: `.../entrypoints/background.ts` (stub), `.../entrypoints/popup/index.html` (stub), `.../entrypoints/popup/main.ts` (stub)

**Interfaces:**
- Produces: a buildable WXT project. `npm run build` and `npm run build:firefox` both succeed; `npm run test` runs Vitest.

- [ ] **Step 1: Initialize and install**

```bash
cd /Users/Lucas/Documents/JHMG-Local/divi5-copy-paste-extension
git init
npm init -y
npm install -D wxt typescript vitest @types/node fake-indexeddb
```
(`fake-indexeddb` is used later to unit-test IndexedDB ops in Node.)

- [ ] **Step 2: `package.json` scripts + type module**

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

- [ ] **Step 3: `wxt.config.ts`**

```ts
import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Divi5 Cross-Site Copy/Paste",
    description: "Copy Divi 5 sections, rows, modules, and pages on one site and paste them on another. Same browser, free, no account.",
    permissions: ["storage", "activeTab", "tabs"],
    host_permissions: ["<all_urls>"],
    browser_specific_settings: { gecko: { id: "divi5-copy-paste@divi5lab.com" } }
  }
});
```

- [ ] **Step 4: `tsconfig.json`**

```json
{ "extends": "./.wxt/tsconfig.json", "compilerOptions": { "strict": true, "types": ["node"] } }
```

- [ ] **Step 5: `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/**/*.test.ts"], environment: "node" } });
```

- [ ] **Step 6: Stub entrypoints**

`entrypoints/background.ts`:
```ts
export default defineBackground(() => {});
```
`entrypoints/popup/index.html`:
```html
<!doctype html><html><head><meta charset="utf-8" /><title>Divi5 Copy/Paste</title></head>
<body><div id="app"></div><script type="module" src="./main.ts"></script></body></html>
```
`entrypoints/popup/main.ts`:
```ts
document.querySelector("#app")!.textContent = "Divi5 Copy/Paste";
```

- [ ] **Step 7: `.gitignore`**

```
node_modules
.wxt
.output
*.zip
```

- [ ] **Step 8: `README.md`**: one paragraph on what it does (no em dashes), plus `npm run dev`, `npm run build` / `build:firefox`, and "load unpacked from `.output/chrome-mv3`".

- [ ] **Step 9: Verify both builds**

Run: `npm run build && npm run build:firefox`
Expected: both produce `.output/chrome-mv3/` and a firefox output with `manifest.json`.

- [ ] **Step 10: Verify Vitest runs**

Run: `npm run test`
Expected: exit 0 (no tests yet is fine).

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "chore: scaffold WXT extension with chrome+firefox builds and vitest"
```

---

### Task 2: Shared types + Divi constants

**Files:**
- Create: `.../lib/types.ts`
- Create: `.../lib/d5clipboard.ts` (constants only in this task)
- Test: `.../tests/types.test.ts`

**Interfaces:**
- Produces:
  - `type ItemType = "module" | "row" | "section" | "page"`; `ITEM_TYPES`
  - `interface DiviClipboardEntry { clipboardType: string; origin: string; payload: { moduleIds: string[]; moduleType: string; moduleObjects: Record<string, { children?: string[]; [k: string]: unknown }> } }`
  - `interface HistoryItem { id: string; type: ItemType; label: string; entry: DiviClipboardEntry; sourceHost: string; copiedAt: number }`
  - `Message` union
  - `lib/d5clipboard.ts`: `DB_NAME`, `STORE`, `ITEMS_KEY`, `TIMESTAMP_KEY`, `DEP_KEY` constants (real values from the live dump)

- [ ] **Step 1: Write the failing test**

`tests/types.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ITEM_TYPES } from "../lib/types";
import { DB_NAME, STORE, ITEMS_KEY, TIMESTAMP_KEY } from "../lib/d5clipboard";

describe("constants", () => {
  it("lists the four item types", () => {
    expect(ITEM_TYPES).toEqual(["module", "row", "section", "page"]);
  });
  it("pins the Divi 5 IndexedDB names discovered by inspection", () => {
    expect(DB_NAME).toBe("D5Clipboard");
    expect(STORE).toBe("clipboard");
    expect(ITEMS_KEY).toBe("items");
    expect(TIMESTAMP_KEY).toBe("timestamp");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/types.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Write `lib/types.ts`**

```ts
export type ItemType = "module" | "row" | "section" | "page";
export const ITEM_TYPES: ItemType[] = ["module", "row", "section", "page"];

export interface DiviClipboardEntry {
  clipboardType: string;
  origin: string;
  payload: {
    moduleIds: string[];
    moduleType: string;
    moduleObjects: Record<string, { children?: string[]; [k: string]: unknown }>;
  };
}

export interface HistoryItem {
  id: string;
  type: ItemType;
  label: string;
  entry: DiviClipboardEntry;
  sourceHost: string;
  copiedAt: number;
}

export type Message =
  | { type: "CAPTURE"; entries: DiviClipboardEntry[]; sourceHost: string; copiedAt: number }
  | { type: "GET_HISTORY" }
  | { type: "LOAD"; id: string }
  | { type: "DELETE"; id: string }
  | { type: "CLEAR" }
  | { type: "WRITE_CLIPBOARD"; entry: DiviClipboardEntry };
```

- [ ] **Step 4: Write `lib/d5clipboard.ts` constants**

```ts
// Divi 5 clipboard lives in IndexedDB. Names discovered by live inspection
// on 2026-07-28 (see tests/fixtures/d5clipboard-dump.json). If a Divi update
// renames these, update them here; capture/load fail quietly until then.
export const DB_NAME = "D5Clipboard";
export const STORE = "clipboard";
export const ITEMS_KEY = "items";
export const TIMESTAMP_KEY = "timestamp";
export const DEP_KEY = "lastDependencyChange";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/types.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/d5clipboard.ts tests/types.test.ts
git commit -m "feat: shared types + Divi D5Clipboard IndexedDB constants"
```

---

### Task 3: Real fixtures already captured; add labeled cases

The `D5Clipboard` dump is already saved at `tests/fixtures/d5clipboard-dump.json`. This task extracts clean single-entry fixtures with known types/counts for the parser tests.

**Files:**
- Create: `.../tests/fixtures/entry.section.json`, `entry.row.json`, `entry.module.json`, `entry.page.json`
- Create: `.../tests/fixtures/fixtures.meta.json`
- Create: `.../tests/fixtures/README.md`

**Interfaces:**
- Produces: one `DiviClipboardEntry` per file, plus `fixtures.meta.json` mapping filename to `{ type, childCount }` for Task 4.

- [ ] **Step 1: Extract a row entry from the existing dump**

The dump's `stores.clipboard.records[0]` is the `items` JSON string. Parse it, take one entry whose `payload.moduleType === "row"`, and save it (pretty-printed) to `tests/fixtures/entry.row.json`. Node one-off:
```bash
node -e "const d=require('./tests/fixtures/d5clipboard-dump.json');const items=JSON.parse(d.stores.clipboard.records[0]);const row=items.find(e=>e.payload.moduleType==='row');require('fs').writeFileSync('tests/fixtures/entry.row.json',JSON.stringify(row,null,2));console.log('rootId',row.payload.moduleIds[0],'children',(row.payload.moduleObjects[row.payload.moduleIds[0]].children||[]).length)"
```
Note the printed child count.

- [ ] **Step 2: Capture section, module, and page entries from a live site**

In the Divi 5 builder, copy a **section** (note its row count), a single **module**, and a **whole page** (note its section count). After each, dump the newest entry using this console snippet, then save the three files:
```js
(async () => {
  const open = indexedDB.open('D5Clipboard');
  const db = await new Promise(r => { open.onsuccess = () => r(open.result); });
  const os = db.transaction('clipboard','readonly').objectStore('clipboard');
  const items = JSON.parse(await new Promise(r => { const q = os.get('items'); q.onsuccess = () => r(q.result); }));
  window.__entry = items[0]; // adjust index after Step 4 confirms newest position
  const b = new Blob([JSON.stringify(window.__entry, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'entry.json'; a.click();
  return 'moduleType=' + window.__entry.payload.moduleType;
})();
```
Save as `entry.section.json`, `entry.module.json`, `entry.page.json`. Record each `moduleType` value.

- [ ] **Step 3: Write `fixtures.meta.json`**

Fill in the real counts observed:
```json
{
  "entry.section.json": { "type": "section", "childCount": 3 },
  "entry.row.json": { "type": "row", "childCount": 4 },
  "entry.module.json": { "type": "module", "childCount": 0 },
  "entry.page.json": { "type": "page", "childCount": 5 }
}
```

- [ ] **Step 4: Record the newest-entry position + page moduleType**

In `tests/fixtures/README.md`, document: (a) whether the just-copied entry appears at `items[0]` (front) or the end, and whether `timestamp` alone marks the current item; (b) the exact `payload.moduleType` string for a full page. These drive Task 5 and Task 6.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures
git commit -m "test: extract labeled Divi clipboard entry fixtures + record newest-position finding"
```

---

### Task 4: Entry type mapping + child count

**Files:**
- Create: `.../lib/entry.ts`
- Test: `.../tests/entry.test.ts`

**Interfaces:**
- Consumes: `DiviClipboardEntry`, `ItemType` (`lib/types`); fixtures + meta (Task 3).
- Produces:
  - `entryType(entry: DiviClipboardEntry): ItemType`
  - `entryChildCount(entry: DiviClipboardEntry): number`
  - `entryOrigin(entry: DiviClipboardEntry): string`

- [ ] **Step 1: Write the failing test (driven by real fixtures)**

`tests/entry.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { entryType, entryChildCount } from "../lib/entry";

const dir = dirname(fileURLToPath(import.meta.url));
const meta = JSON.parse(readFileSync(join(dir, "fixtures/fixtures.meta.json"), "utf8"));

describe("entry", () => {
  for (const [file, expected] of Object.entries<any>(meta)) {
    it(`${file}: type ${expected.type}, ${expected.childCount} children`, () => {
      const entry = JSON.parse(readFileSync(join(dir, "fixtures", file), "utf8"));
      expect(entryType(entry)).toBe(expected.type);
      expect(entryChildCount(entry)).toBe(expected.childCount);
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/entry.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `lib/entry.ts`**

Adjust the page branch per the Task 3 Step 4 finding (the real full-page `moduleType`):
```ts
import type { DiviClipboardEntry, ItemType } from "./types";

const PAGE_MODULE_TYPE = "layout"; // set to the real full-page moduleType recorded in Task 3 Step 4

export function entryType(entry: DiviClipboardEntry): ItemType {
  const mt = entry.payload.moduleType;
  if (mt === PAGE_MODULE_TYPE) return "page";
  if (mt === "section") return "section";
  if (mt === "row") return "row";
  return "module";
}

export function entryChildCount(entry: DiviClipboardEntry): number {
  const rootId = entry.payload.moduleIds[0];
  const root = entry.payload.moduleObjects[rootId];
  return root?.children?.length ?? 0;
}

export function entryOrigin(entry: DiviClipboardEntry): string {
  return entry.origin;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/entry.test.ts`
Expected: PASS. Adjust `PAGE_MODULE_TYPE` and the child-count traversal to match the real fixtures until green.

- [ ] **Step 5: Commit**

```bash
git add lib/entry.ts tests/entry.test.ts
git commit -m "feat: map Divi clipboard entry to type + child count"
```

---

### Task 5: Label builder

**Files:**
- Create: `.../lib/labels.ts`
- Test: `.../tests/labels.test.ts`

**Interfaces:**
- Consumes: `ItemType` (`lib/types`).
- Produces: `relativeTime(from, now)`, `buildLabel({ type, childCount, sourceHost, copiedAt, now })`.

- [ ] **Step 1: Write the failing test**

`tests/labels.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { relativeTime, buildLabel } from "../lib/labels";
const NOW = 1_000_000_000_000;

describe("relativeTime", () => {
  it("humanizes deltas", () => {
    expect(relativeTime(NOW - 30_000, NOW)).toBe("just now");
    expect(relativeTime(NOW - 2 * 60_000, NOW)).toBe("2m ago");
    expect(relativeTime(NOW - 3 * 3_600_000, NOW)).toBe("3h ago");
    expect(relativeTime(NOW - 5 * 86_400_000, NOW)).toBe("5d ago");
  });
});

describe("buildLabel", () => {
  it("section with pluralized rows", () => {
    expect(buildLabel({ type: "section", childCount: 3, sourceHost: "site-a.com", copiedAt: NOW - 120_000, now: NOW }))
      .toBe("Section · 3 rows · from site-a.com · 2m ago");
  });
  it("singular child", () => {
    expect(buildLabel({ type: "row", childCount: 1, sourceHost: "a.com", copiedAt: NOW, now: NOW }))
      .toBe("Row · 1 module · from a.com · just now");
  });
  it("module has no child clause", () => {
    expect(buildLabel({ type: "module", childCount: 0, sourceHost: "b.com", copiedAt: NOW, now: NOW }))
      .toBe("Module · from b.com · just now");
  });
  it("full page with sections", () => {
    expect(buildLabel({ type: "page", childCount: 4, sourceHost: "b.com", copiedAt: NOW, now: NOW }))
      .toBe("Full page · 4 sections · from b.com · just now");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/labels.test.ts`
Expected: FAIL.

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

const TITLE: Record<ItemType, string> = { module: "Module", row: "Row", section: "Section", page: "Full page" };
const CHILD_NOUN: Record<ItemType, string | null> = { module: null, row: "modules", section: "rows", page: "sections" };

export function buildLabel(p: { type: ItemType; childCount: number; sourceHost: string; copiedAt: number; now: number; }): string {
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

### Task 6: History pure logic + items array ops

**Files:**
- Create: `.../lib/history.ts`
- Create: `.../lib/clipboard-ops.ts`
- Test: `.../tests/history.test.ts`, `.../tests/clipboard-ops.test.ts`

**Interfaces:**
- Consumes: `HistoryItem`, `DiviClipboardEntry` (`lib/types`); `buildLabel` (`lib/labels`); `entryType`/`entryChildCount`/`entryOrigin` (`lib/entry`).
- Produces:
  - history: `MAX_HISTORY = 50`, `addToHistory(list, item)`, `removeFromHistory(list, id)`, `buildHistoryItem({ id, entry, sourceHost, copiedAt, now })`
  - clipboard-ops: `parseItems(raw: string): DiviClipboardEntry[]`, `serializeItems(entries): string`, `newestEntry(entries): DiviClipboardEntry | null`, `placeAsCurrent(entries, entry): DiviClipboardEntry[]`

- [ ] **Step 1: Write the failing history test**

`tests/history.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { addToHistory, removeFromHistory, buildHistoryItem, MAX_HISTORY } from "../lib/history";
import type { DiviClipboardEntry, HistoryItem } from "../lib/types";

function entry(origin: string, moduleType = "row", childIds: string[] = ["x"]): DiviClipboardEntry {
  return { clipboardType: "module", origin, payload: { moduleIds: [origin], moduleType, moduleObjects: { [origin]: { children: childIds } } } };
}
function hitem(id: string, origin = id): HistoryItem {
  return { id, type: "row", label: id, entry: entry(origin), sourceHost: "a.com", copiedAt: 0 };
}

describe("addToHistory", () => {
  it("prepends", () => {
    expect(addToHistory([hitem("a")], hitem("b")).map(i => i.id)).toEqual(["b", "a"]);
  });
  it("dedupes when the newest has the same entry origin", () => {
    const list = [hitem("a", "same")];
    expect(addToHistory(list, hitem("b", "same")).map(i => i.id)).toEqual(["a"]);
  });
  it("caps at MAX_HISTORY", () => {
    let list: HistoryItem[] = [];
    for (let i = 0; i < MAX_HISTORY + 5; i++) list = addToHistory(list, hitem(`i${i}`, `o${i}`));
    expect(list.length).toBe(MAX_HISTORY);
  });
});

describe("removeFromHistory", () => {
  it("removes by id", () => {
    expect(removeFromHistory([hitem("a"), hitem("b")], "a").map(i => i.id)).toEqual(["b"]);
  });
});

describe("buildHistoryItem", () => {
  it("labels from the entry", () => {
    const it = buildHistoryItem({ id: "x", entry: entry("o1", "section", ["r1", "r2"]), sourceHost: "a.com", copiedAt: 1000, now: 1000 });
    expect(it).toMatchObject({ id: "x", type: "section", sourceHost: "a.com" });
    expect(it.label).toBe("Section · 2 rows · from a.com · just now");
  });
});
```

- [ ] **Step 2: Write the failing clipboard-ops test**

`tests/clipboard-ops.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseItems, serializeItems, newestEntry, placeAsCurrent } from "../lib/clipboard-ops";
import type { DiviClipboardEntry } from "../lib/types";

const e = (o: string): DiviClipboardEntry => ({ clipboardType: "module", origin: o, payload: { moduleIds: [o], moduleType: "row", moduleObjects: { [o]: { children: [] } } } });

describe("clipboard-ops", () => {
  it("parses and serializes the items string", () => {
    const raw = JSON.stringify([e("a"), e("b")]);
    const list = parseItems(raw);
    expect(list.map(x => x.origin)).toEqual(["a", "b"]);
    expect(parseItems(serializeItems(list)).map(x => x.origin)).toEqual(["a", "b"]);
  });
  it("returns [] for bad input", () => {
    expect(parseItems("nope")).toEqual([]);
  });
  it("newestEntry is the front of the array", () => {
    expect(newestEntry([e("a"), e("b")])?.origin).toBe("a");
    expect(newestEntry([])).toBeNull();
  });
  it("placeAsCurrent puts the entry at the front and dedupes it", () => {
    const out = placeAsCurrent([e("a"), e("b")], e("b"));
    expect(out.map(x => x.origin)).toEqual(["b", "a"]);
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npx vitest run tests/history.test.ts tests/clipboard-ops.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 4: Implement `lib/history.ts`**

```ts
import type { DiviClipboardEntry, HistoryItem } from "./types";
import { buildLabel } from "./labels";
import { entryType, entryChildCount } from "./entry";

export const MAX_HISTORY = 50;

export function addToHistory(list: HistoryItem[], item: HistoryItem): HistoryItem[] {
  if (list.length > 0 && list[0].entry.origin === item.entry.origin) return list;
  return [item, ...list].slice(0, MAX_HISTORY);
}

export function removeFromHistory(list: HistoryItem[], id: string): HistoryItem[] {
  return list.filter(i => i.id !== id);
}

export function buildHistoryItem(args: { id: string; entry: DiviClipboardEntry; sourceHost: string; copiedAt: number; now: number; }): HistoryItem {
  const type = entryType(args.entry);
  return {
    id: args.id,
    type,
    label: buildLabel({ type, childCount: entryChildCount(args.entry), sourceHost: args.sourceHost, copiedAt: args.copiedAt, now: args.now }),
    entry: args.entry,
    sourceHost: args.sourceHost,
    copiedAt: args.copiedAt
  };
}
```

- [ ] **Step 5: Implement `lib/clipboard-ops.ts`**

`newestEntry`/`placeAsCurrent` assume the front of the array is the current item; flip if Task 3 Step 4 found otherwise.
```ts
import type { DiviClipboardEntry } from "./types";

export function parseItems(raw: string): DiviClipboardEntry[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function serializeItems(entries: DiviClipboardEntry[]): string {
  return JSON.stringify(entries);
}

export function newestEntry(entries: DiviClipboardEntry[]): DiviClipboardEntry | null {
  return entries.length ? entries[0] : null;
}

export function placeAsCurrent(entries: DiviClipboardEntry[], entry: DiviClipboardEntry): DiviClipboardEntry[] {
  const rest = entries.filter(e => e.origin !== entry.origin);
  return [entry, ...rest];
}
```

- [ ] **Step 6: Run both tests to verify they pass**

Run: `npx vitest run tests/history.test.ts tests/clipboard-ops.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/history.ts lib/clipboard-ops.ts tests/history.test.ts tests/clipboard-ops.test.ts
git commit -m "feat: history logic + Divi items array ops"
```

---

### Task 7: History storage wrapper

**Files:**
- Create: `.../lib/history-store.ts`
- Test: `.../tests/history-store.test.ts`

**Interfaces:**
- Consumes: `HistoryItem` (`lib/types`); WXT's `browser` at runtime.
- Produces: `createHistoryStore(area: StorageArea)` returning `{ getHistory, setHistory }`; default `getHistory`/`setHistory` bound to `browser.storage.local`.

- [ ] **Step 1: Write the failing test with a fake area**

`tests/history-store.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { createHistoryStore } from "../lib/history-store";
import type { HistoryItem } from "../lib/types";

function fakeArea() {
  const data: Record<string, unknown> = {};
  return {
    async get(k: string) { return { [k]: data[k] }; },
    async set(o: Record<string, unknown>) { Object.assign(data, o); }
  };
}
const item = { id: "a", type: "row", label: "L", entry: { clipboardType: "module", origin: "a", payload: { moduleIds: ["a"], moduleType: "row", moduleObjects: {} } }, sourceHost: "a.com", copiedAt: 0 } as HistoryItem;

describe("history store", () => {
  it("returns [] when empty", async () => {
    expect(await createHistoryStore(fakeArea()).getHistory()).toEqual([]);
  });
  it("round-trips", async () => {
    const s = createHistoryStore(fakeArea());
    await s.setHistory([item]);
    expect(await s.getHistory()).toEqual([item]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/history-store.test.ts`
Expected: FAIL.

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

const runtimeStore = createHistoryStore(browser.storage.local as unknown as StorageArea);
export const getHistory = runtimeStore.getHistory;
export const setHistory = runtimeStore.setHistory;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/history-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/history-store.ts tests/history-store.test.ts
git commit -m "feat: browser.storage.local history wrapper (injectable for tests)"
```

---

### Task 8: IndexedDB access module (read/write D5Clipboard)

**Files:**
- Create: `.../lib/d5-idb.ts`
- Test: `.../tests/d5-idb.test.ts`

**Interfaces:**
- Consumes: `DB_NAME`, `STORE`, `ITEMS_KEY`, `TIMESTAMP_KEY` (`lib/d5clipboard`); `parseItems`, `serializeItems`, `placeAsCurrent` (`lib/clipboard-ops`); `DiviClipboardEntry` (`lib/types`).
- Produces (all take an `IDBFactory` so they are testable with `fake-indexeddb`):
  - `readTimestamp(idb: IDBFactory): Promise<number | null>`
  - `readItems(idb: IDBFactory): Promise<DiviClipboardEntry[]>`
  - `writeCurrentEntry(idb: IDBFactory, entry: DiviClipboardEntry, now: number): Promise<void>` (places entry as current, writes `items`, bumps `timestamp`)

- [ ] **Step 1: Write the failing test (fake-indexeddb)**

`tests/d5-idb.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { DB_NAME, STORE, ITEMS_KEY, TIMESTAMP_KEY } from "../lib/d5clipboard";
import { readItems, readTimestamp, writeCurrentEntry } from "../lib/d5-idb";
import type { DiviClipboardEntry } from "../lib/types";

const entry = (o: string): DiviClipboardEntry => ({ clipboardType: "module", origin: o, payload: { moduleIds: [o], moduleType: "row", moduleObjects: { [o]: { children: [] } } } });

async function seed(idb: IDBFactory, entries: DiviClipboardEntry[], ts: number) {
  await new Promise<void>((res, rej) => {
    const open = idb.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onsuccess = () => {
      const tx = open.result.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(JSON.stringify(entries), ITEMS_KEY);
      tx.objectStore(STORE).put(ts, TIMESTAMP_KEY);
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    };
    open.onerror = () => rej(open.error);
  });
}

describe("d5-idb", () => {
  let idb: IDBFactory;
  beforeEach(() => { idb = new IDBFactory(); });

  it("reads timestamp and items", async () => {
    await seed(idb, [entry("a"), entry("b")], 111);
    expect(await readTimestamp(idb)).toBe(111);
    expect((await readItems(idb)).map(e => e.origin)).toEqual(["a", "b"]);
  });

  it("writeCurrentEntry places the entry at the front and bumps timestamp", async () => {
    await seed(idb, [entry("a"), entry("b")], 111);
    await writeCurrentEntry(idb, entry("z"), 999);
    expect((await readItems(idb)).map(e => e.origin)).toEqual(["z", "a", "b"]);
    expect(await readTimestamp(idb)).toBe(999);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/d5-idb.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `lib/d5-idb.ts`**

```ts
import { DB_NAME, STORE, ITEMS_KEY, TIMESTAMP_KEY } from "./d5clipboard";
import { parseItems, serializeItems, placeAsCurrent } from "./clipboard-ops";
import type { DiviClipboardEntry } from "./types";

function openDb(idb: IDBFactory): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = idb.open(DB_NAME);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function get<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((res, rej) => {
    const r = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    r.onsuccess = () => res(r.result as T);
    r.onerror = () => rej(r.error);
  });
}

export async function readTimestamp(idb: IDBFactory): Promise<number | null> {
  const db = await openDb(idb);
  const t = await get<number>(db, TIMESTAMP_KEY);
  return typeof t === "number" ? t : null;
}

export async function readItems(idb: IDBFactory): Promise<DiviClipboardEntry[]> {
  const db = await openDb(idb);
  const raw = await get<string>(db, ITEMS_KEY);
  return raw ? parseItems(raw) : [];
}

export async function writeCurrentEntry(idb: IDBFactory, entry: DiviClipboardEntry, now: number): Promise<void> {
  const db = await openDb(idb);
  const raw = await get<string>(db, ITEMS_KEY);
  const next = placeAsCurrent(raw ? parseItems(raw) : [], entry);
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(serializeItems(next), ITEMS_KEY);
    tx.objectStore(STORE).put(now, TIMESTAMP_KEY);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/d5-idb.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/d5-idb.ts tests/d5-idb.test.ts
git commit -m "feat: D5Clipboard IndexedDB read/write (fake-indexeddb tested)"
```

---

### Task 9: Content script (capture poll + load write)

**Files:**
- Create: `.../entrypoints/divi.content.ts`

**Interfaces:**
- Consumes: `readTimestamp`/`readItems`/`writeCurrentEntry` (`lib/d5-idb`); `newestEntry` (`lib/clipboard-ops`); `Message` (`lib/types`).
- Produces: a content script that (a) polls `timestamp` about every 1s and sends new entries to the background as `CAPTURE`, (b) on `WRITE_CLIPBOARD` calls `writeCurrentEntry` on the page's real `indexedDB`.

- [ ] **Step 1: Write the content script**

`entrypoints/divi.content.ts`:
```ts
import { readTimestamp, readItems, writeCurrentEntry } from "../lib/d5-idb";
import { newestEntry } from "../lib/clipboard-ops";
import type { Message } from "../lib/types";

export default defineContentScript({
  matches: ["<all_urls>"],
  main() {
    let lastTs: number | null = null;
    let lastOrigin: string | null = null;

    async function poll() {
      try {
        const ts = await readTimestamp(indexedDB);
        if (ts !== null && ts !== lastTs) {
          lastTs = ts;
          const entry = newestEntry(await readItems(indexedDB));
          if (entry && entry.origin !== lastOrigin) {
            lastOrigin = entry.origin;
            browser.runtime.sendMessage({
              type: "CAPTURE", entries: [entry], sourceHost: location.host, copiedAt: Date.now()
            } satisfies Message);
          }
        }
      } catch {
        // D5Clipboard absent on non-Divi pages: ignore.
      }
    }

    setInterval(poll, 1000);
    poll();

    browser.runtime.onMessage.addListener((msg: Message) => {
      if (msg.type === "WRITE_CLIPBOARD") {
        return writeCurrentEntry(indexedDB, msg.entry, Date.now()).then(() => ({ ok: true }));
      }
    });
  }
});
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: PASS; content script present in the manifest.

- [ ] **Step 3: Commit**

```bash
git add entrypoints/divi.content.ts
git commit -m "feat: content script captures via IndexedDB poll + loads on demand"
```

---

### Task 10: Background service worker (message hub)

**Files:**
- Modify: `.../entrypoints/background.ts`

**Interfaces:**
- Consumes: `getHistory`/`setHistory` (`lib/history-store`); `addToHistory`/`removeFromHistory`/`buildHistoryItem` (`lib/history`); `Message`, `HistoryItem` (`lib/types`).
- Produces: handlers for `CAPTURE`, `GET_HISTORY`, `LOAD`, `DELETE`, `CLEAR`. `GET_HISTORY`/`DELETE`/`CLEAR` resolve `HistoryItem[]`; `LOAD` resolves `{ ok: boolean }`.

- [ ] **Step 1: Implement the hub**

`entrypoints/background.ts`:
```ts
import type { HistoryItem, Message } from "../lib/types";
import { getHistory, setHistory } from "../lib/history-store";
import { addToHistory, removeFromHistory, buildHistoryItem } from "../lib/history";

let counter = 0;
const newId = () => `${Date.now()}-${counter++}`;

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(async (msg: Message): Promise<HistoryItem[] | { ok: boolean } | undefined> => {
    switch (msg.type) {
      case "CAPTURE": {
        let list = await getHistory();
        for (const entry of msg.entries) {
          list = addToHistory(list, buildHistoryItem({ id: newId(), entry, sourceHost: msg.sourceHost, copiedAt: msg.copiedAt, now: Date.now() }));
        }
        await setHistory(list);
        return;
      }
      case "GET_HISTORY":
        return await getHistory();
      case "DELETE": {
        const next = removeFromHistory(await getHistory(), msg.id);
        await setHistory(next);
        return next;
      }
      case "CLEAR":
        await setHistory([]);
        return [];
      case "LOAD": {
        const item = (await getHistory()).find(i => i.id === msg.id);
        if (!item) return { ok: false };
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return { ok: false };
        await browser.tabs.sendMessage(tab.id, { type: "WRITE_CLIPBOARD", entry: item.entry } satisfies Message);
        return { ok: true };
      }
    }
  });
});
```

- [ ] **Step 2: Verify both builds**

Run: `npm run build && npm run build:firefox`
Expected: both PASS.

- [ ] **Step 3: Commit**

```bash
git add entrypoints/background.ts
git commit -m "feat: background message hub (capture/get/load/delete/clear)"
```

---

### Task 11: Popup UI (picker, Load with reload coaching, delete, clear, funnel)

**Files:**
- Modify: `.../entrypoints/popup/index.html`, `.../entrypoints/popup/main.ts`
- Create: `.../entrypoints/popup/style.css`

**Interfaces:**
- Consumes: `HistoryItem`, `Message` (`lib/types`); background handlers via `browser.runtime.sendMessage`.
- Produces: rendered history, per-row Load (shows "Loaded, reload the Divi builder and paste"), per-row delete, Clear all, persistent bottom hint, AI Editor link.

- [ ] **Step 1: Popup HTML**

`entrypoints/popup/index.html`:
```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Divi5 Copy/Paste</title><link rel="stylesheet" href="./style.css" /></head>
  <body>
    <header><strong>Divi5 Copy/Paste</strong><button id="clear" type="button">Clear all</button></header>
    <ul id="list"></ul>
    <p id="empty" hidden>Nothing copied yet. Copy a section, row, or module in the Divi builder and it shows up here.</p>
    <footer>
      <p class="hint">Click Load, then reload the Divi builder and paste (right-click, Paste).</p>
      <a id="promo" href="https://divi5lab.com/ai-editor" target="_blank" rel="noopener">Powered by AI Editor for Divi 5</a>
    </footer>
  </body>
</html>
```

- [ ] **Step 2: Popup styles**

`entrypoints/popup/style.css`:
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

- [ ] **Step 3: Popup logic**

`entrypoints/popup/main.ts`:
```ts
import type { HistoryItem, Message } from "../../lib/types";

const listEl = document.querySelector<HTMLUListElement>("#list")!;
const emptyEl = document.querySelector<HTMLParagraphElement>("#empty")!;
const send = <T>(msg: Message): Promise<T> => browser.runtime.sendMessage(msg) as Promise<T>;

function render(items: HistoryItem[]) {
  listEl.innerHTML = "";
  emptyEl.hidden = items.length > 0;
  for (const item of items) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = item.label;

    const load = document.createElement("button");
    load.type = "button"; load.textContent = "Load";
    load.addEventListener("click", async () => {
      const res = await send<{ ok: boolean }>({ type: "LOAD", id: item.id });
      if (res.ok) { label.className = "label loaded"; label.textContent = "Loaded, now reload the Divi builder and paste."; }
    });

    const del = document.createElement("button");
    del.type = "button"; del.textContent = "×"; del.title = "Remove";
    del.addEventListener("click", async () => render(await send<HistoryItem[]>({ type: "DELETE", id: item.id })));

    li.append(label, load, del);
    listEl.append(li);
  }
}

document.querySelector("#clear")!.addEventListener("click", async () => render(await send<HistoryItem[]>({ type: "CLEAR" })));
send<HistoryItem[]>({ type: "GET_HISTORY" }).then(render);
```

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Manual smoke test (two Divi sites)**

1. `npm run dev` (Chrome) or load `.output/chrome-mv3` unpacked at `chrome://extensions`.
2. On Divi Site A builder, copy a section, open the popup: item appears with correct label.
3. On Divi Site B builder, open the popup, click Load, see the reload coaching, reload the builder, right-click Paste. The section pastes.
4. Also try pasting WITHOUT reload; note whether it works (informs whether the reload step can be dropped).
5. Delete and Clear all update the list.

- [ ] **Step 6: Commit**

```bash
git add entrypoints/popup
git commit -m "feat: popup picker with load/reload coaching/delete/clear + funnel link"
```

---

### Task 12: Whole-page verification + cross-browser packaging + docs

**Files:**
- Modify: `.../lib/entry.ts` (finalize `PAGE_MODULE_TYPE` if not already), `.../README.md`
- Create: `.../docs/manual-test-matrix.md`

**Interfaces:**
- Consumes: the whole extension.
- Produces: verified page support, shippable zips, documented verification.

- [ ] **Step 1: Confirm whole-page capture/load end to end**

With `entry.page.json` in fixtures and `PAGE_MODULE_TYPE` set (Task 4), copy a whole page on Site A, confirm a "Full page ..." item appears, Load on Site B, reload, paste the whole page. If the page uses a different array position or a distinct load path, adjust `clipboard-ops`/`d5-idb` and re-run the affected unit tests.

- [ ] **Step 2: Full test suite**

Run: `npm run test`
Expected: all suites PASS.

- [ ] **Step 3: Produce both store zips**

Run: `npm run zip && npm run zip:firefox`
Expected: one zip per browser.

- [ ] **Step 4: Verify unpacked loads in both browsers**

Chrome/Edge: load `.output/chrome-mv3` at `chrome://extensions`. Firefox: `about:debugging` -> This Firefox -> Load Temporary Add-on. Confirm capture + load work in each.

- [ ] **Step 5: Write `docs/manual-test-matrix.md`**

Table of {module, row, section, page} × {captured with right label, Load+reload+paste works on a second site, delete, clear} across Chrome and Firefox. Include the no-reload observation. This is the release checklist.

- [ ] **Step 6: Finalize `README.md`**

Document install-from-store (placeholder URLs), install-unpacked for dev, the fragility note (if capture/load stops after a Divi update, the `D5Clipboard` names in `lib/d5clipboard.ts` likely changed), and the same-browser-only limitation. No em dashes.

- [ ] **Step 7: Commit and tag v1**

```bash
git add -A && git commit -m "chore: page verification, cross-browser zips, README, test matrix (v1)"
git tag v1.0.0
```

---

## Self-Review Notes

**Spec coverage:**
- IndexedDB mechanism (D5Clipboard/clipboard/items/timestamp): Tasks 2, 8, 9.
- Capture via timestamp poll, no MAIN-world injection: Task 9.
- Load = place entry as current + reload coaching: Tasks 8 (`writeCurrentEntry`), 10 (LOAD), 11 (coaching copy).
- Entry type from `payload.moduleType`, child count from `moduleObjects`: Task 4.
- Cross-site history picker (cap 50, dedupe by origin): Tasks 6, 7, 11.
- Whole page (type "page"): Tasks 3, 4, 12.
- Fragility isolated to `lib/d5clipboard.ts`, quiet-safe failure: Tasks 2, 9 (try/catch), README (Task 12).
- Cross-browser one-codebase-two-builds: Tasks 1, 10, 12.
- Positioning/funnel link: Task 11; README Task 12.
- Testing (type/label, trim/dedupe, entry round-trip, IDB ops; manual two-site matrix): Tasks 4-8 (unit), 11, 12 (manual).

**Type consistency:** `DiviClipboardEntry`, `HistoryItem`, `ItemType`, `Message` defined in Task 2, used unchanged in Tasks 4-11. `entryType`/`entryChildCount`/`entryOrigin` (Task 4) consumed by `buildHistoryItem` (Task 6). `parseItems`/`serializeItems`/`placeAsCurrent`/`newestEntry` (Task 6) consumed by `d5-idb` (Task 8) and the content script (Task 9). `readTimestamp`/`readItems`/`writeCurrentEntry` (Task 8) consumed by the content script (Task 9). D5Clipboard constants (Task 2) consumed by Tasks 8, 9.

**Inspection-dependent points (validated during build, not invented):**
- Newest-entry array position (front assumed in `newestEntry`/`placeAsCurrent`; confirm in Task 3 Step 4, flip if needed).
- Full-page `moduleType` value (`PAGE_MODULE_TYPE` in `lib/entry.ts`; set from `entry.page.json`).
- Whether paste needs a builder reload (default: reload; Task 11 Step 4 tests the no-reload case to possibly drop it).
