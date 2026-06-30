import { describe, it, expect } from 'vitest';
import { TYPE_LABELS } from '@/lib/nav/menu-data';

describe('menu-data', () => {
  it('labels the cards type', () => {
    expect(TYPE_LABELS.cards).toBe('Cards');
  });
});
