import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ServicesOffer } from '@/components/services/ServicesOffer';

describe('ServicesOffer', () => {
  it('renders three tiers with prices and a quote CTA', () => {
    const { getByText, getAllByText } = render(<ServicesOffer />);
    expect(getByText('Landing Page')).toBeTruthy();
    expect(getByText('Full Website')).toBeTruthy();
    expect(getByText('Site Refresh')).toBeTruthy();
    expect(getAllByText(/^from \$/).length).toBe(3);
    expect(getByText('Get a free quote').closest('a')?.getAttribute('href')).toBe('/contact');
  });
});
