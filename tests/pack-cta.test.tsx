// tests/pack-cta.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
vi.mock('@/components/FreePackForm', () => ({ FreePackForm: () => <form data-testid="capture" /> }));
import { PackCta } from '@/components/PackCta';

describe('PackCta', () => {
  it('entitled → a download link', () => {
    const { container } = render(<PackCta pack={{ id: 'p1', slug: 'agency-essentials', kind: 'free' }} entitled />);
    expect(container.querySelector('a[href="/api/download/pack/p1"]')).not.toBeNull();
  });
  it('not entitled → capture form (every pack is free now)', () => {
    const { getByTestId } = render(<PackCta pack={{ id: 'p1', slug: 's', kind: 'free' }} entitled={false} />);
    expect(getByTestId('capture')).toBeTruthy();
  });
});
