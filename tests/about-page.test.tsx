// tests/about-page.test.tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AboutPage from '@/app/(marketing)/about/page';

describe('AboutPage', () => {
  it('renders the brand and the origin story', () => {
    render(<AboutPage />);
    expect(screen.getAllByText(/Divi5Lab/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.getByText(/same input, same verdict/i)).toBeTruthy();
  });
  it('shows the proving-ground numbers', () => {
    render(<AboutPage />);
    expect(screen.getByText(/free layouts shipped/i)).toBeTruthy();
  });
  it('credits JHMG', () => {
    render(<AboutPage />);
    expect(screen.getByText(/JHMG/)).toBeTruthy();
  });
});
