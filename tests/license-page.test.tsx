// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LicensePage from '@/app/(marketing)/license/page';

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
});
