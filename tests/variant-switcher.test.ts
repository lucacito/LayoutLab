import { describe, it, expect } from 'vitest';
import { findSibling } from '@/components/VariantSwitcher';

const sib = (slug: string, columns: number, icons: string, iconStyle: string) =>
  ({ slug, variant: { group: 'g', columns, icons, iconStyle } }) as any;

describe('findSibling', () => {
  const siblings = [
    sib('a', 3, 'top', 'circle'),
    sib('b', 4, 'top', 'circle'),
    sib('c', 3, 'left', 'circle'),
    sib('d', 3, 'top', 'number'),
  ];
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
