// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BeaverPage, { metadata } from '@/app/(marketing)/plugins/beaver-builder-to-divi-5/page';
import { BEAVER_MODULE_TYPES_MAPPED, BEAVER_REFERENCE_MODULES } from '@/lib/site/beaver-module-mappings';

describe('/plugins/beaver-builder-to-divi-5', () => {
  it('sells Pro at $25/yr and offers the free plugin as a direct download', () => {
    render(<BeaverPage />);
    expect(screen.getAllByRole('button', { name: /get pro · \$25\/yr/i }).length).toBeGreaterThan(0);
    const free = screen.getAllByRole('link', { name: /free plugin/i });
    expect(free.length).toBeGreaterThan(0);
    expect(free[0]!.getAttribute('href')).toBe('/downloads/jhmg-converter-for-beaver-builder-to-divi.zip');
    expect(free[0]!.hasAttribute('download')).toBe(true);
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });
  it('quotes the real mapping numbers and lists every mapping group', () => {
    render(<BeaverPage />);
    expect(screen.getAllByText(String(BEAVER_MODULE_TYPES_MAPPED)).length).toBeGreaterThan(0);
    expect(screen.getByText(`${BEAVER_REFERENCE_MODULES}/${BEAVER_REFERENCE_MODULES}`)).toBeTruthy();
    for (const group of ['Beaver Builder Lite', 'Beaver Builder Pro', 'Beaver Themer', 'PowerPack for Beaver Builder']) {
      expect(screen.getByText(group)).toBeTruthy();
    }
  });
  it('never claims the original site is modified and has canonical metadata', () => {
    render(<BeaverPage />);
    expect(screen.getAllByText(/never modified|never touched/i).length).toBeGreaterThan(0);
    expect(String(metadata.title)).toMatch(/beaver builder to divi 5/i);
    expect(String(metadata.alternates?.canonical)).toMatch(/\/plugins\/beaver-builder-to-divi-5$/);
  });
});
