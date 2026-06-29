'use client';
import { useBookmarks } from './BookmarksProvider';
import { Icon } from '@/components/ui/Icon';

// Toggle a layout's bookmark. Safe to place inside a card <Link> — it stops the
// click from navigating.
export function BookmarkButton({ slug, className = '' }: { slug: string; className?: string }) {
  const { has, toggle } = useBookmarks();
  const saved = has(slug);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(slug);
      }}
      aria-label={saved ? 'Remove bookmark' : 'Bookmark this layout'}
      aria-pressed={saved}
      title={saved ? 'Saved — click to remove' : 'Save for later'}
      className={`flex h-9 w-9 items-center justify-center rounded-full shadow-soft transition ${
        saved ? 'bg-action text-paper' : 'bg-paper/90 text-navy backdrop-blur hover:bg-paper'
      } ${className}`}
    >
      <Icon name={saved ? 'bookmark' : 'bookmark_border'} size={20} />
    </button>
  );
}
