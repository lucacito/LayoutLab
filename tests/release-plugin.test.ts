import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import JSZip from 'jszip';
import { blobKeyFor, buildZipFromDir } from '../scripts/release-plugin';

describe('blobKeyFor', () => {
  it('namespaces zips by product and version', () => {
    expect(blobKeyFor('elementor-to-divi5-pro', '1.2.0'))
      .toBe('plugins/elementor-to-divi5-pro/elementor-to-divi5-pro-1.2.0.zip');
  });
});

describe('buildZipFromDir', () => {
  it('zips the plugin folder recursively with the folder as zip root', async () => {
    const base = mkdtempSync(join(tmpdir(), 'relplug-'));
    const plugin = join(base, 'my-pro-plugin');
    mkdirSync(join(plugin, 'includes'), { recursive: true });
    writeFileSync(join(plugin, 'my-pro-plugin.php'), '<?php // main');
    writeFileSync(join(plugin, 'includes', 'class-x.php'), '<?php // x');
    const buf = await buildZipFromDir(plugin);
    const zip = await JSZip.loadAsync(buf);
    const names = Object.keys(zip.files).sort();
    expect(names).toContain(`${basename(plugin)}/my-pro-plugin.php`);
    expect(names).toContain(`${basename(plugin)}/includes/class-x.php`);
  });
});
