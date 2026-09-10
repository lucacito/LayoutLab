// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import WPBakeryPage, { metadata } from '@/app/(marketing)/plugins/wpbakery-to-divi-5/page';
import {
  WPBAKERY_ELEMENT_GROUPS,
  WPBAKERY_ELEMENT_TYPES_MAPPED,
  WPBAKERY_REGISTERED_ELEMENTS,
} from '@/lib/site/wpbakery-element-mappings';

describe('lib/site/wpbakery-element-mappings', () => {
  it('counts the 75 registered elements across the WPBakery groups', () => {
    expect(WPBAKERY_REGISTERED_ELEMENTS).toBe(75);
    const registered = WPBAKERY_ELEMENT_GROUPS
      .filter((g) => g.registered)
      .reduce((n, g) => n + g.elements.length, 0);
    expect(registered).toBe(WPBAKERY_REGISTERED_ELEMENTS);
  });

  it('ships every add-on family the coverage script reports, at its count', () => {
    const byGroup = Object.fromEntries(WPBAKERY_ELEMENT_GROUPS.map((g) => [g.group, g.elements.length]));
    expect(byGroup['Template-only and vendor tags']).toBe(23);
    // "Theme / add-on handlers shipped 31 (Ronneby x 23, Sliders x 2, Ultimate Addons x 6)".
    expect(byGroup['Ronneby (DFD)']).toBe(23);
    expect(byGroup['Sliders']).toBe(2);
    expect(byGroup['Ultimate Addons for WPBakery']).toBe(6);
    expect(byGroup['Ronneby (DFD)'] + byGroup['Sliders'] + byGroup['Ultimate Addons for WPBakery']).toBe(31);
    // 75 registered + 23 template-only/vendor + 31 add-on handlers.
    expect(WPBAKERY_ELEMENT_TYPES_MAPPED).toBe(129);
    expect(WPBAKERY_ELEMENT_TYPES_MAPPED).toBe(
      WPBAKERY_ELEMENT_GROUPS.reduce((n, g) => n + g.elements.length, 0),
    );
  });

  it('never repeats an element across groups', () => {
    const all = WPBAKERY_ELEMENT_GROUPS.flatMap((g) => g.elements);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('/plugins/wpbakery-to-divi-5', () => {
  it('sells Pro at $25/yr and offers the free plugin as a direct download', () => {
    render(<WPBakeryPage />);
    expect(screen.getAllByRole('button', { name: /get pro · \$25\/yr/i }).length).toBeGreaterThan(0);
    const free = screen.getAllByRole('link', { name: /free plugin/i });
    expect(free.length).toBeGreaterThan(0);
    expect(free[0]!.getAttribute('href')).toBe('/downloads/jhmg-converter-for-wpbakery-to-divi.zip');
    expect(free[0]!.hasAttribute('download')).toBe(true);
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it('quotes the coverage totals with their parenthetical, never a bare fraction', () => {
    render(<WPBakeryPage />);
    expect(screen.getByText(`${WPBAKERY_REGISTERED_ELEMENTS}/${WPBAKERY_REGISTERED_ELEMENTS}`)).toBeTruthy();
    expect(
      screen.getAllByText(/38 exact, 31 approximate, 6 read by their parent element/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/23 template-only and vendor tags/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(String(WPBAKERY_ELEMENT_TYPES_MAPPED)).length).toBeGreaterThan(0);
  });

  it('lists every mapping group, Ronneby included', () => {
    render(<WPBakeryPage />);
    for (const group of [
      'WPBakery structure',
      'WPBakery content',
      'WordPress widgets',
      'Deprecated elements',
      'Template-only and vendor tags',
      'Ultimate Addons for WPBakery',
      'Sliders',
      'Ronneby (DFD)',
    ]) {
      expect(screen.getByText(group), group).toBeTruthy();
    }
  });

  it('maps the elements a WPBakery page is actually built from', () => {
    render(<WPBakeryPage />);
    for (const pair of [
      ['vc_custom_heading', 'divi/heading'],
      ['vc_single_image', 'divi/image'],
      ['vc_btn', 'divi/button'],
      ['vc_tta_accordion', 'divi/accordion'],
      ['vc_progress_bar', 'divi/counters'],
      ['bsf-info-box', 'divi/blurb'],
    ]) {
      expect(screen.getAllByText(pair[0]!).length, pair[0]).toBeGreaterThan(0);
      expect(screen.getAllByText(pair[1]!).length, pair[1]).toBeGreaterThan(0);
    }
  });

  it('answers the theme-elements question in three tiers', () => {
    render(<WPBakeryPage />);
    const answer = screen.getByText(/What happens to theme elements/i).nextElementSibling;
    expect(answer).toBeTruthy();
    const text = answer!.textContent ?? '';
    expect(text).toMatch(/static/i);
    expect(text).toMatch(/placeholder/i);
    expect(text).toMatch(/Ronneby/);
    expect(text).toMatch(/Ultimate Addons/);
  });

  it('sells the Pro features Pro actually ships', () => {
    render(<WPBakeryPage />);
    // Named twice on purpose: once as a Pro card, once as a Pro-only table row.
    expect(screen.getByRole('heading', { name: 'WPBakery templates → Divi Library' })).toBeTruthy();
    const row = screen.getByRole('rowheader', { name: 'WPBakery templates → Divi Library' }).closest('tr');
    expect(row).toBeTruthy();
    expect(within(row!).getByText('Not included')).toBeTruthy();
    expect(within(row!).getByText('Included')).toBeTruthy();
  });

  it('does not promise a native module for the tags that keep their shortcode', () => {
    render(<WPBakeryPage />);
    const reference = screen.getByText(/All 129 element tags with a dedicated converter/i).textContent ?? '';
    // WooCommerce and the slider decks land in a Divi code module, not a native
    // one, and the page has to say so where it lists them.
    expect(reference).toMatch(/code module/i);
    expect(reference).toMatch(/Ultimate Addons and Ronneby are the add-on and theme families/i);
  });

  it('never claims the original site is modified and has canonical metadata', () => {
    render(<WPBakeryPage />);
    expect(screen.getAllByText(/never modified|never touched/i).length).toBeGreaterThan(0);
    expect(String(metadata.title)).toMatch(/wpbakery to divi 5/i);
    expect(String(metadata.alternates?.canonical)).toMatch(/\/plugins\/wpbakery-to-divi-5$/);
  });
});
