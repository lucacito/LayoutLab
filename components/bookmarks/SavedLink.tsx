'use client';
import Link from 'next/link';
import { useBookmarks } from './BookmarksProvider';
import { Icon } from '@/components/ui/Icon';

// Top-right access point to the user's saved elements, with a live count.
export function SavedLink() {
  const { count } = useBookmarks();
  return (
    <Link
      href="/saved"
      className="relative flex items-center gap-1.5 text-small font-medium text-navy transition hover:text-action"
    >
      <Icon name={count > 0 ? 'bookmark' : 'bookmark_border'} size={20} />
      Saved
      {count > 0 && (
        <span className="rounded-full bg-action px-1.5 py-0.5 text-[11px] font-semibold leading-none text-paper">{count}</span>
      )}
    </Link>
  );
}
