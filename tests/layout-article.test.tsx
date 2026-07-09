// tests/layout-article.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LayoutArticle, SHARED_LAYOUT_FAQ } from '@/components/LayoutArticle';

const article = {
  overview: 'A **deliberate** hero for SaaS teams.\n\nSecond paragraph of the overview.',
  features: ['Preset-friendly buttons', 'Responsive at 390px', 'Single icon family'],
  whoItsFor: 'Built for SaaS marketing teams and agencies shipping fast.',
  customization: 'Change the palette via global presets first.',
  faq: [
    { q: 'Does it include the images?', a: 'Placeholder imagery is included and easy to swap.' },
    { q: 'Is the form functional?', a: 'Yes, it is a native Divi form module.' },
  ],
};

describe('LayoutArticle', () => {
  it('renders all article sections plus install steps and merged FAQ', () => {
    const { getByText, container } = render(<LayoutArticle title="Bold SaaS Hero" article={article} />);
    expect(getByText(/deliberate/)).toBeTruthy();
    expect(getByText('Preset-friendly buttons')).toBeTruthy();
    expect(getByText(/SaaS marketing teams/)).toBeTruthy();
    expect(getByText(/global presets first/)).toBeTruthy();
    // Shared install section is always present
    expect(getByText(/portability/i)).toBeTruthy();
    // Per-layout FAQ + shared FAQ both render
    expect(getByText('Does it include the images?')).toBeTruthy();
    expect(getByText(SHARED_LAYOUT_FAQ[0].q)).toBeTruthy();
    // Section headings are h2s for document outline
    const h2s = [...container.querySelectorAll('h2')].map((h) => h.textContent);
    expect(h2s.some((t) => t?.match(/overview/i))).toBe(true);
    expect(h2s.some((t) => t?.match(/faq|questions/i))).toBe(true);
  });

  it('renders nothing when no article is present', () => {
    const { container } = render(<LayoutArticle title="X" article={undefined} />);
    expect(container.innerHTML).toBe('');
  });
});
