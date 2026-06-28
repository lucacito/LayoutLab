'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { assetUrl } from '@/lib/blob/url';
import { approveLayout, rejectLayout, bulkApprove } from '@/lib/admin/actions';

export type QueueRow = {
  id: string;
  slug: string;
  title: string;
  type: string;
  niche: string | null;
  style: string | null;
  preview: string | null;
};

export function QueueTable({ rows }: { rows: QueueRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  if (!rows.length) {
    return <p className="py-12 text-center text-muted">No pending layouts to review. 🎉</p>;
  }

  return (
    <div>
      <div className="mb-4">
        <form action={() => bulkApprove([...selected])}>
          <Button disabled={!selected.size}>
            Approve {selected.size || ''} selected
          </Button>
        </form>
      </div>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-4 rounded-card border border-border bg-paper p-4">
            <input
              type="checkbox"
              aria-label={`Select ${r.title}`}
              checked={selected.has(r.id)}
              onChange={() => toggle(r.id)}
            />
            <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-card bg-fog">
              {r.preview && (
                <Image src={assetUrl(r.preview)} alt={r.title} fill sizes="96px" className="object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-body text-navy">{r.title}</p>
              <p className="text-small text-muted">{r.type} · {r.niche} · {r.style}</p>
            </div>
            <form action={approveLayout.bind(null, r.id)}>
              <Button type="submit">Approve</Button>
            </form>
            <form action={rejectLayout.bind(null, r.id)}>
              <Button type="submit" variant="secondary">Reject</Button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
