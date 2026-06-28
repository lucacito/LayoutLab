// tests/pipeline-validate-integration.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateLayout } from '@/pipeline/validate';

const VALIDATOR_DIR = join(process.cwd(), '..', 'Divi 5 Deterministic Validator');
const hasValidator = existsSync(join(VALIDATOR_DIR, 'scripts', 'validate.php'));
const cmd = `php "${join(VALIDATOR_DIR, 'scripts', 'validate.php')}"`;

describe.skipIf(!hasValidator)('validateLayout against the real validator', () => {
  it('PASSes a known-good fixture', async () => {
    const dir = join(VALIDATOR_DIR, 'fixtures', 'valid');
    const { readdirSync } = await import('node:fs');
    const file = join(dir, readdirSync(dir).find((f) => f.endsWith('.json'))!);
    const r = await validateLayout(file, { validatorCmd: cmd });
    expect(r.valid).toBe(true);
  });

  it('FAILs a known-bad fixture with violation codes', async () => {
    const dir = join(VALIDATOR_DIR, 'fixtures', 'invalid');
    const { readdirSync } = await import('node:fs');
    const file = join(dir, readdirSync(dir).find((f) => f.endsWith('.json'))!);
    const r = await validateLayout(file, { validatorCmd: cmd });
    expect(r.valid).toBe(false);
    expect(r.violations.length).toBeGreaterThan(0);
    expect(r.violations[0].code).toMatch(/^[A-Z0-9_]+$/);
  });
});
