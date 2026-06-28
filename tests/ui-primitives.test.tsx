import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from '@/components/ui/Button';
import { Wordmark } from '@/components/ui/Wordmark';
import { IconFeature } from '@/components/ui/IconFeature';

describe('Button', () => {
  it('renders a <button> by default with primary styling', () => {
    const { getByRole } = render(<Button>Go</Button>);
    const el = getByRole('button');
    expect(el.tagName).toBe('BUTTON');
    expect(el.className).toContain('bg-action');
  });
  it('renders an <a> when href is given', () => {
    const { getByRole } = render(<Button href="/browse">Browse</Button>);
    const el = getByRole('link');
    expect(el.tagName).toBe('A');
    expect(el.getAttribute('href')).toBe('/browse');
  });
  it('secondary variant uses the border + navy text', () => {
    const { getByRole } = render(<Button variant="secondary">X</Button>);
    expect(getByRole('button').className).toContain('border-border');
  });
});

describe('Wordmark', () => {
  it('links to home and shows the brand', () => {
    const { getByText, container } = render(<Wordmark />);
    expect(getByText('LayoutLab')).toBeTruthy();
    expect(container.querySelector('a[href="/"]')).not.toBeNull();
  });
});

describe('IconFeature', () => {
  it('renders the title and body', () => {
    const { getByText } = render(<IconFeature icon={<svg />} title="Validated" body="Every layout passes the validator." />);
    expect(getByText('Validated')).toBeTruthy();
    expect(getByText('Every layout passes the validator.')).toBeTruthy();
  });
});
