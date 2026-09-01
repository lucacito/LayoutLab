import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Em dashes are banned from everything the site renders. They read as
// AI-written, and the house style is commas, colons, parens or a full stop.
// This guard covers the source of every rendered string; DB-stored copy
// (layouts.title, taxonomy_pages.body, …) is cleaned by its own backfill.
const ROOTS = ['app', 'components', 'lib', 'content'];

// The canonical license client is synced verbatim into the Pro plugins by
// scripts/sync-license-client.sh, so editing it here silently desyncs the
// shipped copies. It renders nothing on the site.
const EXCLUDED = new Set(['lib/license-server/php-client/class-license-client.php']);

const EXTENSIONS = /\.(tsx?|css|md|txt)$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXTENSIONS.test(entry)) out.push(full);
  }
  return out;
}

describe('house style', () => {
  it('has no em dashes anywhere the site renders from', () => {
    const root = process.cwd();
    const offenders: string[] = [];

    for (const dirName of ROOTS) {
      const dir = join(root, dirName);
      try {
        statSync(dir);
      } catch {
        continue; // optional directory
      }
      for (const file of walk(dir)) {
        const rel = relative(root, file);
        if (EXCLUDED.has(rel)) continue;
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (line.includes('—')) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
          });
      }
    }

    expect(offenders).toEqual([]);
  });
});
