// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PluginsHub, { metadata } from '@/app/(marketing)/plugins/page';

describe('/plugins hub', () => {
  it('renders all three products with honest chips', async () => {
    render(await PluginsHub());
    expect(screen.queryByText(/pending wordpress\.org review/i)).toBeNull();
    expect(screen.getByText(/\$30\/yr/i)).toBeTruthy();
    expect(screen.getAllByText(/\$25\/yr/i).length).toBeGreaterThan(0);
  });
  it('has a which-tool decision strip', async () => {
    render(await PluginsHub());
    expect(screen.getByText(/which tool do i need/i)).toBeTruthy();
  });
  it('has metadata', () => { expect(String(metadata.title)).toMatch(/plugins/i); });
});
