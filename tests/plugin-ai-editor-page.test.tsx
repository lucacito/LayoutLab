// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AiEditorPage, { metadata } from '@/app/(marketing)/plugins/divi-5-ai-editor/page';

describe('/plugins/divi-5-ai-editor', () => {
  it('is a live sales page, not a waitlist', () => {
    render(<AiEditorPage />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/AI Editor/i);
    expect(screen.queryByRole('button', { name: /join the waitlist/i })).toBeNull();
    expect(screen.queryByText(/waitlist/i)).toBeNull();
  });
  it('has metadata reflecting the sales page (no "coming soon")', () => {
    expect(String(metadata.title)).toMatch(/AI Editor/i);
    expect(String(metadata.title)).not.toMatch(/coming soon/i);
    expect(String(metadata.description)).toMatch(/validat/i);
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
  it('renders Free vs Pro as a comparison table with the free download form', () => {
    render(<AiEditorPage />);
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText(/create pages from scratch/i)).toBeTruthy();
  });
  it('has an expanded FAQ', () => {
    render(<AiEditorPage />);
    expect(document.querySelectorAll('dl dt').length).toBeGreaterThanOrEqual(8);
  });
});
