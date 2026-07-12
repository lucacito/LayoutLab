import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PrimaryNav } from '@/components/site/PrimaryNav';

describe('PrimaryNav', () => {
  it('renders the four plugins-first nav links with correct hrefs', () => {
    const { getByText, queryByText } = render(<PrimaryNav />);
    const plugins = getByText('Plugins').closest('a');
    const layouts = getByText('Free layouts').closest('a');
    const browse = getByText('Browse').closest('a');
    const guides = getByText('Guides').closest('a');
    expect(plugins?.getAttribute('href')).toBe('/plugins');
    expect(layouts?.getAttribute('href')).toBe('/free-divi-layouts');
    expect(browse?.getAttribute('href')).toBe('/browse');
    expect(guides?.getAttribute('href')).toBe('/guides');
    expect(queryByText('Work with us')).toBeNull();
    expect(queryByText('Examples')).toBeNull();
  });
});
