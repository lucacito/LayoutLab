import { test, expect } from '@playwright/test';

test('home page renders the brand and hero CTA', async ({ page }) => {
  await page.goto('/');
  // Wordmark in the header
  await expect(page.getByRole('link', { name: 'LayoutLab' })).toBeVisible();
  // Hero CTA to the catalog
  await expect(page.getByRole('link', { name: 'Browse layouts' }).first()).toBeVisible();
});
