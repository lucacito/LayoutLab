// CLI: render a Divi 5 layout file in the local WP env and save screenshots.
// Usage: npm run render -- <layout.json>
// Accepts the validator fixture shape ({ post_title, post_content }) or
// ({ title, postContent }). Needs the local Docker WP+Divi env running.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { realRenderDeps, renderLayout } from './render';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'layout';
}

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: npm run render -- <layout.json>');
    process.exit(1);
  }
  const raw = JSON.parse(await readFile(file, 'utf8')) as { post_title?: string; title?: string; post_content?: string; postContent?: string };
  const title = raw.post_title ?? raw.title ?? 'render';
  const postContent = raw.post_content ?? raw.postContent;
  if (!postContent) {
    console.error('no post_content/postContent in the file');
    process.exit(1);
  }
  const slug = slugify(title);

  const { deps, close } = await realRenderDeps();
  try {
    console.log(`rendering "${title}" in the WP env…`);
    const { shots, perceptualHash } = await renderLayout({ title, postContent }, deps);
    const outDir = join(process.cwd(), 'pipeline', 'out', 'render');
    await mkdir(outDir, { recursive: true });
    for (const s of shots) {
      const p = join(outDir, `${slug}-${s.label}.png`);
      await writeFile(p, s.buffer);
      console.log(`  ${s.label} (${s.width}px) → ${p} (${(s.buffer.length / 1024).toFixed(0)} KB)`);
    }
    console.log(`  perceptualHash: ${perceptualHash}`);
  } finally {
    await close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
