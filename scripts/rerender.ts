// Re-render a pipeline layout by content hash → overwrite its screenshots in place
// (same keys the DB already references). Screenshots upload as `.webp` — rows still
// referencing legacy `.png` keys must be migrated first (scripts/optimize-live-images.ts),
// or the overwrite lands on a key the DB doesn't point at.
// Usage: npm run rerender -- <hash> [<hash> …]
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { realRenderDeps, renderLayout } from '@/pipeline/render';
import { uploadScreenshot } from '@/pipeline/upload';

async function main() {
  const hashes = process.argv.slice(2);
  if (!hashes.length) { console.error('usage: npm run rerender -- <hash> …'); process.exit(1); }
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;
  const { deps, close } = await realRenderDeps();
  try {
    for (const hash of hashes) {
      const raw = JSON.parse(await readFile(join(process.cwd(), 'pipeline', 'out', `${hash}.json`), 'utf8')) as { post_title?: string; post_content: string };
      console.log(`re-rendering ${hash.slice(0, 12)} (${raw.post_title})…`);
      const result = await renderLayout({ title: raw.post_title ?? 'Section', postContent: raw.post_content }, deps);
      if (result.outcome === 'blank') {
        console.warn(`  ! ${hash.slice(0, 12)}: page never confirmably painted content, skipping (not re-uploaded)`);
        continue;
      }
      const { shots, perceptualHash } = result;
      for (const label of ['desktop', 'mobile'] as const) {
        const shot = shots.find((s) => s.label === label);
        if (shot) await uploadScreenshot(hash, label, shot.buffer, { hasBlobToken });
      }
      console.log(`  ✓ phash ${perceptualHash?.slice(0, 12)}`);
    }
  } finally { await close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
