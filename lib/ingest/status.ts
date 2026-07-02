import type { LayoutStatus } from '@/lib/admin/queries';

// Resolve the status a freshly-ingested layout should land in.
//
// Default: `pending` — layouts wait in the admin queue for a one-click approval
// before going live (the CLAUDE.md quality gate). Set INGEST_AUTO_APPROVE to a
// truthy value ('1'/'true') to bypass the queue and publish on ingest, so the
// pipeline can populate the live catalog without manual review.
export function resolveIngestStatus(autoApprove: string | undefined): {
  status: LayoutStatus;
  publishedAt?: Date;
} {
  const on = autoApprove != null && /^(1|true)$/i.test(autoApprove.trim());
  return on ? { status: 'published', publishedAt: new Date() } : { status: 'pending' };
}
