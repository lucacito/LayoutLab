// tests/product-doors.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductDoors } from '@/components/marketing/ProductDoors';

describe('ProductDoors', () => {
  it('links all three products with job-to-be-done headlines and specific CTAs', () => {
    render(<ProductDoors />);
    const hrefs = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/plugins/elementor-to-divi-5');
    expect(hrefs).toContain('/plugins/divi-to-elementor');
    expect(hrefs).toContain('/plugins/divi-5-ai-editor');
    expect(screen.getByText(/leave elementor without rebuilding/i)).toBeTruthy();
    expect(screen.queryByText(/^learn more$/i)).toBeNull();
  });
  it('keeps honest status chips', () => {
    render(<ProductDoors />);
    expect(screen.getByText(/pending wordpress\.org review/i)).toBeTruthy();
    expect(screen.getAllByText(/free/i).length).toBeGreaterThan(0);
  });
});
