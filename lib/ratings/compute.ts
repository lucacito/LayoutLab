// Pure rating math — safe to import in client components (no db).
export function clampStars(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(1, Math.min(5, v));
}

export function ratingAverage(sum: number, count: number): number {
  return count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
}
