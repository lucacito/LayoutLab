import type { LayoutStatus } from '@/lib/admin/queries';

// Resolve the status a freshly-ingested layout should land in.
//
// Layouts publish immediately on ingest — there is no admin review queue. The
// pipeline populates the live catalog directly. (Deliberate owner decision that
// overrides the CLAUDE.md human-approval gate; unpublish is still available if a
// bad layout slips through.)
export function resolveIngestStatus(): {
  status: LayoutStatus;
  publishedAt: Date;
} {
  return { status: 'published', publishedAt: new Date() };
}
