// T3.3 — Feed the untapped validator grounding (LandingGuide) into loadGrounding.
//
// The image guide is now PIPELINE-OWNED (pipeline/recipes/image-guide.ts): the plugin's
// ImageGuide.php became dynamic (media library + bundled local images) and is meaningless for
// offline marketplace generation. Recipes also carry `{{aied:image:<token>}}` tokens that
// loadGrounding resolves to remote picsum URLs.
//
// LandingGuide.php (in the sibling validator repo) ships ONLY as a PHP
// heredoc string (`public static function markdown(): string { return <<<'MD' ... MD; }`).
// There is no separate markdown/JSON export in docs/ or wp-plugin/data/ (docs/STYLE.md and
// docs/SCHEMA.md are hand-authored docs already loaded by loadGrounding — verified they are
// NOT the same text as StyleGuide.php's own markdown()). So this reads the heredoc body out
// of the PHP source with a small, robust regex (not a PHP parser) and fails soft to
// `undefined` on any file-missing/shape-mismatch problem.
import { describe, it, expect } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadGrounding, resolveRecipeImageTokens } from '@/pipeline/recipes/grounding';
import { IMAGE_GUIDE_MARKDOWN } from '@/pipeline/recipes/image-guide';

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
  it('extracts the LandingGuide heredoc body when present and uses the pipeline-owned image guide (plugin ImageGuide.php is ignored)', () => {
    const dir = makeFixtureValidatorDir();
    try {
      const guide = loadGrounding(dir);
      expect(guide.landingGuide).toBeDefined();
      expect(guide.landingGuide).toContain('Fake Landing Guide');
      expect(guide.landingGuide).toContain('**SaaS**: hero -> problem -> proof -> final CTA.');
      expect(guide.imageGuide).toBe(IMAGE_GUIDE_MARKDOWN);
      expect(guide.imageGuide).toContain('Divi 5 Image Intelligence Guide');
      expect(guide.imageGuide).not.toContain('Fake Image Guide');
      // The PHP wrapper (class/method declarations) must not leak into the guide text.
      expect(guide.landingGuide).not.toContain('<?php');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back gracefully (landing undefined; image guide still the pipeline-owned one) when the guide files are absent', () => {
    const dir = makeFixtureValidatorDir({ landingGuide: false, imageGuide: false });
    try {
      const guide = loadGrounding(dir);
      expect(guide.style).toBeDefined();
      expect(guide.schema).toBeDefined();
      expect(guide.recipes?.length).toBeGreaterThan(0);
      expect(guide.landingGuide).toBeUndefined();
      expect(guide.imageGuide).toBe(IMAGE_GUIDE_MARKDOWN);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('warns via the optional log callback when LandingGuide.php is absent (the image guide is pipeline-owned, so never warns), and stays silent (no throw) with the default no-op logger', () => {
    const dir = makeFixtureValidatorDir({ landingGuide: false, imageGuide: false });
    try {
      const messages: string[] = [];
      const guide = loadGrounding(dir, (m) => messages.push(m));
      expect(guide.landingGuide).toBeUndefined();
      expect(messages.some((m) => m.includes('LandingGuide'))).toBe(true);
      expect(messages.some((m) => m.includes('ImageGuide'))).toBe(false);
      // default (no logger passed) must not throw
      expect(() => loadGrounding(dir)).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does NOT warn when the landing guide extracts successfully', () => {
    const dir = makeFixtureValidatorDir();
    try {
      const messages: string[] = [];
      loadGrounding(dir, (m) => messages.push(m));
      expect(messages).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('keeps the landing guide when the plugin ImageGuide.php is absent (image guide never depended on it)', () => {
    const dir = makeFixtureValidatorDir({ imageGuide: false });
    try {
      const guide = loadGrounding(dir);
      expect(guide.landingGuide).toContain('Fake Landing Guide');
      expect(guide.imageGuide).toBe(IMAGE_GUIDE_MARKDOWN);
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
      expect(guide.imageGuide).toBe(IMAGE_GUIDE_MARKDOWN);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// Review fix (T3.3 follow-up): the extraction regex was a non-greedy match up to
// the FIRST `\nMD;` line. That's truthy-but-WRONG (silent truncation, not the
// documented fail-soft `undefined`) whenever the heredoc body itself contains a
// line that looks like a terminator (e.g. quoting heredoc syntax in the guide
// prose) or whenever a second heredoc exists later in the file. Hardened
// `extractHeredocMarkdown` must turn that ambiguity into `undefined` rather than
// silently truncating.
function makeMinimalValidatorDirWithRawLandingGuide(phpContent: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'grounding-ambiguity-'));
  mkdirSync(join(dir, 'docs'), { recursive: true });
  mkdirSync(join(dir, 'wp-plugin', 'data'), { recursive: true });
  mkdirSync(join(dir, 'wp-plugin', 'src'), { recursive: true });
  writeFileSync(join(dir, 'docs', 'STYLE.md'), '# style');
  writeFileSync(join(dir, 'docs', 'SCHEMA.md'), '# schema');
  writeFileSync(
    join(dir, 'wp-plugin', 'data', 'section-recipes.json'),
    JSON.stringify([{ name: 'hero-cta', title: 'Hero', description: 'd', when: 'w', markup: 'M' }]),
  );
  writeFileSync(join(dir, 'wp-plugin', 'src', 'LandingGuide.php'), phpContent);
  return dir;
}

describe('extractHeredocMarkdown hardening — ambiguity yields undefined, never truncation', () => {
  it('returns undefined (not a truncated string) when the heredoc body itself contains a literal "MD;" line', () => {
    const dir = makeMinimalValidatorDirWithRawLandingGuide(
      [
        "<?php",
        "final class LandingGuide {",
        "  public static function markdown(): string {",
        "    return <<<'MD'",
        "# Guide",
        "Some example below shows a raw terminator like this:",
        "MD;",
        "And more real content continues after that fake terminator.",
        "MD;",
        "  }",
        "}",
      ].join('\n'),
    );
    try {
      const guide = loadGrounding(dir);
      // Must NOT be the truncated body (stopping at the first "MD;" line) —
      // it must fail soft to undefined since the file is ambiguous.
      expect(guide.landingGuide).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns undefined (ambiguous) when the file contains two separate heredoc blocks', () => {
    const dir = makeMinimalValidatorDirWithRawLandingGuide(
      [
        "<?php",
        "final class LandingGuide {",
        "  public static function markdown(): string {",
        "    return <<<'MD'",
        "# Guide One",
        "MD;",
        "  }",
        "  public static function otherMarkdown(): string {",
        "    return <<<'MD'",
        "# Guide Two",
        "MD;",
        "  }",
        "}",
      ].join('\n'),
    );
    try {
      const guide = loadGrounding(dir);
      expect(guide.landingGuide).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('still extracts the full body for the real single-heredoc shape (no false-positive ambiguity)', () => {
    const dir = makeMinimalValidatorDirWithRawLandingGoodShape();
    try {
      const guide = loadGrounding(dir);
      expect(guide.landingGuide).toBeDefined();
      expect(guide.landingGuide).toContain('# Fake Landing Guide');
      expect(guide.landingGuide).toContain('- **SaaS**: hero -> problem -> proof -> final CTA.');
      expect(guide.landingGuide).toContain('- **Service / agency**: hero -> proof -> final CTA.');
      expect(guide.landingGuide).not.toContain('<?php');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

function makeMinimalValidatorDirWithRawLandingGoodShape(): string {
  return makeMinimalValidatorDirWithRawLandingGuide(
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

describe.skipIf(!hasRealValidator)('loadGrounding against the real sibling validator repo', () => {
  it('extracts real landing guidance and serves the pipeline-owned image guide', () => {
    const guide = loadGrounding(REAL_VALIDATOR_DIR);
    expect(guide.landingGuide).toContain('Divi 5 Landing Page Conversion Blueprint');
    expect(guide.landingGuide).toContain('**SaaS**:');
    // flow.ts's landingBlueprintForCategory depends on this section heading.
    expect(guide.landingGuide).toContain('Step 0 — Decide before you build');
    expect(guide.imageGuide).toContain('Divi 5 Image Intelligence Guide');
    expect(guide.imageGuide).toContain('loremflickr.com');
    expect(guide.imageGuide).not.toContain('list_media_images');
    expect(guide.imageGuide).not.toContain('{{aied:');
  });

  it('hands out token-free recipes that use remote picsum placeholder URLs', () => {
    const guide = loadGrounding(REAL_VALIDATOR_DIR);
    expect(guide.recipes?.length).toBeGreaterThan(0);
    for (const r of guide.recipes ?? []) expect(r.markup, r.name).not.toContain('{{aied:');
    expect((guide.recipes ?? []).some((r) => r.markup.includes('picsum.photos/seed/'))).toBe(true);
  });
});

describe('pipeline-owned IMAGE_GUIDE_MARKDOWN', () => {
  it('teaches remote keyless sources and nothing plugin-specific', () => {
    expect(IMAGE_GUIDE_MARKDOWN).toContain('Divi 5 Image Intelligence Guide');
    for (const host of ['loremflickr.com', 'picsum.photos/seed/', 'randomuser.me', 'i.pravatar.cc']) {
      expect(IMAGE_GUIDE_MARKDOWN).toContain(host);
    }
    for (const banned of ['{{aied:', 'list_media_images', 'get_image_guide', 'get_style_guide', 'get_landing_guide', 'find_image', 'premium', 'Premium']) {
      expect(IMAGE_GUIDE_MARKDOWN, banned).not.toContain(banned);
    }
    expect(IMAGE_GUIDE_MARKDOWN).toMatch(/self-contained/i);
  });
});

describe('resolveRecipeImageTokens', () => {
  const manifest = { images: [{ token: 'hero-blue-1', width: 1600, height: 900 }, { token: 'avatar-1', width: 400, height: 400 }] };

  it('resolves a known token to picsum/seed/<token>/<w>/<h> using the manifest dimensions', () => {
    expect(resolveRecipeImageTokens('src="{{aied:image:hero-blue-1}}"', manifest)).toBe(
      'src="https://picsum.photos/seed/hero-blue-1/1600/900"',
    );
  });

  it('resolves an unknown token with the 1200x800 fallback', () => {
    expect(resolveRecipeImageTokens('{{aied:image:nope-9}}', manifest)).toBe('https://picsum.photos/seed/nope-9/1200/800');
  });

  it('falls back to 1200x800 for every token when the manifest is missing', () => {
    expect(resolveRecipeImageTokens('{{aied:image:hero-blue-1}}', undefined)).toBe(
      'https://picsum.photos/seed/hero-blue-1/1200/800',
    );
  });

  it('leaves markup without tokens untouched', () => {
    const m = '<!-- wp:divi/text {"a":"https://picsum.photos/seed/x/1/1"} /-->';
    expect(resolveRecipeImageTokens(m, manifest)).toBe(m);
  });

  it('resolves multiple tokens, including repeats', () => {
    const out = resolveRecipeImageTokens('{{aied:image:avatar-1}} {{aied:image:hero-blue-1}} {{aied:image:avatar-1}}', manifest);
    expect(out).toBe(
      'https://picsum.photos/seed/avatar-1/400/400 https://picsum.photos/seed/hero-blue-1/1600/900 https://picsum.photos/seed/avatar-1/400/400',
    );
    expect(out).not.toContain('{{aied:');
  });

  it('resolves tokens inside JSON-escaped block markup and keeps it parseable', () => {
    const markup = '<!-- wp:divi/image {\\"image\\":{\\"innerContent\\":{\\"desktop\\":{\\"value\\":{\\"src\\":\\"{{aied:image:card-blue-1}}\\"}}}}} /-->';
    const out = resolveRecipeImageTokens(markup, { images: [{ token: 'card-blue-1', width: 1200, height: 900 }] });
    expect(out).toContain('\\"src\\":\\"https://picsum.photos/seed/card-blue-1/1200/900\\"');
    expect(out).not.toContain('{{aied:');
  });
});

describe('loadGrounding recipes + fixtures against a fixture validator dir', () => {
  it('resolves tokens in every recipe markup using wp-plugin/assets/images/manifest.json', () => {
    const dir = makeFixtureValidatorDir();
    try {
      mkdirSync(join(dir, 'wp-plugin', 'assets', 'images'), { recursive: true });
      writeFileSync(
        join(dir, 'wp-plugin', 'assets', 'images', 'manifest.json'),
        JSON.stringify({ fallback: 'x', images: [{ token: 'hero-blue-1', width: 1600, height: 900 }] }),
      );
      writeFileSync(
        join(dir, 'wp-plugin', 'data', 'section-recipes.json'),
        JSON.stringify([{ name: 'a', title: 'A', description: 'd', when: 'w', markup: 'x {{aied:image:hero-blue-1}} y {{aied:image:other}}' }]),
      );
      const guide = loadGrounding(dir);
      expect(guide.recipes?.[0].markup).toBe(
        'x https://picsum.photos/seed/hero-blue-1/1600/900 y https://picsum.photos/seed/other/1200/800',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('still resolves tokens (default dims) when the manifest file is absent or corrupt', () => {
    const dir = makeFixtureValidatorDir();
    try {
      writeFileSync(
        join(dir, 'wp-plugin', 'data', 'section-recipes.json'),
        JSON.stringify([{ name: 'a', title: 'A', description: 'd', when: 'w', markup: '{{aied:image:hero-blue-1}}' }]),
      );
      expect(loadGrounding(dir).recipes?.[0].markup).toBe('https://picsum.photos/seed/hero-blue-1/1200/800');
      mkdirSync(join(dir, 'wp-plugin', 'assets', 'images'), { recursive: true });
      writeFileSync(join(dir, 'wp-plugin', 'assets', 'images', 'manifest.json'), '{not json');
      expect(loadGrounding(dir).recipes?.[0].markup).toBe('https://picsum.photos/seed/hero-blue-1/1200/800');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fallback examples skip verified-* module probes and take the first two real layouts', () => {
    const dir = makeFixtureValidatorDir();
    try {
      rmSync(join(dir, 'wp-plugin', 'data', 'section-recipes.json'));
      const valid = join(dir, 'fixtures', 'valid');
      mkdirSync(valid, { recursive: true });
      for (const f of ['page-1.json', 'page-2.json', 'page-3.json', 'verified-a-column.json', 'verified-b-column.json']) {
        writeFileSync(join(valid, f), JSON.stringify({ f }));
      }
      const guide = loadGrounding(dir);
      expect(guide.recipes).toBeUndefined();
      expect(guide.examples).toEqual([JSON.stringify({ f: 'page-1.json' }), JSON.stringify({ f: 'page-2.json' })]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
