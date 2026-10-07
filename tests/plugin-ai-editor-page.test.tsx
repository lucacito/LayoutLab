// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AiEditorPage, { metadata } from '@/app/(marketing)/plugins/divi-5-ai-editor/page';

describe('/plugins/divi-5-ai-editor', () => {
  it('is a live product page for both free plugin and Pro add-on', () => {
    const { container } = render(<AiEditorPage />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toMatch(/edit divi.*validated|divi.*english/i);
    // expects separate section headings for free and Pro - check with getAllByText since text appears multiple places
    const freePluginMatches = screen.getAllByText(/free plugin/i);
    expect(freePluginMatches.length).toBeGreaterThan(0);
    expect(Array.from(freePluginMatches).some(el => el.textContent?.match(/17 tools/i))).toBe(true);

    const proAddOnMatches = screen.getAllByText(/pro add-on/i);
    expect(proAddOnMatches.length).toBeGreaterThan(0);
    expect(Array.from(proAddOnMatches).some(el => el.textContent?.match(/17.*tools/i))).toBe(true);
  });
  it('has metadata for both free plugin and Pro add-on', () => {
    expect(String(metadata.title)).toMatch(/AI Editor/i);
    expect(String(metadata.title)).not.toMatch(/coming soon/i);
    expect(String(metadata.description)).toMatch(/validat/i);
    expect(String(metadata.description)).toMatch(/free|49|pro/i);
  });
  it('shows the live chat demo with a self-correction', () => {
    render(<AiEditorPage />);
    expect(screen.getByText(/WRONG_FIELD_TYPE/)).toBeTruthy();
  });
  it('lists compatible assistants', () => {
    render(<AiEditorPage />);
    // getAllBy: assistants appear in the hero "Works with" line and the FAQ.
    expect(screen.getAllByText(/claude desktop/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/cursor/i).length).toBeGreaterThan(0);
  });
  it('describes free and Pro capabilities instead of a Free vs Pro table', () => {
    render(<AiEditorPage />);
    expect(screen.queryByRole('table')).toBeNull();
    // Check that free plugin capabilities are described
    const freePluginMatches = screen.getAllByText(/free plugin/i);
    expect(freePluginMatches.length).toBeGreaterThan(0);
    expect(screen.getByText(/create pages as drafts/i)).toBeTruthy();
    expect(screen.getByText(/set the front page and menu/i)).toBeTruthy();
  });
  it('has an expanded FAQ covering both free and Pro', () => {
    render(<AiEditorPage />);
    expect(document.querySelectorAll('dl dt').length).toBeGreaterThanOrEqual(10);
    expect(screen.getByText(/which ai assistants/i)).toBeTruthy();
    expect(screen.getByText(/what does the pro add-on/i)).toBeTruthy();
  });
});
