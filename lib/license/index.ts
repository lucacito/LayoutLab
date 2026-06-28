import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function readLicense(): string {
  return readFileSync(join(process.cwd(), 'lib', 'license', 'commercial-license.txt'), 'utf8');
}
