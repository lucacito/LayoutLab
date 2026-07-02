import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CapturesTable, DownloadsTable } from '@/components/admin/EmailsTables';

describe('EmailsTables', () => {
  it('CapturesTable renders a row per captured email', () => {
    const rows = [
      { email: 'a@x.com', packTitle: 'Hero Pack', createdAt: new Date('2026-07-01T10:00:00Z') },
      { email: 'b@x.com', packTitle: null, createdAt: new Date('2026-07-02T10:00:00Z') },
    ];
    const { getByText } = render(<CapturesTable rows={rows} />);
    expect(getByText('a@x.com')).toBeTruthy();
    expect(getByText('b@x.com')).toBeTruthy();
    expect(getByText('Hero Pack')).toBeTruthy();
  });
  it('CapturesTable shows an empty state', () => {
    const { getByText } = render(<CapturesTable rows={[]} />);
    expect(getByText('No captured emails yet.')).toBeTruthy();
  });
  it('DownloadsTable renders a row per download with a fallback for a missing email/ip', () => {
    const rows = [
      { layoutTitle: 'Bold Fitness Hero', email: 'buyer@x.com', ip: '1.2.3.4', createdAt: new Date('2026-07-02T10:00:00Z') },
      { layoutTitle: 'Minimal SaaS FAQ', email: null, ip: null, createdAt: new Date('2026-07-02T09:00:00Z') },
    ];
    const { getByText, getAllByText } = render(<DownloadsTable rows={rows} />);
    expect(getByText('Bold Fitness Hero')).toBeTruthy();
    expect(getByText('buyer@x.com')).toBeTruthy();
    expect(getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });
});
