// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Divi5McpPage, { metadata } from '@/app/(marketing)/divi-5-mcp/page';
import { sitemapEntries } from '@/lib/seo/sitemap';
import { GET } from '@/app/llms.txt/route';

describe('/divi-5-mcp', () => {
  it('is the page for "divi 5 mcp": title, one h1, canonical and a short description', () => {
    expect(String(metadata.title)).toMatch(/divi 5 mcp server/i);
    expect(String(metadata.description).length).toBeLessThanOrEqual(240);
    expect(String(metadata.alternates?.canonical)).toMatch(/\/divi-5-mcp$/);
    render(<Divi5McpPage />);
    expect(document.querySelectorAll('h1').length).toBe(1);
    expect(document.querySelector('h1')!.textContent).toMatch(/mcp server for divi 5/i);
  });

  it('carries SoftwareApplication, FAQ and breadcrumb structured data', () => {
    const { container } = render(<Divi5McpPage />);
    const blocks = Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map((s) => JSON.parse(s.textContent ?? '{}'));
    const types = blocks.map((b) => b['@type']);
    expect(types).toEqual(expect.arrayContaining(['SoftwareApplication', 'FAQPage', 'BreadcrumbList']));
    const app = blocks.find((b) => b['@type'] === 'SoftwareApplication');
    expect(app.offers.price).toBe('0.00');
    expect(app.aggregateRating).toBeUndefined(); // never without real ratings
  });

  it('is in the sitemap and in llms.txt', async () => {
    const urls = sitemapEntries({ siteUrl: 'https://divi5lab.com', layouts: [], packs: [] }).map((e) => e.url);
    expect(urls).toContain('https://divi5lab.com/divi-5-mcp');
    expect(await GET().text()).toContain('/divi-5-mcp');
  });

  it('says ChatGPT is not yet confirmed and Divi\'s own MCP is not released', () => {
    const { container } = render(<Divi5McpPage />);
    const text = container.textContent ?? '';
    expect(text).toMatch(/not yet confirmed with a real chatgpt account/i);
    expect(text).toMatch(/not released yet/i);
  });
});
