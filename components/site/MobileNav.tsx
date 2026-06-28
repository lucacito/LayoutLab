'use client';
import { useState } from 'react';
import Link from 'next/link';

export function MobileNav({ links }: { links: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        aria-label="Toggle menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-button p-2 text-navy"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full border-b border-border bg-paper px-6 py-4">
          <nav className="flex flex-col gap-3">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-body text-navy" onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
