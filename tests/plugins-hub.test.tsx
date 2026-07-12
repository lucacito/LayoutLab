// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PluginsHub, { metadata } from '@/app/(marketing)/plugins/page';

describe('/plugins hub', () => {
  it('lists all three products with correct links and statuses', async () => {
    render(await PluginsHub());
    const links = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('/plugins/elementor-to-divi-5');
    expect(links).toContain('/plugins/divi-to-elementor');
    expect(links).toContain('/plugins/divi-5-ai-editor');
    expect(screen.getByText(/pending wordpress\.org review/i)).toBeTruthy();
    expect(screen.getByText(/coming soon/i)).toBeTruthy();
    expect(screen.getAllByText(/\$49\/yr/i).length).toBeGreaterThan(0);
  });
  it('has metadata', () => { expect(String(metadata.title)).toMatch(/plugins/i); });
});
