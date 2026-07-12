// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UseCaseVignettes } from '@/components/marketing/UseCaseVignettes';

describe('UseCaseVignettes', () => {
  it('renders a card per vignette', () => {
    render(
      <UseCaseVignettes
        items={[
          { icon: 'business_center', title: 'The agency', body: 'Migrates client sites.' },
          { icon: 'person', title: 'The site owner', body: 'Switches builders once.' },
        ]}
      />,
    );
    expect(screen.getByText('The agency')).toBeTruthy();
    expect(screen.getByText(/switches builders/i)).toBeTruthy();
  });
});
