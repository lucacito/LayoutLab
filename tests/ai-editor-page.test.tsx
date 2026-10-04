// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AiEditorPage from '@/app/(marketing)/plugins/divi-5-ai-editor/page';

// The AI Editor Pro add-on is now live (lib/site/pro-status.ts). This page
// describes the free plugin (16 tools) and the Pro add-on (14 additional tools).
describe('/plugins/divi-5-ai-editor', () => {
  it('describes both free and Pro tiers', () => {
    render(<AiEditorPage />);
    expect(screen.getByText(/free plugin: 16 tools/i)).toBeTruthy();
    expect(screen.getByText(/pro add-on: 14 advanced tools/i)).toBeTruthy();
  });

  it('says a broken page is never saved by an AI edit', () => {
    const { container } = render(<AiEditorPage />);
    expect(container.textContent).toMatch(/a broken page is never saved by an AI edit/i);
  });

  it('describes what the free plugin does, including drafts, undo, images and the Media Library', () => {
    render(<AiEditorPage />);
    const section = document.getElementById('free')!;
    const text = section.textContent ?? '';
    expect(text).toMatch(/free plugin.*16 tools/i);
    expect(text).toMatch(/create pages as drafts/i);
    expect(text).toMatch(/undo any ai edit/i);
    expect(text).toMatch(/media library/i);
    expect(text).toMatch(/image/i);
  });

  it('lists Pro add-on capabilities: site-wide tools like menu, front page, find/replace, audit, build', () => {
    render(<AiEditorPage />);
    expect(screen.getByText(/set the front page and menu/i)).toBeTruthy();
    expect(screen.getByText(/find and replace site-wide/i)).toBeTruthy();
    expect(screen.getByText(/audit your site/i)).toBeTruthy();
    expect(screen.getByText(/build a whole divi 5 site/i)).toBeTruthy();
  });

  it('links to pricing and mentions the 45-day free trial', () => {
    render(<AiEditorPage />);
    expect(screen.getAllByRole('link', { name: /see pro pricing/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/45 days free/i)).toBeTruthy();
    expect(screen.getByText(/no credit card/i)).toBeTruthy();
  });

  it('declares the free plugin as a free product in structured data', () => {
    const { container } = render(<AiEditorPage />);
    const blocks = Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map((s) =>
      JSON.parse(s.textContent ?? '{}'),
    );
    const product = blocks.find((b) => b['@type'] === 'Product');
    expect(product.offers.price).toBe('0.00');
    const faq = blocks.find((b) => b['@type'] === 'FAQPage');
    const answers = JSON.stringify(faq);
    expect(answers).toMatch(/trial|upgrading|gpl/i);
    // JSON-LD questions match the visible FAQ exactly
    const visible = Array.from(document.querySelectorAll('dl dt')).map((d) => d.textContent);
    expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual(visible);
  });
});
