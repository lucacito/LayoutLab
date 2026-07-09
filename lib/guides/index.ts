import fs from 'node:fs';
import path from 'node:path';

// Guides are trusted markdown files in content/guides/*.md with a minimal
// frontmatter block. Read synchronously at request time (files are tiny and
// the route is dynamic); no MDX/contentlayer machinery.
export interface Guide {
  slug: string;
  title: string;
  description: string;
  date: string;      // YYYY-MM-DD (publication)
  updated?: string;  // YYYY-MM-DD (last significant edit)
  keywords: string[];
  body: string;      // markdown after the frontmatter
}

const GUIDES_DIR = path.join(process.cwd(), 'content', 'guides');

/**
 * Tiny frontmatter parser — supports exactly what our guide files use:
 * `key: value` lines (value may contain colons), optional double quotes,
 * and comma-separated lists for `keywords`. Not YAML; kept deliberately dumb.
 */
export function parseFrontmatter(raw: string): { data: Record<string, string | string[]>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) throw new Error('Missing frontmatter block (--- ... ---)');
  const data: Record<string, string | string[]> = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    if (idx === -1) throw new Error(`Bad frontmatter line: ${line}`);
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    data[key] = key === 'keywords' ? value.split(',').map((s) => s.trim()).filter(Boolean) : value;
  }
  return { data, body: raw.slice(match[0].length) };
}

function readGuide(file: string): Guide {
  const slug = path.basename(file, '.md');
  const { data, body } = parseFrontmatter(fs.readFileSync(path.join(GUIDES_DIR, file), 'utf8'));
  const str = (k: string): string => {
    const v = data[k];
    if (typeof v !== 'string' || !v) throw new Error(`Guide ${slug}: missing frontmatter "${k}"`);
    return v;
  };
  return {
    slug,
    title: str('title'),
    description: str('description'),
    date: str('date'),
    updated: typeof data.updated === 'string' ? data.updated : undefined,
    keywords: Array.isArray(data.keywords) ? data.keywords : [],
    body,
  };
}

export function listGuides(): Guide[] {
  if (!fs.existsSync(GUIDES_DIR)) return [];
  return fs
    .readdirSync(GUIDES_DIR)
    .filter((f) => f.endsWith('.md'))
    .map(readGuide)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
}

export function getGuide(slug: string): Guide | undefined {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return undefined;
  const file = path.join(GUIDES_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return undefined;
  return readGuide(`${slug}.md`);
}
