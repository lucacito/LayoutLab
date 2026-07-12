import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const prods = await stripe.products.list({ limit: 100, active: true });
for (const p of prods.data) {
  console.log(p.id, '|', p.name, '| slug:', p.metadata?.slug ?? '-', '| packId:', p.metadata?.packId ?? '-');
}
