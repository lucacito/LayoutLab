// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LicensePage from '@/app/(marketing)/license/page';
import { aiEditorRefundPolicy } from '@/lib/legal/refund';
import { PRICING } from '@/lib/pricing/config';

describe('LicensePage', () => {
  it('summarizes the license in plain English before the full text', () => {
    render(<LicensePage />);
    // getAllBy: these phrases also appear inside the full license text <pre>.
    expect(screen.getAllByText(/unlimited sites/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/client/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/no resale/i).length).toBeGreaterThan(0);
  });
  it('still renders the full license text and refund policy', () => {
    render(<LicensePage />);
    expect(document.querySelector('pre')).toBeTruthy();
    expect(screen.getAllByText(/refund/i).length).toBeGreaterThan(0);
  });

  it('has a separate refund policy for AI Editor Pro with the numbers from the config', () => {
    render(<LicensePage />);
    const text = document.body.textContent ?? '';
    expect(text).toContain(aiEditorRefundPolicy());
    expect(text).toContain(`within ${PRICING.refundWindowDays} days of the charge`);
    expect(text).toContain(`${PRICING.trial.days}-day free trial`);
    expect(document.getElementById('refunds')).toBeTruthy();
  });
  it('keeps the promise that a lapsed licence never breaks an activated site', () => {
    expect(aiEditorRefundPolicy()).toContain('the Pro tools keep working on the sites where it was activated');
  });
});
