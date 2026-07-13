// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CtaBand } from '@/components/marketing/CtaBand';

describe('CtaBand', () => {
  it('renders title, body and both actions', () => {
    render(
      <CtaBand
        title="Stop rebuilding. Start shipping."
        body="Move a whole site this week."
        cta={{ label: 'See pricing', href: '/pricing' }}
        secondary={{ label: 'Browse layouts', href: '/browse' }}
      />,
    );
    expect(screen.getByRole('heading', { level: 2 }).textContent).toMatch(/stop rebuilding/i);
    expect(screen.getByRole('link', { name: /see pricing/i }).getAttribute('href')).toBe('/pricing');
    expect(screen.getByRole('link', { name: /browse layouts/i })).toBeTruthy();
  });
});
