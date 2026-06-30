import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AboutPage from '@/app/(marketing)/about/page';

describe('AboutPage', () => {
  it('renders the brand and a value proposition', () => {
    const { getAllByText, getByRole } = render(<AboutPage />);
    expect(getAllByText(/Divi5Lab/i).length).toBeGreaterThan(0);
    expect(getByRole('heading', { level: 1 })).toBeTruthy();
  });
});
