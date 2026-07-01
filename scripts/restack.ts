// Retro-fix: re-render existing published layouts with mobile single-column row
// stacking applied. No Claude — fetch JSON from Blob → patch → render → re-upload →
// update DB. Usage:
//   PROD_DATABASE_URL='postgres://…' BLOB_READ_WRITE_TOKEN=… npm run restack -- [--slug=x] [--limit=N]
import { Pool } from 'pg';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { stackLayoutJsonMobile } from '@/pipeline/stack-mobile';
import { realRenderDeps, renderLayout } from '@/pipeline/render';
import { uploadAsset } from '@/lib/blob';
import { uploadScreenshot } from '@/pipeline/upload';

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
}

async function main(): Promise<void> {
  const conn = process.env.PROD_DATABASE_URL;
  if (!conn) {
    console.error('Set PROD_DATABASE_URL');
    process.exit(1);
  }
  const onlySlug = arg('slug');
  const onlyType = arg('type');
  const limit = Number(arg('limit') ?? '0');
  const dry = process.argv.includes('--dry');
  const hasBlobToken = !!process.env.BLOB_READ_WRITE_TOKEN;

  const pool = new Pool({ connectionString: conn });
  const conds: string[] = [];
  const params: string[] = [];
  if (onlySlug) { params.push(onlySlug); conds.push(`slug = $${params.length}`); }
  if (onlyType) { params.push(onlyType); conds.push(`type = $${params.length}`); }
  const rows = (
    await pool.query(
      `select id, slug, title, divi_json_blob_key as key from layouts
       where status='published'${conds.length ? ' and ' + conds.join(' and ') : ''}
       order by created_at desc ${limit ? `limit ${limit}` : ''}`,
      params,
    )
  ).rows as { id: string; slug: string; title: string; key: string }[];

  console.log(`restacking ${rows.length} layout(s)…`);
  const { deps, close } = await realRenderDeps();
  let fixed = 0;
  let skipped = 0;
  try {
    for (const r of rows) {
      try {
        if (!/^https?:\/\//.test(r.key)) {
          console.log(`  - ${r.slug}: non-Blob key, skip`);
          skipped++;
          continue;
        }
        const raw = await (await fetch(r.key)).text();
        const patched = stackLayoutJsonMobile(raw);
        const obj = JSON.parse(patched) as { post_title?: string; post_content?: string };
        if (typeof obj.post_content !== 'string') {
          skipped++;
          continue;
        }
        const hash = createHash('sha256').update(patched).digest('hex');
        const { shots, perceptualHash } = await renderLayout({ title: obj.post_title ?? r.title, postContent: obj.post_content }, deps);
        if (dry) {
          for (const s of shots) writeFileSync(`/private/tmp/claude-501/-Users-Lucas-Documents-JHMG-Local-layoutlab/bf7033b3-4330-40ef-88e2-2b4a62e4143f/scratchpad/shots/restack-${r.slug}-${s.label}.png`, s.buffer);
          fixed++;
          console.log(`  ~ ${r.slug} (dry — saved locally)`);
          continue;
        }
        const { url: jsonUrl } = await uploadAsset(`layouts/${hash}.json`, Buffer.from(patched), 'application/json');
        const keys: string[] = [];
        for (const label of ['desktop', 'mobile'] as const) {
          const shot = shots.find((s) => s.label === label);
          if (shot) keys.push(await uploadScreenshot(hash, label, shot.buffer, { hasBlobToken }));
        }
        await pool.query(
          `update layouts set divi_json_blob_key=$1, preview_image_keys=$2::jsonb, content_hash=$3, perceptual_hash=$4 where id=$5`,
          [jsonUrl, JSON.stringify(keys), hash, perceptualHash, r.id],
        );
        fixed++;
        console.log(`  ✓ ${r.slug}`);
      } catch (e) {
        skipped++;
        console.log(`  ! ${r.slug}: ${(e as Error).message.slice(0, 100)}`);
      }
    }
  } finally {
    await close();
    await pool.end();
  }
  console.log(`done: fixed ${fixed}, skipped ${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
