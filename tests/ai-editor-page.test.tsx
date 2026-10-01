// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import AiEditorPage from '@/app/(marketing)/plugins/divi-5-ai-editor/page';

describe('/plugins/divi-5-ai-editor', () => {
  it('sells Pro and offers the free download', () => {
    render(<AiEditorPage />);
    expect(screen.getAllByText(/\$30/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /free trial/i }).length).toBeGreaterThan(0);
    const link = screen.getByRole('link', { name: /download the free plugin/i });
    expect(link.getAttribute('href')).toBe('/downloads/jhmg-ai-editor-for-divi-5.zip');
    expect(link.hasAttribute('download')).toBe(true);
    // the served file must actually ship with the site
    expect(existsSync(join(process.cwd(), 'public', 'downloads', 'jhmg-ai-editor-for-divi-5.zip'))).toBe(true);
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });
});
