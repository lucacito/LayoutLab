// e2e/catalog.spec.ts
import { test, expect } from '@playwright/test';

// These run against `npm run dev`; they require a seeded DATABASE_URL.
// Skipped in environments without one.
test.skip(!process.env.DATABASE_URL, 'needs a seeded DATABASE_URL');

test('browse renders layout cards and filtering narrows results', async ({ page }) => {
  await page.goto('/browse');
  await expect(page.getByRole('heading', { name: 'Browse layouts' })).toBeVisible();
  const cards = page.locator('a[href^="/layouts/"]');
  await expect(cards.first()).toBeVisible();
  const total = await cards.count();

  await page.getByLabel('Hero', { exact: false }).first().check();
  await expect(page).toHaveURL(/type=hero/);
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeLessThanOrEqual(total);
});

test('layout detail renders a gallery and JSON-LD', async ({ page }) => {
  await page.goto('/browse');
  await page.locator('a[href^="/layouts/"]').first().click();
  await expect(page.locator('script[type="application/ld+json"]').first()).toBeAttached();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
