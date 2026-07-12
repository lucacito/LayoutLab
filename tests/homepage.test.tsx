// tests/homepage.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '@/app/(marketing)/page';

describe('homepage (validator spine)', () => {
  it('leads with the never-broken promise and links all three products', async () => {
    render(await HomePage());
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toMatch(/broken layout/i);
    const links = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('/plugins/elementor-to-divi-5');
    expect(links).toContain('/plugins/divi-to-elementor');
    expect(links).toContain('/plugins/divi-5-ai-editor');
  });
  it('shows the proof strip with real numbers', async () => {
    render(await HomePage());
    // getAllBy: these phrases appear in both the StatStrip and ProductDoors stats.
    expect(screen.getAllByText(/violation classes/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/widget types mapped/i).length).toBeGreaterThan(0);
  });
  it('shows the validator mechanism band', async () => {
    render(await HomePage());
    expect(screen.getByText(/same input, same verdict/i)).toBeTruthy();
    expect(screen.getByText(/WRONG_NESTING/)).toBeTruthy();
  });
  it('has no services-funnel remnants', async () => {
    render(await HomePage());
    expect(screen.queryByText(/free quote|work with us|brings in work/i)).toBeNull();
  });
  it('keeps a free-layouts band', async () => {
    render(await HomePage());
    expect(screen.getByText(/free divi 5 layouts/i)).toBeTruthy();
  });
  it('links featured guides', async () => {
    render(await HomePage());
    const links = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links.some((h) => h?.startsWith('/guides/'))).toBe(true);
  });
});
