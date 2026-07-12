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
});
