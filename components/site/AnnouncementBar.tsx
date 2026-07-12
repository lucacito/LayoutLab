'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

// Dismissible site-wide banner above the (sticky) header. Bump the version in the
// key to re-show after dismissal when the message changes.
const KEY = 'll_announce_dismissed_v3';

export function AnnouncementBar() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(!localStorage.getItem(KEY));
    } catch {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setShow(false);
  }

  return (
    <div className="relative bg-navy text-paper">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-10 py-2 text-small">
        <Icon name="bolt" size={16} className="text-action" />
        <span className="text-paper/90">The Elementor → Divi 5 converter is live — free on wordpress.org.</span>
        <Link href="/plugins/elementor-to-divi-5" className="font-semibold underline underline-offset-2 hover:text-action">
          Get the plugin
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-paper/60 transition hover:bg-paper/10 hover:text-paper"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
