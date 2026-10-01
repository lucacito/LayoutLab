// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AiEditorPage, { metadata } from '@/app/(marketing)/plugins/divi-5-ai-editor/page';

describe('/plugins/divi-5-ai-editor', () => {
  it('is a live product page for the free plugin; only the Pro add-on has a waitlist', () => {
    render(<AiEditorPage />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/AI Editor/i);
    // exactly one email form on the page: the Pro add-on waitlist
    expect(screen.getAllByRole('textbox').length).toBe(1);
  });
  it('has metadata for the free plugin (no "coming soon" in the title)', () => {
    expect(String(metadata.title)).toMatch(/AI Editor/i);
    expect(String(metadata.title)).not.toMatch(/coming soon/i);
    expect(String(metadata.description)).toMatch(/validat/i);
    expect(String(metadata.description)).toMatch(/free/i);
    expect(String(metadata.description)).not.toMatch(/impossible|\$30/i);
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
  it('lists what the free plugin does instead of a Free vs Pro table', () => {
    render(<AiEditorPage />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText(/what the free plugin does/i)).toBeTruthy();
    expect(screen.getByText(/create pages as drafts/i)).toBeTruthy();
  });
  it('has an expanded FAQ', () => {
    render(<AiEditorPage />);
    expect(document.querySelectorAll('dl dt').length).toBeGreaterThanOrEqual(8);
  });
});
