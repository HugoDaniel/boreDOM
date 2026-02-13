import { test, expect } from '@playwright/test';

test.describe('Lifecycle Hooks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/lifecycle.html');
  });

  test('should run mount and update hooks', async ({ page }) => {
    await expect(page.locator('.mount-log')).toHaveText('mounted');
    await expect(page.locator('.update-log')).toHaveText('ready');
  });

  test('should run cleanup hook on removal', async ({ page }) => {
    const cleanupCount = page.locator('.cleanup-count');
    await expect(cleanupCount).toHaveText('0');

    await page.getByText('Toggle Widget').click();
    await expect(cleanupCount).toHaveText('1');

    await page.getByText('Toggle Widget').click();
    await expect(page.locator('.mount-log')).toHaveText('mounted');
    await expect(page.locator('.update-log')).toHaveText('ready');
  });
});
