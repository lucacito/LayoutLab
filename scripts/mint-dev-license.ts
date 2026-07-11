// Mint a license row directly (dev/support use). Usage:
//   npx tsx scripts/mint-dev-license.ts --email you@x.com --product elementor-to-divi5-pro [--years 1]
import { randomUUID } from 'node:crypto';
import { db } from '@/db/client';
import { licenses } from '@/db/schema';
import { generateLicenseKey, PLUGIN_PRODUCTS } from '@/lib/license-server/core';
import { findOrCreateUserByEmail } from '@/lib/users/find-or-create';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg('email');
  const product = arg('product');
  const years = Number(arg('years') ?? '1');
  if (!email || !product || !(PLUGIN_PRODUCTS as readonly string[]).includes(product)) {
    console.error('Usage: --email <email> --product <slug> [--years N]');
    process.exit(1);
  }
  const userId = await findOrCreateUserByEmail(email);
  const licenseKey = generateLicenseKey();
  const end = new Date();
  end.setFullYear(end.getFullYear() + years);
  await db.insert(licenses).values({
    id: randomUUID(),
    userId,
    productSlug: product,
    licenseKey,
    status: 'active',
    stripeSubscriptionId: null,
    currentPeriodEnd: end,
  });
  console.log(licenseKey);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
