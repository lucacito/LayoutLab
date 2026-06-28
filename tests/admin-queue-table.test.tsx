import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@/lib/admin/actions', () => ({
  approveLayout: vi.fn(),
  rejectLayout: vi.fn(),
  bulkApprove: vi.fn(),
}));

import { QueueTable } from '@/components/admin/QueueTable';

const rows = [
  { id: 'l1', slug: 'a', title: 'Alpha Hero', type: 'hero', niche: 'saas', style: 'minimal', preview: 'https://picsum.photos/seed/a/200/150' },
  { id: 'l2', slug: 'b', title: 'Beta Pricing', type: 'pricing', niche: 'agency', style: 'bold', preview: null },
];

describe('QueueTable', () => {
  it('renders a row per pending layout with Approve and Reject controls', () => {
    const { getByText, getAllByText } = render(<QueueTable rows={rows} />);
    expect(getByText('Alpha Hero')).toBeTruthy();
    expect(getByText('Beta Pricing')).toBeTruthy();
    expect(getAllByText('Approve').length).toBe(2);
    expect(getAllByText('Reject').length).toBe(2);
  });

  it('shows an empty state when there are no rows', () => {
    const { getByText } = render(<QueueTable rows={[]} />);
    expect(getByText(/no pending layouts/i)).toBeTruthy();
  });
});
