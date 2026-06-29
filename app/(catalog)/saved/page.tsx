'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useBookmarks } from '@/components/bookmarks/BookmarksProvider';
import { LayoutCard } from '@/components/LayoutCard';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';
import type { LayoutRow } from '@/lib/catalog/queries';

export default function SavedPage() {
  const { slugs } = useBookmarks();
  const [items, setItems] = useState<LayoutRow[] | null>(null);

  useEffect(() => {
    if (!slugs.length) {
      setItems([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/layouts/by-slugs?slugs=${encodeURIComponent(slugs.join(','))}`)
      .then((r) => r.json())
      .then((d: { layouts: LayoutRow[] }) => {
        if (cancelled) return;
        // Preserve the user's bookmark order (newest first).
        const bySlug = new Map(d.layouts.map((l) => [l.slug, l]));
        setItems(slugs.map((s) => bySlug.get(s)).filter((l): l is LayoutRow => !!l));
      })
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [slugs]);

  return (
    <Container className="py-12">
      <h1 className="text-h1 text-navy">Saved elements</h1>
      <p className="mt-3 text-lead text-muted">Your bookmarked layouts, ready when you are. Saved on this device.</p>

      {items === null ? (
        <p className="mt-12 text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="mt-12 rounded-card border border-border bg-mist p-12 text-center">
          <p className="text-body text-navy">You haven&apos;t saved anything yet.</p>
          <p className="mt-2 text-small text-muted">Tap the bookmark icon on any element to keep it here.</p>
          <div className="mt-6 flex justify-center">
            <Button href="/browse">Browse layouts</Button>
          </div>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((l) => (
            <LayoutCard key={l.id} layout={l} />
          ))}
        </div>
      )}

      {items && items.length > 0 && (
        <p className="mt-8 text-small text-muted">
          Want these on every device?{' '}
          <Link href="/login" className="font-medium text-action hover:underline">
            Sign in
          </Link>{' '}
          to sync your saved elements.
        </p>
      )}
    </Container>
  );
}
