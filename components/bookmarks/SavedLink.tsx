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
      aria-label="Saved layouts"
      title="Saved layouts"
      className="group flex items-center text-small font-medium text-navy transition hover:text-action"
    >
      <Icon name={count > 0 ? 'bookmark' : 'bookmark_border'} size={20} />
      {/* Label is hidden until hover, then slides + fades in */}
      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out group-hover:ml-1.5 group-hover:max-w-[4rem] group-hover:opacity-100">
        Saved
      </span>
      {count > 0 && (
        <span className="ml-1.5 rounded-full bg-action px-1.5 py-0.5 text-[11px] font-semibold leading-none text-paper">{count}</span>
      )}
    </Link>
  );
}
