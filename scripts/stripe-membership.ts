// Create the all-access membership Product + monthly/yearly recurring Prices.
// Idempotent: reuses an existing product tagged metadata.membership=all-access.
//
//   set -a && . ./.env.local && set +a
//   MEMBERSHIP_MONTHLY_CENTS=800 MEMBERSHIP_YEARLY_CENTS=8000 npm run stripe:membership
//
// Then set the printed STRIPE_PRICE_MEMBERSHIP_MONTHLY / _YEARLY in your env.
import { stripe } from '@/lib/stripe/client';

const monthlyCents = Number(process.env.MEMBERSHIP_MONTHLY_CENTS ?? '800');
const yearlyCents = Number(process.env.MEMBERSHIP_YEARLY_CENTS ?? '8000');

async function findOrCreateProduct(): Promise<string> {
  const existing = await stripe.products.search({ query: "metadata['membership']:'all-access'" }).catch(() => null);
  if (existing && existing.data[0]) {
    console.log(`reusing product ${existing.data[0].id}`);
    return existing.data[0].id;
  }
  const product = await stripe.products.create({
    name: 'Divi5Lab All-Access',
    description: 'Unlimited downloads of the entire Divi 5 layout library while active.',
    metadata: { membership: 'all-access' },
  });
  console.log(`created product ${product.id}`);
  return product.id;
}

async function main() {
  const product = await findOrCreateProduct();
  const monthly = await stripe.prices.create({
    product, currency: 'usd', unit_amount: monthlyCents, recurring: { interval: 'month' }, nickname: 'Membership monthly',
  });
  const yearly = await stripe.prices.create({
    product, currency: 'usd', unit_amount: yearlyCents, recurring: { interval: 'year' }, nickname: 'Membership yearly',
  });
  console.log('\nSet these in your env (.env.local and Vercel):');
  console.log(`STRIPE_PRICE_MEMBERSHIP_MONTHLY=${monthly.id}`);
  console.log(`STRIPE_PRICE_MEMBERSHIP_YEARLY=${yearly.id}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
