// T3.3 — Feed the untapped validator grounding (LandingGuide / ImageGuide) into loadGrounding.
//
// LandingGuide.php and ImageGuide.php (in the sibling validator repo) ship ONLY as PHP
// heredoc strings (`public static function markdown(): string { return <<<'MD' ... MD; }`).
// There is no separate markdown/JSON export in docs/ or wp-plugin/data/ (docs/STYLE.md and
// docs/SCHEMA.md are hand-authored docs already loaded by loadGrounding — verified they are
// NOT the same text as StyleGuide.php's own markdown()). So this reads the heredoc body out
// of the PHP source with a small, robust regex (not a PHP parser) and fails soft to
// `undefined` on any file-missing/shape-mismatch problem.
import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadGrounding } from '@/pipeline/recipes/grounding';

const REAL_VALIDATOR_DIR = join(process.cwd(), '..', 'Divi 5 Deterministic Validator');
const hasRealValidator = existsSync(join(REAL_VALIDATOR_DIR, 'wp-plugin', 'src', 'LandingGuide.php'));

function makeFixtureValidatorDir(opts: { landingGuide?: boolean; imageGuide?: boolean } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'grounding-fixture-'));
  mkdirSync(join(dir, 'docs'), { recursive: true });
  mkdirSync(join(dir, 'wp-plugin', 'data'), { recursive: true });
  mkdirSync(join(dir, 'wp-plugin', 'src'), { recursive: true });
  writeFileSync(join(dir, 'docs', 'STYLE.md'), '# style');
  writeFileSync(join(dir, 'docs', 'SCHEMA.md'), '# schema');
  writeFileSync(
    join(dir, 'wp-plugin', 'data', 'section-recipes.json'),
    JSON.stringify([{ name: 'hero-cta', title: 'Hero', description: 'd', when: 'w', markup: 'M' }]),
  );
  if (opts.landingGuide !== false) {
    writeFileSync(
      join(dir, 'wp-plugin', 'src', 'LandingGuide.php'),
      [
        "<?php",
        "final class LandingGuide {",
        "  public static function markdown(): string {",
        "    return <<<'MD'",
        "# Fake Landing Guide",
        "- **SaaS**: hero -> problem -> proof -> final CTA.",
        "- **Service / agency**: hero -> proof -> final CTA.",
        "MD;",
        "  }",
        "}",
      ].join('\n'),
    );
  }
  if (opts.imageGuide !== false) {
    writeFileSync(
      join(dir, 'wp-plugin', 'src', 'ImageGuide.php'),
      [
        "<?php",
        "final class ImageGuide {",
        "  public static function markdown(): string {",
        "    return <<<'MD'",
        "# Fake Image Guide",
        "Pin every image with ?lock={n} so it never reshuffles.",
        "MD;",
        "  }",
        "}",
      ].join('\n'),
    );
  }
  return dir;
}

describe('loadGrounding — landing + image guide extraction', () => {
  it('extracts the LandingGuide and ImageGuide heredoc bodies when present', () => {
    const dir = makeFixtureValidatorDir();
    try {
      const guide = loadGrounding(dir);
      expect(guide.landingGuide).toBeDefined();
      expect(guide.landingGuide).toContain('Fake Landing Guide');
      expect(guide.landingGuide).toContain('**SaaS**: hero -> problem -> proof -> final CTA.');
      expect(guide.imageGuide).toBeDefined();
      expect(guide.imageGuide).toContain('Fake Image Guide');
      expect(guide.imageGuide).toContain('?lock={n}');
      // The PHP wrapper (class/method declarations) must not leak into the guide text.
      expect(guide.landingGuide).not.toContain('<?php');
      expect(guide.imageGuide).not.toContain('final class');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back gracefully (grounding still valid, guidance fields undefined) when the guide files are absent', () => {
    const dir = makeFixtureValidatorDir({ landingGuide: false, imageGuide: false });
    try {
      const guide = loadGrounding(dir);
      expect(guide.style).toBeDefined();
      expect(guide.schema).toBeDefined();
      expect(guide.recipes?.length).toBeGreaterThan(0);
      expect(guide.landingGuide).toBeUndefined();
      expect(guide.imageGuide).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back gracefully when only one of the two guide files is present', () => {
    const dir = makeFixtureValidatorDir({ imageGuide: false });
    try {
      const guide = loadGrounding(dir);
      expect(guide.landingGuide).toContain('Fake Landing Guide');
      expect(guide.imageGuide).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('never throws when the whole validatorDir is missing the wp-plugin/src directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'grounding-fixture-empty-'));
    mkdirSync(join(dir, 'docs'), { recursive: true });
    mkdirSync(join(dir, 'wp-plugin', 'data'), { recursive: true });
    writeFileSync(join(dir, 'docs', 'STYLE.md'), '# style');
    writeFileSync(join(dir, 'docs', 'SCHEMA.md'), '# schema');
    writeFileSync(
      join(dir, 'wp-plugin', 'data', 'section-recipes.json'),
      JSON.stringify([{ name: 'hero-cta', title: 'Hero', description: 'd', when: 'w', markup: 'M' }]),
    );
    try {
      const guide = loadGrounding(dir);
      expect(guide.landingGuide).toBeUndefined();
      expect(guide.imageGuide).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe.skipIf(!hasRealValidator)('loadGrounding against the real sibling validator repo', () => {
  it('extracts real landing + image guidance', () => {
    const guide = loadGrounding(REAL_VALIDATOR_DIR);
    expect(guide.landingGuide).toContain('Divi 5 Landing Page Conversion Blueprint');
    expect(guide.landingGuide).toContain('**SaaS**:');
    expect(guide.imageGuide).toContain('Divi 5 Image Intelligence Guide');
    expect(guide.imageGuide).toContain('loremflickr.com');
  });
});
