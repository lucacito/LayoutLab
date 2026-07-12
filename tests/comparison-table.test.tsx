// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComparisonTable } from '@/components/marketing/ComparisonTable';

describe('ComparisonTable', () => {
  it('renders columns, rows, and mixed value types', () => {
    render(
      <ComparisonTable
        caption="Free vs Pro"
        columns={['Free', 'Pro']}
        rows={[
          { label: 'Single-page import', values: [true, true] },
          { label: 'Full kit ZIP import', values: [false, true] },
          { label: 'Updates', values: ['—', '1 year'] },
        ]}
      />,
    );
    expect(screen.getByRole('table')).toBeTruthy();
    expect(screen.getByText('Full kit ZIP import')).toBeTruthy();
    expect(screen.getByText('1 year')).toBeTruthy();
    expect(screen.getAllByText('Included').length).toBe(3); // sr-only labels on checks
  });
});
