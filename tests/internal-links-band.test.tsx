import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { InternalLinksBand } from '@/components/site/InternalLinksBand';

describe('InternalLinksBand', () => {
  it('links to the /browse money page with a keyword anchor', () => {
    const { getByRole } = render(<InternalLinksBand />);
    const moneyLink = getByRole('link', { name: /free divi 5 layouts/i });
    expect(moneyLink.getAttribute('href')).toBe('/browse');
  });

  it('renders taxonomy hub links (spoke links)', () => {
    const { container } = render(<InternalLinksBand />);
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/type/hero');
    expect(hrefs).toContain('/niche/saas');
    expect(hrefs).toContain('/style/minimal');
  });
});
