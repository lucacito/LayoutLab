'use client';
import { useBookmarks } from './BookmarksProvider';

// Live count of saved layouts (localStorage), for the account dashboard.
export function SavedCount() {
  const { count } = useBookmarks();
  return <>{count}</>;
}
