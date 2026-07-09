import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Pagination } from '@/components/Pagination';

function hrefs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
}

describe('Pagination', () => {
  it('renders nothing when there is only one page', () => {
    const { container } = render(
      <Pagination basePath="/browse" searchParams={{}} currentPage={1} totalPages={1} />,
    );
    expect(container.querySelector('nav')).toBeNull();
  });

  it('links to next/last and omits page=1 for the first page', () => {
    const { container } = render(
      <Pagination basePath="/browse" searchParams={{}} currentPage={1} totalPages={5} />,
    );
    const links = hrefs(container);
    expect(links).toContain('/browse?page=2');
    expect(links).toContain('/browse?page=5');
    // No self-link back to page 1 (current page is a span, and page 1 href drops the param).
    expect(links).not.toContain('/browse?page=1');
  });

  it('preserves active filters in every page link', () => {
    const { container } = render(
      <Pagination basePath="/browse" searchParams={{ type: 'hero', sort: 'title' }} currentPage={2} totalPages={4} />,
    );
    const links = hrefs(container);
    expect(links.every((h) => h.includes('type=hero') && h.includes('sort=title'))).toBe(true);
    expect(links).toContain('/browse?type=hero&sort=title'); // prev → page 1 drops page param
    expect(links).toContain('/browse?type=hero&sort=title&page=3'); // next
  });

  it('preserves repeated (array) filter values', () => {
    const { container } = render(
      <Pagination basePath="/browse" searchParams={{ color: ['blue', 'green'] }} currentPage={1} totalPages={3} />,
    );
    const next = hrefs(container).find((h) => h.includes('page=2')) ?? '';
    expect(next).toContain('color=blue');
    expect(next).toContain('color=green');
  });
});
