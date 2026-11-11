// tests/homepage.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomePage from '@/app/(marketing)/page';

describe('homepage (validator spine)', () => {
  it('leads with the AI Editor and links all products', async () => {
    render(await HomePage());
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toMatch(/edit divi 5 with ai\. safely/i);
    const links = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('/plugins/elementor-to-divi-5');
    expect(links).toContain('/plugins/beaver-builder-to-divi-5');
    expect(links).toContain('/plugins/wpbakery-to-divi-5');
    expect(links).toContain('/plugins/divi-to-elementor');
    expect(links).toContain('/plugins/divi-5-ai-editor');
    expect(links).toContain('/pricing');
  });
  it('calls the plugin the MCP server for Divi 5 and says what it does, with real counts', async () => {
    render(await HomePage());
    expect(screen.getByText(/the mcp server for divi 5/i)).toBeTruthy();
    expect(screen.getByText(/lets claude, chatgpt, cursor or vs code copilot read, edit and build your divi 5 pages/i)).toBeTruthy();
    // the old hard-coded tool count is gone (it was stale: the plugin has 22 free tools)
    expect(screen.queryByText(/16 AI editing tools/i)).toBeNull();
    expect(screen.getByText(/free tools for your ai/i)).toBeTruthy();
  });
  it('mentions Lab in the hero line and in the feature list, without naming an assistant that works with it', async () => {
    render(await HomePage());
    expect(screen.getByText(/lab: a draft page from a few questions/i)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /answer a few questions\. get a draft page/i })).toBeTruthy();
    expect(screen.getByText(/results with any given assistant are not yet confirmed/i)).toBeTruthy();
  });
  it('shows the full feature list and links to it from the hero', async () => {
    render(await HomePage());
    expect(document.getElementById('features')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /the complete ai toolkit for divi 5/i })).toBeTruthy();
    const links = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('#features');
  });
  it("shows Marva Lord's words exactly, with her name and business and nothing personal", async () => {
    render(await HomePage());
    const text = document.body.textContent ?? '';
    expect(text).toContain("I'm delighted with how much it has helped me, particularly with some quite complicated website builds.");
    expect(text).toContain('The editor supports the person doing the work rather than attempting to replace them.');
    expect(text).toContain('Marva Lord');
    expect(text).toContain('Griots Arts Ltd');
    // she asked to be asked first before anything about her diagnoses or circumstances is shown publicly
    expect(text).not.toMatch(/adhd|autis|diagnos/i);
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
  it('asks which builder to convert next', async () => {
    render(await HomePage());
    expect(screen.getByText(/which builder should we convert next/i)).toBeTruthy();
    expect(screen.getByLabelText('Oxygen')).toBeTruthy();
    expect(screen.queryByLabelText('Bricks')).toBeNull();
  });
  it('has a theme packs section that links to /packs', async () => {
    render(await HomePage());
    expect(screen.getByRole('heading', { name: /complete divi 5 websites/i })).toBeTruthy();
    const links = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('/packs');
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
  it('lists products with AI Editor first and converter tools below', async () => {
    render(await HomePage());
    // AI Editor is now the lead
    expect(screen.getByText(/edit divi 5 in plain english/i)).toBeTruthy();
    expect(screen.getByText(/leave elementor without rebuilding/i)).toBeTruthy();
    expect(screen.getByText(/leave beaver builder without rebuilding/i)).toBeTruthy();
    expect(screen.getByText(/leave wpbakery without rebuilding/i)).toBeTruthy();
    // Check for the CTA buttons on the converter cards
    expect(screen.getByRole('link', { name: /see the converter/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /see the beaver converter/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /see the wpbakery converter/i })).toBeTruthy();
    expect(screen.getAllByText(/element types mapped/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/ai editing, layout conversion, and more\./i)).toBeTruthy();
  });
});

import { revalidate } from '@/app/(marketing)/page';
describe('homepage freshness', () => {
  it('is revalidated (not frozen at build time) so new theme packs appear', () => {
    expect(revalidate).toBeGreaterThan(0);
    expect(revalidate).toBeLessThanOrEqual(600);
  });
});
