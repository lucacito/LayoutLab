// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '@/app/(marketing)/page';

describe('homepage (plugin store)', () => {
  it('leads with the plugin story and links all three products', async () => {
    render(await HomePage());
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toMatch(/page builder|convert|migrate/i);
    const links = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('/plugins/elementor-to-divi-5');
    expect(links).toContain('/plugins/divi-to-elementor');
    expect(links).toContain('/plugins/divi-5-ai-editor');
  });
  it('has no services-funnel remnants', async () => {
    render(await HomePage());
    expect(screen.queryByText(/free quote|work with us|brings in work/i)).toBeNull();
  });
  it('keeps a free-layouts band', async () => {
    render(await HomePage());
    expect(screen.getByText(/free divi 5 layouts/i)).toBeTruthy();
  });
});
