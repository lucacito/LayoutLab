import { describe, expect, it } from 'vitest';
import codepoints from '@/pipeline/recipes/divi-icon-codepoints.json';
import {
  ICON_CATALOG,
  NICHE_TOPICS,
  formatIconForPrompt,
  iconCatalogEnabled,
  iconPickList,
} from '@/pipeline/recipes/icons';
import { AXIS_VALUES } from '@/lib/catalog/filters';

describe('ICON_CATALOG integrity', () => {
  it('every entry exists in the shipped font cmap (THE hallucination gate)', () => {
    for (const e of ICON_CATALOG) {
      const bucket = e.weight === '900' ? 'fa-solid-900' : 'fa-regular-400';
      expect(codepoints[bucket], `${e.name} (${e.unicode}, w${e.weight})`).toContain(e.unicode);
    }
  });

  it('is reasonably sized, unique, and well-formed', () => {
    expect(ICON_CATALOG.length).toBeGreaterThanOrEqual(60);
    const keys = ICON_CATALOG.map((e) => `${e.type}|${e.weight}|${e.unicode}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of ICON_CATALOG) {
      expect(e.unicode).toMatch(/^[0-9a-f]{4}$/);
      expect(e.name).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(e.topics.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every topic used exists in NICHE_TOPICS coverage or is "general"', () => {
    const known = new Set<string>(['general', ...Object.values(NICHE_TOPICS).flat()]);
    for (const e of ICON_CATALOG) {
      for (const t of e.topics) expect(known.has(t), `${e.name} topic "${t}"`).toBe(true);
    }
  });

  it('every catalog niche key is a real AXIS niche, and every AXIS niche is covered', () => {
    const niches: readonly string[] = AXIS_VALUES.niche;
    for (const key of Object.keys(NICHE_TOPICS)) expect(niches).toContain(key);
    for (const n of niches) expect(NICHE_TOPICS[n], `niche "${n}"`).toBeDefined();
  });
});

describe('iconPickList', () => {
  it('is deterministic and capped', () => {
    const a = iconPickList('fitness');
    const b = iconPickList('fitness');
    expect(a.map((e) => e.name)).toEqual(b.map((e) => e.name));
    expect(a.length).toBeLessThanOrEqual(20);
    expect(a.length).toBeGreaterThanOrEqual(10);
  });

  it('is topic-relevant: fitness list contains fitness glyphs, not food ones', () => {
    const names = iconPickList('fitness').map((e) => e.name);
    expect(names).toContain('dumbbell');
    expect(names).not.toContain('utensils');
  });

  it('unknown/undefined niche falls back to general-topic glyphs without throwing', () => {
    for (const niche of [undefined, 'not-a-niche']) {
      const list = iconPickList(niche);
      expect(list.length).toBeGreaterThanOrEqual(10);
    }
  });

  it('respects a custom max', () => {
    expect(iconPickList('saas', 5)).toHaveLength(5);
  });
});

describe('formatIconForPrompt', () => {
  it('emits the exact Divi-JSON-usable shape', () => {
    const check = ICON_CATALOG.find((e) => e.name === 'check')!;
    expect(formatIconForPrompt(check)).toBe('check (type:"fa", weight:"900", unicode:"&#xf00c;")');
  });
});

describe('iconCatalogEnabled', () => {
  it('defaults on; ICON_CATALOG=0 disables', () => {
    const prev = process.env.ICON_CATALOG;
    delete process.env.ICON_CATALOG;
    expect(iconCatalogEnabled()).toBe(true);
    process.env.ICON_CATALOG = '0';
    expect(iconCatalogEnabled()).toBe(false);
    if (prev === undefined) delete process.env.ICON_CATALOG;
    else process.env.ICON_CATALOG = prev;
  });
});
