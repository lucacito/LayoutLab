import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ServicesHero } from '@/components/services/ServicesHero';

describe('ServicesHero', () => {
  it('renders the outcome headline and both CTAs', () => {
    const { getByRole, getByText } = render(<ServicesHero />);
    expect(getByRole('heading', { level: 1 }).textContent).toMatch(/more calls/i);
    expect(getByText('Get a free quote').closest('a')?.getAttribute('href')).toBe('/contact');
    expect(getByText('See examples').closest('a')?.getAttribute('href')).toBe('/browse');
  });
});
