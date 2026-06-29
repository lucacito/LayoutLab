'use client';
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';

// Client-side bookmarks — no account needed. Persisted to localStorage so users can
// save elements and come back to them. (Account sync can layer on later.)
const KEY = 'll_bookmarks';

type Ctx = { slugs: string[]; has: (slug: string) => boolean; toggle: (slug: string) => void; count: number };
const BookmarksContext = createContext<Ctx | null>(null);

export function BookmarksProvider({ children }: { children: ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSlugs(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(slugs));
    } catch {
      /* ignore */
    }
  }, [slugs, ready]);

  const toggle = useCallback((slug: string) => {
    setSlugs((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [slug, ...cur]));
  }, []);
  const has = useCallback((slug: string) => slugs.includes(slug), [slugs]);

  return <BookmarksContext.Provider value={{ slugs, has, toggle, count: slugs.length }}>{children}</BookmarksContext.Provider>;
}

export function useBookmarks(): Ctx {
  const ctx = useContext(BookmarksContext);
  if (!ctx) throw new Error('useBookmarks must be used within a BookmarksProvider');
  return ctx;
}
