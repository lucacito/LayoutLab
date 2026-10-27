// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('@/components/PreviewImage', () => ({ PreviewImage: ({ alt }: { alt: string }) => <div data-testid="cover">{alt}</div> }));
import { ThemePacksBand } from '@/components/marketing/ThemePacksBand';

const pack = (n: number, over: Record<string, unknown> = {}) => ({
  id: `p${n}`, slug: `pack-${n}`, title: `Pack ${n}`, description: '', kind: 'paid', priceCents: 1200,
  coverImageKey: null, seo: null, status: 'published', createdAt: new Date(), ...over,
}) as never;

describe('ThemePacksBand', () => {
  it('shows each paid pack as a card linking to its page, with the price', () => {
    render(<ThemePacksBand packs={[pack(1), pack(2)]} />);
    const links = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('/packs/pack-1');
    expect(links).toContain('/packs/pack-2');
    expect(links).toContain('/packs');
    expect(screen.getAllByText('$12').length).toBeGreaterThan(0);
  });
  it('shows at most four packs', () => {
    render(<ThemePacksBand packs={[1, 2, 3, 4, 5, 6].map((n) => pack(n))} />);
    expect(screen.getAllByTestId('cover')).toHaveLength(4);
  });
  it('ignores free packs and unpublished ones', () => {
    render(<ThemePacksBand packs={[pack(1), pack(2, { kind: 'free' }), pack(3, { status: 'draft' })]} />);
    expect(screen.getAllByTestId('cover')).toHaveLength(1);
  });
  it('still renders the heading and the browse link when there are no packs (database down)', () => {
    render(<ThemePacksBand packs={[]} />);
    expect(screen.getByRole('heading', { name: /complete divi 5 websites/i })).toBeTruthy();
    expect(Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'))).toContain('/packs');
    expect(screen.queryAllByTestId('cover')).toHaveLength(0);
  });
  it('quotes the lowest price only when it has one', () => {
    const { rerender } = render(<ThemePacksBand packs={[pack(1), pack(2, { priceCents: 1900 })]} />);
    expect(screen.getByText(/from \$12/i)).toBeTruthy();
    rerender(<ThemePacksBand packs={[]} />);
    expect(screen.queryByText(/from \$/i)).toBeNull();
  });
});
