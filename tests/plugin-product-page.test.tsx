// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PluginPage, { metadata } from '@/app/(marketing)/plugins/elementor-to-divi-5/page';

describe('/plugins/elementor-to-divi-5', () => {
  it('renders hero, free-vs-pro comparison and price', async () => {
    render(await PluginPage());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Elementor to Divi 5/i);
    // Deep page now surfaces the price in multiple CTAs (hero, comparison, CTA band).
    expect(screen.getAllByText(/\$49/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/kit zip import/i).length).toBeGreaterThan(0);
  });

  it('embeds Product JSON-LD with the offer', async () => {
    const { container } = render(await PluginPage());
    const ld = container.querySelector('script[type="application/ld+json"]');
    expect(ld).toBeTruthy();
    const data = JSON.parse(ld!.textContent ?? '{}');
    expect(data['@type']).toBe('Product');
    expect(data.offers.price).toBe('49.00');
    expect(data.image).toBeTruthy();
  });

  it('has SEO metadata', () => {
    expect(metadata.title).toMatch(/Elementor to Divi 5/i);
    expect(String(metadata.description)).toMatch(/convert/i);
  });

  it('shows the mapping panel and the full widget reference', async () => {
    render(await PluginPage());
    // getAllBy where the term appears in both the MappingPanel and the reference list.
    expect(screen.getAllByText('price-table').length).toBeGreaterThan(0);
    expect(screen.getByText(/all .* widget types/i)).toBeTruthy(); // collapsible reference intro
    expect(screen.getByText('eael-pricing-table')).toBeTruthy();   // deep list entry
  });
  it('shows an honest conversion report with a graceful fallback', async () => {
    render(await PluginPage());
    expect(screen.getAllByText(/conversion report/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/fallback/i).length).toBeGreaterThan(0);
  });
  it('renders Free vs Pro as a comparison table', async () => {
    render(await PluginPage());
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getAllByText(/full kit zip import/i).length).toBeGreaterThan(0);
  });
  it('has an expanded FAQ', async () => {
    render(await PluginPage());
    expect(document.querySelectorAll('dl dt').length).toBeGreaterThanOrEqual(8);
  });
});
