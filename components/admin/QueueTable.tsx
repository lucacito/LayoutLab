'use client';
import { useState } from 'react';
import Image from 'next/image';
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
    return <p className="py-12 text-center text-gray-500">No pending layouts to review. 🎉</p>;
  }

  return (
    <div>
      <div className="mb-4">
        <form action={() => bulkApprove([...selected])}>
          <button
            type="submit"
            disabled={!selected.size}
            className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            Approve {selected.size || ''} selected
          </button>
        </form>
      </div>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-4 rounded border border-gray-200 p-3">
            <input
              type="checkbox"
              aria-label={`Select ${r.title}`}
              checked={selected.has(r.id)}
              onChange={() => toggle(r.id)}
            />
            <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded bg-gray-100">
              {r.preview && (
                <Image src={assetUrl(r.preview)} alt={r.title} fill sizes="96px" className="object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-gray-900">{r.title}</p>
              <p className="text-xs text-gray-500">{r.type} · {r.niche} · {r.style}</p>
            </div>
            <form action={approveLayout.bind(null, r.id)}>
              <button type="submit" className="rounded bg-green-600 px-3 py-1.5 text-sm text-white">Approve</button>
            </form>
            <form action={rejectLayout.bind(null, r.id)}>
              <button type="submit" className="rounded border border-gray-300 px-3 py-1.5 text-sm">Reject</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
