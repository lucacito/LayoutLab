import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// /saved is a client-only, device-local bookmarks view — it renders empty for
// crawlers and holds no unique indexable content. noindex keeps this thin,
// per-visitor page from diluting Google's model of the real sections. (The page
// itself is a Client Component and can't export metadata, so it lives here.)
export const metadata: Metadata = {
  title: 'Saved layouts',
  robots: { index: false, follow: true },
};

export default function SavedLayout({ children }: { children: ReactNode }) {
  return children;
}
