'use client';

// Anonymous, stable rater id (no account needed). One per browser.
export function getRaterId(): string {
  try {
    let id = localStorage.getItem('ll_rater_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('ll_rater_id', id);
    }
    return id;
  } catch {
    return 'anon-fallback-id';
  }
}

const RATED_KEY = 'll_rated';

export function getRatedSlugs(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RATED_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

// Record that the user rated this element, and notify listeners (rewards progress).
export function markRated(slug: string): void {
  try {
    const set = new Set(getRatedSlugs());
    set.add(slug);
    localStorage.setItem(RATED_KEY, JSON.stringify([...set]));
    window.dispatchEvent(new Event('ll-rated'));
  } catch {
    /* ignore */
  }
}
