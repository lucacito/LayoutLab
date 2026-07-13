// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MappingPanel } from '@/components/marketing/MappingPanel';

describe('MappingPanel', () => {
  it('renders every mapping pair with source and target', () => {
    render(
      <MappingPanel
        fromLabel="Elementor"
        toLabel="Divi 5"
        pairs={[{ from: 'price-table', to: 'divi/pricing-tables' }, { from: 'form', to: 'divi/contact-form' }]}
      />,
    );
    expect(screen.getByText('price-table')).toBeTruthy();
    expect(screen.getByText('divi/pricing-tables')).toBeTruthy();
    expect(screen.getByText('Elementor')).toBeTruthy();
    expect(screen.getByText('Divi 5')).toBeTruthy();
  });
});
