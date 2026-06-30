# Cards Category Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browsable "Cards" layout category (grids of icon/numbered cards with an animated wrapper), generated as Divi 5 sections via the existing `set` mode, filterable by column count.

**Architecture:** Extend the existing variant infrastructure (`layouts.variant` jsonb, `buildVariantSet`, `set` CLI mode, `VariantSwitcher`) with a new `cards` type and an `iconStyle` axis. Cards are real Divi modules (column wrapper + `divi/blurb` + Divi-native icons). A `columns` catalog filter (backed by `variant.columns`) makes "Cards · N columns" browsable.

**Tech Stack:** Next.js App Router, Drizzle ORM (Postgres), TypeScript, Vitest, the existing TS generation pipeline + PHP deterministic validator.

## Global Constraints

- Icons MUST be Divi-native (`type:"divi"`/`"fa"`) using glyph unicodes from the grounding recipes (`icon-features`, `blurb-grid`, `icon-values`) — never literal Material Icons, never invented glyph codes. (Must render on a buyer's site.)
- No DB migration — `variant` is jsonb; only the TS `$type<>` changes.
- Variant axes: `columns ∈ {2,3,4}`, `icons ∈ {top,left}` (placement), `iconStyle ∈ {circle,plain,number}`. Full matrix = 18 per niche/style base.
- Card wrapper = the `divi/column`, with background + border-radius + box-shadow + hover lift (`decoration.transform`/`boxShadow` `.hover` values — validator-supported).
- Never publish a layout that fails validation; generated layouts land `pending` and need approval.
- Reuse existing patterns (filters/query-builder/facetCounts/FacetFilters/VariantSwitcher); keep files focused.

---

### Task 1: Variant model — `iconStyle` axis (schema, Target, buildVariantSet, CLI)

**Files:**
- Modify: `db/schema.ts:79` (variant `$type`)
- Modify: `pipeline/recipes/matrix.ts:11` (Target.variant), `:15-44` (ICON_PHRASE, buildVariantSet)
- Modify: `pipeline/index.ts:59-63` (set-mode arg parsing)
- Test: `tests/variant-set.test.ts` (new)

**Interfaces:**
- Produces: `buildVariantSet(base, columns: number[], icons: ('none'|'top'|'left')[], iconStyles: ('circle'|'plain'|'number')[]): Target[]`; `Target.variant = { group: string; columns: number; icons: 'none'|'top'|'left'; iconStyle: 'circle'|'plain'|'number' }`.

- [ ] **Step 1: Write the failing test** — `tests/variant-set.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { buildVariantSet } from '@/pipeline/recipes/matrix';

describe('buildVariantSet', () => {
  const base = { type: 'cards', niche: 'saas', style: 'minimal' };

  it('produces the full columns × icons × iconStyle matrix', () => {
    const out = buildVariantSet(base, [2, 3, 4], ['top', 'left'], ['circle', 'plain', 'number']);
    expect(out).toHaveLength(18); // 3 × 2 × 3
    // every combo is unique and well-formed
    const keys = new Set(out.map((t) => `${t.variant!.columns}|${t.variant!.icons}|${t.variant!.iconStyle}`));
    expect(keys.size).toBe(18);
    for (const t of out) {
      expect(t.type).toBe('cards');
      expect(t.variant!.group).toBe('cards-saas-minimal');
      expect([2, 3, 4]).toContain(t.variant!.columns);
      expect(['top', 'left']).toContain(t.variant!.icons);
      expect(['circle', 'plain', 'number']).toContain(t.variant!.iconStyle);
      expect(t.layout).toMatch(/column/); // composition phrase present
    }
  });

  it('reflects the dimensions in the layout phrase', () => {
    const [t] = buildVariantSet(base, [3], ['top'], ['number']);
    expect(t.layout).toContain('3');
    expect(t.layout?.toLowerCase()).toContain('number');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/variant-set.test.ts`
Expected: FAIL — `buildVariantSet` currently takes 3 args / `variant` has no `iconStyle`.

- [ ] **Step 3: Extend the schema variant type** — `db/schema.ts` line 79

Replace:
```ts
  variant: jsonb('variant').$type<{ group?: string; columns?: number; icons?: 'none' | 'top' | 'left' }>(),
```
with:
```ts
  variant: jsonb('variant').$type<{ group?: string; columns?: number; icons?: 'none' | 'top' | 'left'; iconStyle?: 'circle' | 'plain' | 'number' }>(),
```

- [ ] **Step 4: Extend Target + buildVariantSet** — `pipeline/recipes/matrix.ts`

Replace the `Target.variant` field (line 11):
```ts
  variant?: { group: string; columns: number; icons: 'none' | 'top' | 'left'; iconStyle: 'circle' | 'plain' | 'number' };
```

Replace the `ICON_PHRASE` const and `buildVariantSet` (lines 15-44) with:
```ts
const ICON_PHRASE: Record<'none' | 'top' | 'left', string> = {
  none: 'no icons',
  top: 'an icon centered on top of each card',
  left: 'an icon to the left of each card title',
};

const ICON_STYLE_PHRASE: Record<'circle' | 'plain' | 'number', string> = {
  circle: 'in a filled circular badge',
  plain: 'as a bare icon',
  number: 'shown as a numbered step badge',
};

// Build a switchable SET of card-section variants: every column count × icon
// placement × icon style for one niche/style, all sharing a `group` so the UI can
// cross-link them (Columns 2·3·4, Icons top·left, Style circle·plain·number).
export function buildVariantSet(
  base: { type: string; niche: string; style: string; color?: string },
  columns: number[],
  icons: ('none' | 'top' | 'left')[],
  iconStyles: ('circle' | 'plain' | 'number')[],
): Target[] {
  const group = `${base.type}-${base.niche}-${base.style}`;
  const out: Target[] = [];
  for (const c of columns) {
    for (const ic of icons) {
      for (const st of iconStyles) {
        out.push({
          type: base.type,
          niche: base.niche,
          style: base.style,
          color: base.color,
          layout: `${c} equal columns of cards, with ${ICON_PHRASE[ic]}, ${ICON_STYLE_PHRASE[st]}`,
          variant: { group, columns: c, icons: ic, iconStyle: st },
        });
      }
    }
  }
  return out;
}
```

- [ ] **Step 5: Wire the CLI `--icon-styles` arg** — `pipeline/index.ts`

Replace the `set` branch (lines 59-63) with:
```ts
  if (mode === 'set') {
    const base = { type: arg('type') ?? 'cards', niche: arg('niche') ?? 'saas', style: arg('style') ?? 'minimal', color: arg('color') };
    const columns = (arg('columns') ?? '2,3,4').split(',').map(Number).filter((n) => n > 0);
    const icons = (arg('icons') ?? 'top,left').split(',').map((s) => s.trim()).filter(Boolean) as ('none' | 'top' | 'left')[];
    const iconStyles = (arg('icon-styles') ?? 'circle,plain,number').split(',').map((s) => s.trim()).filter(Boolean) as ('circle' | 'plain' | 'number')[];
    targets = buildVariantSet(base, columns, icons, iconStyles);
  } else if (mode === 'vary') {
```

Also update the usage string (line 46) to:
```ts
    console.log('Usage: npm run pipeline -- <batch|drip [--count=N]|vary [--type=] [--count=N]|set [--type=cards --niche= --style= --columns=2,3,4 --icons=top,left --icon-styles=circle,plain,number]> [--dry-run]');
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test -- tests/variant-set.test.ts` → Expected: PASS (2 tests).
Run: `npm run typecheck` → Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add db/schema.ts pipeline/recipes/matrix.ts pipeline/index.ts tests/variant-set.test.ts
git commit -m "feat(cards): add iconStyle variant axis to set mode"
```

---

### Task 2: Cards generation prompt + recipe grounding

**Files:**
- Modify: `pipeline/recipes/prompts.ts` (`RECIPE_BY_TYPE`, `directives()`)
- Modify: `pipeline/recipes/matrix.ts` (`LAYOUTS_BY_TYPE` — add `cards`)
- Test: `tests/cards-prompt.test.ts` (new)

**Interfaces:**
- Consumes: `Target` with `type:'cards'` + `variant` (Task 1).
- Produces: `directives(target)` emits card-wrapper + hover + icon-style + column instructions when `target.type === 'cards'`.

- [ ] **Step 1: Write the failing test** — `tests/cards-prompt.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { buildGenerationPrompt } from '@/pipeline/recipes/prompts';
import { loadGrounding } from '@/pipeline/recipes';

// Minimal guide stub so the test doesn't depend on the validator repo being present.
const guide = { recipes: [{ name: 'icon-values', description: 'icon cards', markup: '<!-- wp:divi/icon -->' }], examples: [] } as any;

describe('cards prompt directives', () => {
  const target = { type: 'cards', niche: 'saas', style: 'minimal', layout: '3 equal columns of cards', variant: { group: 'cards-saas-minimal', columns: 3, icons: 'top', iconStyle: 'circle' } } as const;

  it('describes the animated card wrapper and circular icon badge', () => {
    const { prompt } = buildGenerationPrompt(target as any, guide);
    const p = prompt.toLowerCase();
    expect(p).toContain('hover');         // hover lift
    expect(p).toContain('box shadow');    // wrapper shadow
    expect(p).toContain('border');        // rounded corners
    expect(p).toMatch(/circular|circle/); // circle badge for iconStyle:circle
    expect(p).toContain('divi');          // divi-native icon constraint
  });

  it('uses a numbered badge when iconStyle is number', () => {
    const t = { ...target, variant: { ...target.variant, iconStyle: 'number' } };
    const { prompt } = buildGenerationPrompt(t as any, guide);
    expect(prompt.toLowerCase()).toContain('number');
  });
});
```

> Note for implementer: confirm the exact export name/shape of the prompt builder in `pipeline/recipes/prompts.ts` (it composes `directives()` + examples into `{ system, prompt }`). If the public builder is named differently, import that and assert on its returned prompt text; the assertions on substrings stay the same.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/cards-prompt.test.ts`
Expected: FAIL — directives() has no cards branch, so hover/circle/number text is absent.

- [ ] **Step 3: Add cards grounding + composition** 

In `pipeline/recipes/prompts.ts`, add to `RECIPE_BY_TYPE`:
```ts
  cards: ['icon-values', 'blurb-grid', 'card-grid-3'],
```
In `pipeline/recipes/matrix.ts` `LAYOUTS_BY_TYPE`, add:
```ts
  cards: ['equal columns of icon cards', 'equal columns of numbered step cards'],
```

- [ ] **Step 4: Add the cards branch to `directives()`** — `pipeline/recipes/prompts.ts`

Insert, before the `return lines.join('\n')`:
```ts
  if (target.type === 'cards') {
    const v = target.variant;
    const cols = v?.columns ?? 3;
    lines.push(
      `Build a section of ${cols} equal-width card columns. Each card IS the divi/column, styled as the wrapper: a white (or, for dark/colored sets, a tinted) background, rounded corners (decoration.border.radius ~20px), generous padding (~36px), and a soft box shadow. On hover the card lifts — set the column's hover decoration: transform translate Y about -6px plus a deeper box shadow and a smooth transition.`,
    );
    const placement = v?.icons === 'left' ? 'to the left of the heading' : 'centered above the heading';
    if (v?.iconStyle === 'number') {
      lines.push(`Put a numbered step badge (1, 2, 3 …) ${placement}: a number inside a filled circle (decoration.border.radius 50%, colored background, contrasting text). No icon glyph.`);
    } else {
      const badge = v?.iconStyle === 'circle' ? 'inside a filled circular badge (colored background, border.radius 50%)' : 'as a bare icon with no background';
      lines.push(`Give each card a Divi icon ${placement}, ${badge}. Use a divi/blurb (or divi/icon) with type:"divi" or type:"fa" and a real glyph matching the card topic — choose glyph unicodes ONLY from the grounding recipes (icon-features, blurb-grid, icon-values); never invent icon codes.`);
    }
    lines.push('Each card: the icon/badge + a short heading + 1–2 specific sentences; optionally a small text link or button. Real copy, no lorem ipsum.');
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- tests/cards-prompt.test.ts` → Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add pipeline/recipes/prompts.ts pipeline/recipes/matrix.ts tests/cards-prompt.test.ts
git commit -m "feat(cards): card-wrapper + hover + icon-style generation directives"
```

---

### Task 3: Catalog — `cards` type + `columns` filter axis

**Files:**
- Modify: `lib/catalog/filters.ts` (AXIS_VALUES, CatalogFilters, parseFilters)
- Modify: `lib/catalog/query-builder.ts` (columns condition)
- Modify: `lib/catalog/queries.ts` (facetCounts → include columns)
- Test: `tests/catalog-filters.test.ts` (extend or new `tests/cards-filters.test.ts`)

**Interfaces:**
- Produces: `CatalogFilters.columns: string[]`; `parseFilters` reads `columns`; `buildLayoutFilters` filters by `variant->>'columns'`; `facetCounts()` returns a `columns` axis.

- [ ] **Step 1: Write the failing test** — `tests/cards-filters.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { parseFilters, AXIS_VALUES } from '@/lib/catalog/filters';
import { buildLayoutFilters } from '@/lib/catalog/query-builder';

describe('cards filters', () => {
  it('lists cards as a type and 2/3/4 as columns axis values', () => {
    expect(AXIS_VALUES.type).toContain('cards');
    expect(AXIS_VALUES.columns).toEqual(['2', '3', '4']);
  });

  it('parses the columns query param against the allowed set', () => {
    const f = parseFilters({ type: 'cards', columns: '3,4,99' });
    expect(f.type).toEqual(['cards']);
    expect(f.columns).toEqual(['3', '4']); // 99 rejected
  });

  it('adds a SQL condition when columns are selected', () => {
    const withCols = buildLayoutFilters(parseFilters({ columns: '3' }));
    const without = buildLayoutFilters(parseFilters({}));
    expect(withCols.conditions.length).toBe(without.conditions.length + 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/cards-filters.test.ts`
Expected: FAIL — no `cards` type, no `columns` axis.

- [ ] **Step 3: Add cards + columns to filters** — `lib/catalog/filters.ts`

Add `'cards'` to `AXIS_VALUES.type` (after `'features'`), and add a `columns` axis:
```ts
export const AXIS_VALUES = {
  type: ['hero', 'pricing', 'testimonials', 'cta', 'features', 'cards', 'faq', 'footer', 'contact', 'gallery', 'blog', 'full_landing'],
  niche: ['saas', 'agency', 'restaurant', 'real_estate', 'fitness', 'coaching', 'ecommerce', 'nonprofit', 'portfolio', 'events'],
  style: ['minimal', 'bold', 'dark', 'corporate', 'playful', 'elegant'],
  color: ['blue', 'green', 'red', 'purple', 'orange', 'monochrome', 'pastel'],
  columns: ['2', '3', '4'],
} as const;
```
Add `columns` to `CatalogFilters`:
```ts
export interface CatalogFilters {
  type: string[];
  niche: string[];
  style: string[];
  color: string[];
  columns: string[];
  q?: string;
  sort: SortKey;
  page: number;
}
```
In `parseFilters`, add after the `color` line and include in the return:
```ts
  const columns = readMulti(searchParams.columns, AXIS_VALUES.columns);
  // …
  return { type, niche, style, color, columns, q, sort, page };
```

- [ ] **Step 4: Filter by columns (jsonb path)** — `lib/catalog/query-builder.ts`

Add `sql` to the drizzle import, and add the condition after the `color` condition:
```ts
import { and, eq, inArray, ilike, or, arrayOverlaps, asc, desc, sql, type SQL } from 'drizzle-orm';
// …
  if (f.columns.length) {
    conditions.push(inArray(sql`(${layouts.variant} ->> 'columns')`, f.columns) as SQL);
  }
```

- [ ] **Step 5: Count columns in facetCounts** — `lib/catalog/queries.ts`

Change the `facetCounts` return type + select + loop to include `columns`:
```ts
export async function facetCounts(): Promise<Record<'type' | 'niche' | 'style' | 'color' | 'columns', Record<string, number>>> {
  const rows = await db.select({
    type: layouts.type, niche: layouts.niche, style: layouts.style, colors: layouts.colors, variant: layouts.variant,
  }).from(layouts).where(eq(layouts.status, 'published'));

  const counts = { type: {}, niche: {}, style: {}, color: {}, columns: {} } as Record<'type' | 'niche' | 'style' | 'color' | 'columns', Record<string, number>>;
  const bump = (axis: 'type' | 'niche' | 'style' | 'color' | 'columns', key: string | null) => {
    if (!key) return;
    counts[axis][key] = (counts[axis][key] ?? 0) + 1;
  };
  for (const r of rows) {
    bump('type', r.type);
    bump('niche', r.niche);
    bump('style', r.style);
    for (const c of r.colors ?? []) bump('color', c);
    if (r.variant?.columns != null) bump('columns', String(r.variant.columns));
  }
  return counts;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test -- tests/cards-filters.test.ts` → Expected: PASS (3 tests).
Run: `npm run test` → Expected: existing catalog/seed/sitemap tests still green (the new `cards` type is valid everywhere AXIS_VALUES is used).
Run: `npm run typecheck` → Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/catalog/filters.ts lib/catalog/query-builder.ts lib/catalog/queries.ts tests/cards-filters.test.ts
git commit -m "feat(cards): cards type + columns filter axis in the catalog"
```

---

### Task 4: Browse UI — Columns facet + Cards nav

**Files:**
- Modify: `components/FacetFilters.tsx` (add Columns facet)
- Modify: `lib/nav/menu-data.ts` (TYPE_LABELS + type blurb for `cards`)
- Test: `tests/menu-data.test.ts` (new, light)

**Interfaces:**
- Consumes: `facetCounts()` now returns `columns` (Task 3); `AXIS_VALUES.columns` (Task 3).

- [ ] **Step 1: Write the failing test** — `tests/menu-data.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { TYPE_LABELS } from '@/lib/nav/menu-data';

describe('menu-data', () => {
  it('labels the cards type', () => {
    expect(TYPE_LABELS.cards).toBe('Cards');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/menu-data.test.ts`
Expected: FAIL — `TYPE_LABELS.cards` is undefined.

- [ ] **Step 3: Add cards to nav data** — `lib/nav/menu-data.ts`

In the `type` map (near the other type entries), add:
```ts
    cards: { icon: 'dashboard', blurb: 'Icon & numbered card grids' },
```
In `TYPE_LABELS`, add:
```ts
  cards: 'Cards',
```

- [ ] **Step 4: Add the Columns facet** — `components/FacetFilters.tsx`

Add `'columns'` to the `AXES` list with a label, and special-case its display so values read "N columns":
```ts
const AXES: { key: keyof typeof AXIS_VALUES; label: string }[] = [
  { key: 'type', label: 'Type' },
  { key: 'columns', label: 'Columns' },
  { key: 'niche', label: 'Industry' },
  { key: 'style', label: 'Style' },
  { key: 'color', label: 'Color' },
];
```
In the value `<span>` (currently `{value.replace('_', ' ')}`), render columns specially:
```tsx
                    <span className="capitalize">{key === 'columns' ? `${value} columns` : value.replace('_', ' ')}</span>
```
And include `columns` in the `activeCount` reduce (it already iterates `AXES`, so this is automatic — verify no separate hardcoded axis list elsewhere needs updating).

- [ ] **Step 5: Run tests + manual sanity**

Run: `npm run test -- tests/menu-data.test.ts` → Expected: PASS.
Run: `npm run build` → Expected: compiles; `/browse` renders a Columns facet (2/3/4) and a Cards type checkbox.

- [ ] **Step 6: Commit**

```bash
git add components/FacetFilters.tsx lib/nav/menu-data.ts tests/menu-data.test.ts
git commit -m "feat(cards): Columns facet + Cards nav entry"
```

---

### Task 5: VariantSwitcher — third axis (icon style)

**Files:**
- Modify: `components/VariantSwitcher.tsx`
- Test: `tests/variant-switcher.test.ts` (new — extract + test the sibling-matching helper)

**Interfaces:**
- Consumes: `LayoutRow.variant` with `iconStyle` (Task 1).

- [ ] **Step 1: Extract a pure helper + write the failing test**

To make the 3-axis matching testable, extract the "find a sibling differing in exactly one axis" logic into a pure exported function. Create the test `tests/variant-switcher.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findSibling } from '@/components/VariantSwitcher';

const sib = (slug: string, columns: number, icons: string, iconStyle: string) =>
  ({ slug, variant: { group: 'g', columns, icons, iconStyle } }) as any;

describe('findSibling', () => {
  const siblings = [sib('a', 3, 'top', 'circle'), sib('b', 4, 'top', 'circle'), sib('c', 3, 'left', 'circle'), sib('d', 3, 'top', 'number')];
  const current = { columns: 3, icons: 'top', iconStyle: 'circle' } as const;

  it('finds the sibling that changes only the column count', () => {
    expect(findSibling(siblings, { ...current, columns: 4 })?.slug).toBe('b');
  });
  it('finds the sibling that changes only the icon style', () => {
    expect(findSibling(siblings, { ...current, iconStyle: 'number' })?.slug).toBe('d');
  });
  it('returns undefined when no exact sibling exists', () => {
    expect(findSibling(siblings, { ...current, columns: 2 })).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- tests/variant-switcher.test.ts`
Expected: FAIL — `findSibling` is not exported.

- [ ] **Step 3: Add the helper + third axis row** — `components/VariantSwitcher.tsx`

Add the exported helper near the top:
```tsx
type VKey = { columns?: number; icons?: string; iconStyle?: string };
export function findSibling(siblings: { slug: string; variant?: VKey | null }[], want: VKey) {
  return siblings.find(
    (s) => s.variant?.columns === want.columns && s.variant?.icons === want.icons && s.variant?.iconStyle === want.iconStyle,
  );
}
const STYLE_LABEL: Record<string, string> = { circle: 'Circle badge', plain: 'Plain icon', number: 'Numbered' };
```
Update the existing rows to match on all three axes via `findSibling`, keeping the other two axes fixed. Replace the `find` closure and the two existing rows, and add a third row for `iconStyle`:
```tsx
  const cur = current.variant;
  if (!cur?.group || siblings.length < 2) return null;
  const columns = [...new Set(siblings.map((s) => s.variant?.columns).filter((n): n is number => typeof n === 'number'))].sort((a, b) => a - b);
  const icons = ['top', 'left'].filter((ic) => siblings.some((s) => s.variant?.icons === ic));
  const styles = ['circle', 'plain', 'number'].filter((st) => siblings.some((s) => s.variant?.iconStyle === st));
```
Columns row chip href:
```tsx
              const sib = findSibling(siblings, { columns: c, icons: cur.icons, iconStyle: cur.iconStyle });
```
Icons row chip href:
```tsx
              const sib = findSibling(siblings, { columns: cur.columns, icons: ic, iconStyle: cur.iconStyle });
```
New icon-style row (after the icons row), mirroring the markup of the other rows:
```tsx
        {styles.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-small text-muted">Style</span>
            {styles.map((st) => {
              const sib = findSibling(siblings, { columns: cur.columns, icons: cur.icons, iconStyle: st });
              return (
                <Chip key={st} active={st === cur.iconStyle} href={sib && st !== cur.iconStyle ? `/layouts/${sib.slug}` : undefined}>
                  {STYLE_LABEL[st]}
                </Chip>
              );
            })}
          </div>
        )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- tests/variant-switcher.test.ts` → Expected: PASS (3 tests).
Run: `npm run typecheck && npm run lint` → Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add components/VariantSwitcher.tsx tests/variant-switcher.test.ts
git commit -m "feat(cards): VariantSwitcher icon-style axis"
```

---

### Task 6: Generate, validate, and publish the Cards sets (operational)

**Files:** none (uses the pipeline + prod DB/Blob). Not TDD — this is a generation run with verification.

**Preconditions:** Docker WP+Divi render env up; `.env.local` sourced; `VALIDATOR_CMD`/`VALIDATOR_DIR` set; `INGEST_URL=https://divi5lab.com`; `PIPELINE_MAX_BUDGET_USD` set (e.g. 3). Full suite green from Tasks 1-5.

- [ ] **Step 1: Dry-run the matrix (no Claude spend, no ingest)**

```bash
npm run pipeline -- set --type=cards --niche=saas --style=minimal --columns=2,3,4 --icons=top,left --icon-styles=circle,plain,number --dry-run
```
Expected: lists 18 targets (cards/saas/minimal) with the 18 distinct variant combos.

- [ ] **Step 2: Generate niche 1 (SaaS) → prod (pending)**

```bash
npm run pipeline -- set --type=cards --niche=saas --style=minimal --columns=2,3,4 --icons=top,left --icon-styles=circle,plain,number
```
Expected: summary shows `generated`/`ingested` near 18 (a few may drop on validation; that's fine). Watch for validator failures in the log.

- [ ] **Step 3: Generate niche 2 (coaching) → prod (pending)**

```bash
npm run pipeline -- set --type=cards --niche=coaching --style=elegant --columns=2,3,4 --icons=top,left --icon-styles=circle,plain,number
```

- [ ] **Step 4: Spot-check renders before publishing**

Fetch 2-3 of the new pending layouts' desktop + mobile preview blobs and view them. Confirm: real Divi icons (not tofu), card wrapper has bg/radius/shadow, columns correct, mobile stacks to one column. If a variant is broken, note it and exclude from publish.

- [ ] **Step 5: Publish the good ones + verify live**

Approve the new `cards` pending layouts (set `status='published'`). Then:
- `https://divi5lab.com/browse?type=cards` shows the cards.
- The **Columns** facet filters to 2/3/4.
- A card detail page shows the **VariantSwitcher** with Columns / Icons / Style rows that navigate between siblings.

- [ ] **Step 6: Report** generated/ingested/published counts, any dropped variants, and live URLs.

---

## Self-Review

**Spec coverage:**
- New `cards` type → Tasks 3 (filters), 4 (nav). ✓
- Variant model (columns/icons/iconStyle) → Task 1. ✓
- Card wrapper + hover animation → Task 2 (directives). ✓
- Divi-native icons (no Material/tofu) → Global Constraints + Task 2 directive. ✓
- Generation via set mode (full matrix) → Tasks 1, 6. ✓
- Browse/SEO surfacing (Cards type, Columns filter, nav) → Tasks 3, 4. `/type/cards` taxonomy page is produced automatically by the existing programmatic SEO from published `cards` rows — no new code (verify in Task 6 Step 5). ✓
- VariantSwitcher cross-link → Task 5. ✓
- Testing → tests in Tasks 1-5. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. Task 2 carries one implementer note to confirm the prompt-builder export name (genuine codebase lookup, not a placeholder for logic).

**Type consistency:** `variant` shape `{ group, columns, icons, iconStyle }` is identical in `db/schema.ts`, `Target` (matrix.ts), `buildVariantSet`, `findSibling`, and `facetCounts`. `iconStyle` values `'circle'|'plain'|'number'` and `icons` values `'none'|'top'|'left'` are consistent across Tasks 1, 2, 5. `AXIS_VALUES.columns` is `string[]` (`'2'|'3'|'4'`) consistently in filters, query-builder (`->>'columns'` text compare), and facetCounts (`String(...)`).
