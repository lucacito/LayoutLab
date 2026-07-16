// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AiEditorPage from '@/app/(marketing)/plugins/divi-5-ai-editor/page';

describe('/plugins/divi-5-ai-editor', () => {
  it('sells Pro and offers the free download', () => {
    render(<AiEditorPage />);
    expect(screen.getAllByText(/\$39/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /free trial/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/free download/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });
});
