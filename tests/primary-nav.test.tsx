import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PrimaryNav } from '@/components/site/PrimaryNav';

describe('PrimaryNav', () => {
  it('renders the three funnel links with correct hrefs and no taxonomy mega-menu', () => {
    const { getByText } = render(<PrimaryNav />);
    const work = getByText('Work with us').closest('a');
    const examples = getByText('Examples').closest('a');
    const free = getByText('Free Divi layouts').closest('a');
    expect(work?.getAttribute('href')).toBe('/contact');
    expect(examples?.getAttribute('href')).toBe('/browse');
    expect(free?.getAttribute('href')).toBe('/free-divi-layouts');
  });
});
