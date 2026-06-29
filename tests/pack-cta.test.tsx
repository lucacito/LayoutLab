// tests/pack-cta.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
vi.mock('@/components/BuyButton', () => ({ BuyButton: () => <button>Buy this pack</button> }));
vi.mock('@/components/FreePackForm', () => ({ FreePackForm: () => <form data-testid="capture" /> }));
import { PackCta } from '@/components/PackCta';

describe('PackCta', () => {
  it('entitled → a download link', () => {
    const { container } = render(<PackCta pack={{ id: 'p1', slug: 'agency-essentials', kind: 'paid' }} entitled />);
    expect(container.querySelector('a[href="/api/download/pack/p1"]')).not.toBeNull();
  });
  it('not entitled + paid → Buy', () => {
    const { getByText } = render(<PackCta pack={{ id: 'p1', slug: 's', kind: 'paid' }} entitled={false} />);
    expect(getByText('Buy this pack')).toBeTruthy();
  });
  it('not entitled + free → capture form', () => {
    const { getByTestId } = render(<PackCta pack={{ id: 'p1', slug: 's', kind: 'free' }} entitled={false} />);
    expect(getByTestId('capture')).toBeTruthy();
  });
});
