// tests/product-doors.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductDoors } from '@/components/marketing/ProductDoors';

describe('ProductDoors', () => {
  it('links all three products with job-to-be-done headlines and specific CTAs', () => {
    render(<ProductDoors />);
    const hrefs = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/plugins/elementor-to-divi-5');
    expect(hrefs).toContain('/plugins/wpbakery-to-divi-5');
    expect(hrefs).toContain('/plugins/divi-to-elementor');
    expect(hrefs).toContain('/plugins/divi-5-ai-editor');
    expect(screen.getByText(/leave elementor without rebuilding/i)).toBeTruthy();
    expect(screen.queryByText(/^learn more$/i)).toBeNull();
  });
  it('keeps honest status chips', () => {
    render(<ProductDoors />);
    expect(screen.queryByText(/pending wordpress\.org review/i)).toBeNull();
    expect(screen.getAllByText(/free on wordpress\.org/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/free/i).length).toBeGreaterThan(0);
  });
  it('offers the plugin still under wordpress.org review as a direct download beside the door CTA', () => {
    render(<ProductDoors />);
    const downloads = screen.getAllByRole('link', { name: /download the free plugin/i });
    const hrefs = downloads.map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/downloads/jhmg-converter-for-wpbakery-to-divi.zip']);
    expect(downloads.every((a) => a.hasAttribute('download'))).toBe(true);
  });
  it('sends the approved Beaver Builder converter to its wordpress.org listing', () => {
    render(<ProductDoors />);
    const wporg = screen.getAllByRole('link', { name: /get the free plugin on wordpress\.org/i });
    expect(wporg.map((a) => a.getAttribute('href'))).toContain('https://wordpress.org/plugins/jhmg-converter-for-beaver-builder-to-divi-5/');
    expect(screen.getAllByText(/free on wordpress\.org · pro \$25\/yr/i).length).toBe(3);
  });
});
