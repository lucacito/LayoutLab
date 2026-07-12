// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AiEditorPage from '@/app/(marketing)/plugins/divi-5-ai-editor/page';

describe('/plugins/divi-5-ai-editor', () => {
  it('sells Pro and offers the free download', () => {
    render(<AiEditorPage />);
    expect(screen.getByText(/\$79/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Get Pro/i })).toBeTruthy();
    expect(screen.getByText(/free download/i)).toBeTruthy();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });
});
