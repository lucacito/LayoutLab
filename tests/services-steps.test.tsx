import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ServicesSteps } from '@/components/services/ServicesSteps';

describe('ServicesSteps', () => {
  it('renders all four steps', () => {
    const { getByText } = render(<ServicesSteps />);
    expect(getByText('Tell us about your business')).toBeTruthy();
    expect(getByText('We design a mockup')).toBeTruthy();
    expect(getByText('We build it in Divi 5')).toBeTruthy();
    expect(getByText('Launch & get calls')).toBeTruthy();
  });
});
