// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AiEditorPage, { metadata } from '@/app/(marketing)/plugins/divi-5-ai-editor/page';

describe('/plugins/divi-5-ai-editor', () => {
  it('is a coming-soon page with a waitlist form', async () => {
    render(await AiEditorPage());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/AI Editor/i);
    expect(screen.getByText(/coming soon/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /join the waitlist/i })).toBeTruthy();
  });
  it('has metadata', () => { expect(String(metadata.title)).toMatch(/AI Editor/i); });
});
