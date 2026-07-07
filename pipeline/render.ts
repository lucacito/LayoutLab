// Phase 3b — render a Divi 5 layout in the local WP+Divi env and screenshot it.
//
// Proven flow: create a PUBLISHED Divi 5 page from the layout's post_content via
// wp-cli (license-free; sets the Divi 5 builder meta), open its URL in Playwright,
// hide the theme chrome (header/nav/footer/admin bar), screenshot the `.et-l--post`
// content wrapper at desktop + mobile widths, compute a perceptual hash, then
// delete the temp page. The orchestration is dependency-injected so it unit-tests
// without a live WP / browser; `realRenderDeps()` wires wp-cli + Playwright.

import { spawn } from 'node:child_process';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

export interface RenderShot {
  label: 'desktop' | 'mobile';
  width: number;
  buffer: Buffer;
}

export interface RenderResult {
  /** T2.1: explicit render verdict. 'ok' = at least a confirmable screenshot for
   * every viewport; 'blank' = some viewport never painted real content (the
   * page-height check below never crossed its threshold) — the caller (run.ts,
   * via pipeline/deps.ts) drops the layout rather than shipping a screenshot of
   * an empty page. Distinct from an exception (render.ts/deps.ts never catch
   * those here — they propagate so the caller can count them as `renderFailed`
   * instead of `renderBlank`). */
  outcome: 'ok' | 'blank';
  shots: RenderShot[];
  /** 64-hex-char difference-hash (dHash) of the desktop shot, for near-duplicate
   * detection. Absent when `outcome === 'blank'` (there's no real desktop shot
   * to hash). */
  perceptualHash?: string;
}

/** T2.1: a single viewport's screenshot verdict — 'blank' means the page never
 * confirmably painted content (no real buffer to return); the caller must NOT
 * fall back to screenshotting the empty page. */
export type ScreenshotResult = { outcome: 'ok'; buffer: Buffer } | { outcome: 'blank' };

export interface RenderDeps {
  createPage(input: { title: string; postContent: string }): Promise<{ id: string; url: string }>;
  deletePage(id: string): Promise<void>;
  screenshot(url: string, opts: { width: number; height: number }): Promise<ScreenshotResult>;
}

const VIEWPORTS: { label: 'desktop' | 'mobile'; width: number; height: number }[] = [
  { label: 'desktop', width: 1440, height: 1024 },
  { label: 'mobile', width: 390, height: 844 },
];

/**
 * Difference-hash (dHash) of a PNG (T1.2 — upgraded from average-hash/aHash for
 * better near-duplicate discrimination: comparing each pixel to its right
 * neighbor captures local edges/gradients, whereas aHash's "pixel vs global
 * mean" test misses layouts that differ locally but share the same average
 * brightness/structure).
 *
 * Resizes to 17×16 grayscale, compares each pixel to its right neighbor
 * (16 comparisons × 16 rows = 256 bits), and packs 4 bits per hex char — the
 * SAME 64-hex-char output shape the prior aHash produced. This is a deliberate
 * format-compatibility choice (see pipeline/dedupe.ts near-dupe gate + T1.2
 * report): existing DB rows holding aHash values are plain 64-char hex strings
 * indistinguishable at rest from a dHash value, so no schema migration/algo
 * discriminator column was added (backfill is explicitly out of scope for this
 * task). `isNearDuplicate` compares by hamming distance over same-length hex
 * strings regardless of which algorithm produced them; the comparison code
 * itself has no awareness of which algorithm produced either hash, so this is
 * a probabilistic argument, not a structural guarantee: aHash and dHash encode
 * different bit semantics for the same image, so a mixed aHash/dHash pair is
 * EXPECTED, in the general case, to land far apart in hamming distance (biasing
 * toward a missed near-dupe rather than a false positive) — but nothing in the
 * code prevents two cross-algorithm hashes from coincidentally landing within
 * the threshold. Consistent with the "never block ingest for this reason"
 * bias (T1.2 item 4), not a categorical impossibility.
 */
export async function perceptualHash(png: Buffer): Promise<string> {
  const width = 17;
  const height = 16;
  const data = await sharp(png).grayscale().resize(width, height, { fit: 'fill' }).raw().toBuffer();
  const bits: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      const left = data[y * width + x];
      const right = data[y * width + x + 1];
      bits.push(left < right ? 1 : 0);
    }
  }
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    let nibble = 0;
    for (let b = 0; b < 4; b++) nibble = (nibble << 1) | bits[i + b];
    hex += nibble.toString(16);
  }
  return hex;
}

/**
 * Render a layout to screenshots (+ perceptual hash). The temp page is always
 * cleaned up. T2.1: if ANY viewport's screenshot comes back with a `blank`
 * verdict, the whole render is reported `blank` — a layout isn't confirmably
 * good just because one viewport happened to paint while another didn't — and
 * we short-circuit without screenshotting the remaining viewports (nothing
 * salvageable once one viewport is confirmed blank).
 */
export async function renderLayout(input: { title: string; postContent: string }, deps: RenderDeps): Promise<RenderResult> {
  const page = await deps.createPage(input);
  try {
    const shots: RenderShot[] = [];
    for (const v of VIEWPORTS) {
      const result = await deps.screenshot(page.url, { width: v.width, height: v.height });
      if (result.outcome === 'blank') {
        return { outcome: 'blank', shots: [] };
      }
      shots.push({ label: v.label, width: v.width, buffer: result.buffer });
    }
    const desktop = shots.find((s) => s.label === 'desktop') ?? shots[0];
    const perceptualHash_ = await perceptualHash(desktop.buffer);
    return { outcome: 'ok', shots, perceptualHash: perceptualHash_ };
  } finally {
    await deps.deletePage(page.id).catch(() => {});
  }
}

// ---- Real deps: wp-cli (docker) + Playwright -----------------------------

const HIDE_CHROME = `#main-header,#top-header,#et-top-navigation,#wpadminbar,#main-footer,.et-l--footer,#footer-bottom,#et-info,header#main-header{display:none!important}#page-container{padding-top:0!important}html.js #page-container{padding-top:0!important}body{margin-top:0!important}`;

function run(cmd: string, args: string[], stdin?: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => resolve({ stdout, stderr, code: code ?? 0 }));
    if (stdin !== undefined) child.stdin.end(stdin);
    else child.stdin.end();
  });
}

// Scroll the page top→bottom→top so every off-screen section paints before we
// screenshot. Without this, an element screenshot of content taller than the
// viewport can capture unpainted regions as a black dead zone (the root cause of
// the truncated previews). Runs in the browser via page.evaluate.
async function paintFullPage(page: { evaluate: (fn: () => Promise<void>) => Promise<void> }): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
        let y = 0;
        const timer = setInterval(() => {
          window.scrollTo(0, y);
          y += step;
          if (y >= document.body.scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 60);
      }),
  );
}

/**
 * Live render deps backed by the local Docker WP+Divi env. Configurable via env:
 * RENDER_WPCLI_CONTAINER (default `divi5val_wpcli`) and WP_RENDER_BASE_URL
 * (default `http://localhost:8181`). Returns the deps + a `close()` for the browser.
 */
export async function realRenderDeps(): Promise<{ deps: RenderDeps; close: () => Promise<void> }> {
  const { chromium } = await import('playwright');
  const container = process.env.RENDER_WPCLI_CONTAINER ?? 'divi5val_wpcli';
  const baseUrl = (process.env.WP_RENDER_BASE_URL ?? 'http://localhost:8181').replace(/\/$/, '');
  const browser = await chromium.launch();

  const deps: RenderDeps = {
    async createPage({ title, postContent }) {
      const dir = await mkdtemp(join(tmpdir(), 'll-render-'));
      const hostFile = join(dir, 'content.html');
      const inFile = '/tmp/ll-render-content.html';
      await writeFile(hostFile, postContent, 'utf8');
      const cp = await run('docker', ['cp', hostFile, `${container}:${inFile}`]);
      if (cp.code !== 0) throw new Error(`docker cp failed: ${cp.stderr.slice(0, 200)}`);
      const create = await run('docker', [
        'exec', container, 'sh', '-c',
        `wp post create --post_type=page --post_status=publish --post_title=${JSON.stringify(title)} --post_content="$(cat ${inFile})" --porcelain`,
      ]);
      const id = create.stdout.trim();
      if (!id || create.code !== 0) throw new Error(`wp post create failed: ${create.stderr.slice(0, 200)}`);
      await run('docker', ['exec', container, 'wp', 'post', 'meta', 'update', id, '_et_pb_use_builder', 'on']);
      await run('docker', ['exec', container, 'wp', 'post', 'meta', 'update', id, '_et_pb_use_divi_5', 'on']);
      await rm(dir, { recursive: true, force: true });
      return { id, url: `${baseUrl}/?page_id=${id}` };
    },
    async deletePage(id) {
      await run('docker', ['exec', container, 'wp', 'post', 'delete', id, '--force']);
    },
    async screenshot(url, { width, height }): Promise<ScreenshotResult> {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      try {
        // WP can intermittently prepend PHP warnings (translations_api / "headers
        // already sent") that blank the render. Reload until the Divi content
        // wrapper actually has height.
        for (let attempt = 1; attempt <= 3; attempt++) {
          await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
          await page.waitForTimeout(700);
          const wrapper = page.locator('.et-l--post').first();
          const box = (await wrapper.count()) ? await wrapper.boundingBox() : null;
          if (box && box.height > 150) {
            await page.addStyleTag({ content: HIDE_CHROME });
            // Force the full page to PAINT before the element screenshot. Playwright's
            // element screenshot captures the whole element, but content below the
            // viewport can still be unpainted (→ black dead zone) when the shot fires.
            // Scrolling through it top-to-bottom forces every section to render first.
            await paintFullPage(page);
            await page.waitForTimeout(300);
            return { outcome: 'ok', buffer: await wrapper.screenshot() };
          }
          if (attempt < 3) await page.waitForTimeout(1000);
        }
        // Final check: a legitimately short layout (header/footer ≈ 100px) never
        // crosses the 150px bar but still has real content — crop to the wrapper.
        // T2.1: no more silent `fullPage` fallback screenshotting an empty page
        // when there's no meaningful wrapper height — report `blank` instead and
        // let the caller (run.ts, via pipeline/deps.ts) drop the layout.
        await page.addStyleTag({ content: HIDE_CHROME });
        await paintFullPage(page);
        await page.waitForTimeout(250);
        const wrapper = page.locator('.et-l--post').first();
        const box = (await wrapper.count()) ? await wrapper.boundingBox() : null;
        if (box && box.height > 40) return { outcome: 'ok', buffer: await wrapper.screenshot() };
        return { outcome: 'blank' };
      } finally {
        await page.close();
      }
    },
  };

  return { deps, close: () => browser.close() };
}
