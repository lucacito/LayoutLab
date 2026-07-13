// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatStrip } from '@/components/marketing/StatStrip';

describe('StatStrip', () => {
  it('renders each stat as a definition pair', () => {
    render(<StatStrip stats={[{ value: '124', label: 'widgets mapped' }, { value: '15', label: 'violation classes' }]} />);
    expect(screen.getByText('124')).toBeTruthy();
    expect(screen.getByText(/violation classes/i)).toBeTruthy();
    expect(document.querySelectorAll('dl dt').length).toBe(2);
  });
});
