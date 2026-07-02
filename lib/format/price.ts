// Format a price in cents as USD: whole dollars show without decimals ($49),
// sub-dollar or non-round amounts show cents ($0.25, $12.50).
export function formatPriceCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}
