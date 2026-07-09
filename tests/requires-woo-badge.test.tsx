import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RequiresWooBadge } from '@/components/RequiresWooBadge';

describe('RequiresWooBadge', () => {
  it('tells the buyer WooCommerce is required and the grid shows their products', () => {
    render(<RequiresWooBadge />);
    expect(screen.getByText(/requires the woocommerce plugin/i)).toBeTruthy();
    expect(screen.getByText(/your store's own products/i)).toBeTruthy();
  });
});
