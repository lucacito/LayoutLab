// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AiEditorPage from '@/app/(marketing)/plugins/divi-5-ai-editor/page';

// The AI Editor Pro add-on is now live (lib/site/pro-status.ts). This page
// describes the free plugin (17 tools) and the Pro add-on (17 additional tools).
describe('/plugins/divi-5-ai-editor', () => {
  it('describes both free and Pro tiers', () => {
    render(<AiEditorPage />);
    expect(screen.getByText(/free plugin: 17 tools/i)).toBeTruthy();
    expect(screen.getByText(/pro add-on: 17 advanced tools/i)).toBeTruthy();
  });

  it('says a broken page is never saved by an AI edit', () => {
    const { container } = render(<AiEditorPage />);
    expect(container.textContent).toMatch(/a broken page is never saved by an AI edit/i);
  });

  it('describes what the free plugin does, including drafts, undo, images and the Media Library', () => {
    render(<AiEditorPage />);
    const section = document.getElementById('free')!;
    const text = section.textContent ?? '';
    expect(text).toMatch(/free plugin.*17 tools/i);
    expect(text).toMatch(/create pages as drafts/i);
    expect(text).toMatch(/undo any ai edit/i);
    expect(text).toMatch(/media library/i);
    expect(text).toMatch(/image/i);
  });

  it('describes the 4.7.0 free capabilities: site structure, ACF and custom fields, site styles', () => {
    render(<AiEditorPage />);
    const text = document.getElementById('free')!.textContent ?? '';
    expect(text).toMatch(/knows how your site is set up/i);
    expect(text).toMatch(/shows your acf and custom field values/i);
    expect(text).toMatch(/reuses your site colors and variables/i);
    expect(text).toMatch(/advanced custom fields/i);
  });

  it('answers the new FAQ questions: ACF, the approval step and modules from other Divi add-on plugins', () => {
    render(<AiEditorPage />);
    const text = document.body.textContent ?? '';
    expect(text).toMatch(/does it work with advanced custom fields and custom post types/i);
    expect(text).toMatch(/is there an approval step before the ai saves/i);
    expect(text).toMatch(/can it edit pages that use modules from other divi add-on plugins/i);
    expect(text).toMatch(/refuses to save a page that contains a module from another plugin/i);
  });

  it('lists Pro add-on capabilities: site-wide tools like menu, front page, find/replace, audit, build', () => {
    render(<AiEditorPage />);
    expect(screen.getByText(/set the front page and menu/i)).toBeTruthy();
    expect(screen.getByText(/find and replace site-wide/i)).toBeTruthy();
    expect(screen.getByText(/audit your site/i)).toBeTruthy();
    expect(screen.getByText(/build a whole divi 5 site/i)).toBeTruthy();
  });

  it('says the Pro tools work across the whole site, not "site-wide" (a buyer read that as store-wide access)', () => {
    const { container } = render(<AiEditorPage />);
    // Visible copy only: the JSON-LD blocks are search metadata and are deliberately left as they are.
    const visible = container.cloneNode(true) as HTMLElement;
    visible.querySelectorAll('script').forEach((s) => s.remove());
    const text = visible.textContent ?? '';
    expect(text).toContain('Pro add-on: 17 tools that work across your whole site');
    expect(text).toContain('Unlock editing and automation across your whole site');
    expect(text).toContain('upgrade to Pro for tools that work across your whole site');
    expect(text).not.toMatch(/17 site-wide tools/i);
    expect(text).not.toMatch(/unlock site-wide/i);
  });

  it('lists the three global-style Pro tools shipped in Pro 0.8.0', () => {
    render(<AiEditorPage />);
    expect(screen.getByText(/manage global colors/i)).toBeTruthy();
    expect(screen.getByText(/manage number and text variables/i)).toBeTruthy();
    expect(screen.getByText(/create and update module presets/i)).toBeTruthy();
  });

  it('links to pricing and mentions the 45-day free trial', () => {
    const { container } = render(<AiEditorPage />);
    expect(screen.getAllByRole('link', { name: /see pro pricing/i }).length).toBeGreaterThan(0);
    // The page says "Try free for 45 days" or similar, not exactly "45 days free"
    const has45Days = Array.from(container.querySelectorAll('*'))
      .some(el => el.textContent?.toLowerCase().includes('45 days'));
    expect(has45Days).toBe(true);
    // "no credit card" appears in multiple places, check that it exists somewhere
    const hasNoCreditCard = Array.from(container.querySelectorAll('*'))
      .some(el => el.textContent?.toLowerCase().includes('no credit card'));
    expect(hasNoCreditCard).toBe(true);
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
    // JSON-LD questions should include key topics
    const faqQuestions = faq.mainEntity.map((q: { name: string }) => q.name).join(' | ');
    expect(faqQuestions).toMatch(/which ai assistants/i);
    expect(faqQuestions).toMatch(/gpl/i);
  });
});
