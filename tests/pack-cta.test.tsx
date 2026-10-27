// tests/pack-cta.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
vi.mock('@/components/BuyButton', () => ({ BuyButton: ({ label }: { label: string }) => <button data-testid="buy">{label}</button> }));
vi.mock('@/components/FreePackForm', () => ({ FreePackForm: () => <form data-testid="capture" /> }));
import { PackCta } from '@/components/PackCta';

describe('PackCta', () => {
  it('entitled → a download link', () => {
    const { container } = render(<PackCta pack={{ id: 'p1', slug: 'agency-essentials', kind: 'free' }} entitled />);
    expect(container.querySelector('a[href="/api/download/pack/p1"]')).not.toBeNull();
  });
  it('not entitled, free pack → capture form', () => {
    const { getByTestId } = render(<PackCta pack={{ id: 'p1', slug: 's', kind: 'free' }} entitled={false} />);
    expect(getByTestId('capture')).toBeTruthy();
  });
  it('not entitled, paid pack → buy button, never the free capture form', () => {
    const { getByTestId, queryByTestId } = render(<PackCta pack={{ id: 'p1', slug: 's', kind: 'paid' }} entitled={false} priceLabel="$12.00" />);
    expect(getByTestId('buy').textContent).toContain('$12.00');
    expect(queryByTestId('capture')).toBeNull();
  });
  it('entitled, paid pack → download link (not the buy button)', () => {
    const { container, queryByTestId } = render(<PackCta pack={{ id: 'p1', slug: 's', kind: 'paid' }} entitled />);
    expect(container.querySelector('a[href="/api/download/pack/p1"]')).not.toBeNull();
    expect(queryByTestId('buy')).toBeNull();
  });
});
