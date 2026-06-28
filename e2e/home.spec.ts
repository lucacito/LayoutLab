import { test, expect } from '@playwright/test';

test('home page renders the brand', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'LayoutLab' })).toBeVisible();
});
