// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerdictCard } from '@/components/marketing/VerdictCard';

describe('VerdictCard', () => {
  it('shows violations then the passing verdict', () => {
    render(
      <VerdictCard
        title="validator output"
        failures={[{ code: 'WRONG_NESTING', detail: 'divi/button directly inside divi/section' }]}
        passSummary="Valid — 14 blocks, 0 violations"
      />,
    );
    expect(screen.getByText('WRONG_NESTING')).toBeTruthy();
    expect(screen.getByText(/0 violations/)).toBeTruthy();
  });
});
