// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import D2EPage, { metadata } from '@/app/(marketing)/plugins/divi-to-elementor/page';

describe('/plugins/divi-to-elementor', () => {
  it('states the pending-review status, has a notify form, and NO buy button', async () => {
    render(await D2EPage());
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Divi.*Elementor/i);
    expect(screen.getByText(/pending wordpress\.org review/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /notify me/i })).toBeTruthy();
    expect(screen.queryByText(/checkout|buy now/i)).toBeNull();
  });
  it('mentions the coming Pro tier price', async () => {
    render(await D2EPage());
    expect(screen.getAllByText(/\$25\/yr/).length).toBeGreaterThan(0);
  });
  it('has metadata', () => { expect(String(metadata.title)).toMatch(/Divi to Elementor/i); });
  it('shows the batch-conversion mock', async () => {
    render(await D2EPage());
    // "batch run" also appears in the agency use-case copy ("Batch runs turn
    // each handover…"), so assert presence rather than a single unique match.
    expect(screen.getAllByText(/batch run/i).length).toBeGreaterThan(0);
  });
  it('has an expanded FAQ', async () => {
    render(await D2EPage());
    expect(document.querySelectorAll('dl dt').length).toBeGreaterThanOrEqual(6);
  });
});
