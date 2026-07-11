// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PluginPage, { metadata } from '@/app/(marketing)/plugins/elementor-to-divi-5/page';

describe('/plugins/elementor-to-divi-5', () => {
  it('renders hero, free-vs-pro comparison and price', async () => {
    render(await PluginPage());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Elementor to Divi 5/i);
    expect(screen.getByText(/\$49/)).toBeTruthy();
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
});
