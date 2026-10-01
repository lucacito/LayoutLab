// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import AiEditorPage from '@/app/(marketing)/plugins/divi-5-ai-editor/page';

// The AI Editor Pro plan is paused (lib/site/pro-status.ts): the plugin has no
// licence-gated feature left, so this page must sell nothing.
describe('/plugins/divi-5-ai-editor (Pro paused)', () => {
  it('offers the free download and sells nothing', () => {
    const { container } = render(<AiEditorPage />);
    const link = screen.getByRole('link', { name: /download the free plugin/i });
    expect(link.getAttribute('href')).toBe('/downloads/jhmg-ai-editor-for-divi-5.zip');
    expect(link.hasAttribute('download')).toBe(true);
    // the served file must actually ship with the site
    expect(existsSync(join(process.cwd(), 'public', 'downloads', 'jhmg-ai-editor-for-divi-5.zip'))).toBe(true);
    expect(screen.getByText(/version 4\.0\.0/i)).toBeTruthy();

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/\$\s?30/);
    expect(text).not.toMatch(/45-day/i);
    expect(text).not.toMatch(/free trial/i);
    expect(text).not.toMatch(/go pro/i);
    expect(text).not.toMatch(/licen[sc]e/i);
    expect(text).not.toMatch(/broken layouts are impossible/i);
    expect(screen.queryByRole('button', { name: /trial|buy|subscribe|upgrade/i })).toBeNull();
    expect(container.querySelectorAll('a[href*="checkout"], a[href="/pricing"]').length).toBe(0);
  });

  it('says a broken page is never saved by an AI edit', () => {
    const { container } = render(<AiEditorPage />);
    expect(container.textContent).toMatch(/a broken page is never saved by an AI edit/i);
  });

  it('describes what the free plugin does, including drafts, undo, images and the Media Library', () => {
    render(<AiEditorPage />);
    const section = document.getElementById('free')!;
    const text = section.textContent ?? '';
    expect(text).toMatch(/what the free plugin does/i);
    expect(text).toMatch(/create pages as drafts/i);
    expect(text).toMatch(/undo any ai edit/i);
    expect(text).toMatch(/media library/i);
    expect(text).toMatch(/image/i);
    expect(text).toMatch(/section recipes/i);
  });

  it('shows a calm Pro add-on card with the waitlist form, no price and no purchase', () => {
    render(<AiEditorPage />);
    expect(screen.getByText(/pro add-on: coming soon/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /live stock photos for each section/i })).toBeTruthy();
    const form = screen.getByRole('textbox').closest('form');
    expect(form).toBeTruthy();
    expect(within(form as HTMLElement).getByRole('button', { name: /notify me/i })).toBeTruthy();
  });

  it('declares the AI Editor as a free product in structured data', () => {
    const { container } = render(<AiEditorPage />);
    const blocks = Array.from(container.querySelectorAll('script[type="application/ld+json"]')).map((s) =>
      JSON.parse(s.textContent ?? '{}'),
    );
    const product = blocks.find((b) => b['@type'] === 'Product');
    expect(product.offers.price).toBe('0.00');
    expect(JSON.stringify(product)).not.toMatch(/30\.00|subscription/i);
    const faq = blocks.find((b) => b['@type'] === 'FAQPage');
    const answers = JSON.stringify(faq);
    expect(answers).not.toMatch(/\$30|trial|licen[sc]e|renew/i);
    // JSON-LD questions match the visible FAQ exactly
    const visible = Array.from(document.querySelectorAll('dl.space-y-6 dt')).map((d) => d.textContent);
    expect(faq.mainEntity.map((q: { name: string }) => q.name)).toEqual(visible);
  });
});
