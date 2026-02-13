import { test, expect } from '@playwright/test';

test.describe('List Stability Lab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/list-stability.html');
  });

  test('should keep pad nodes stable under high-frequency updates', async ({ page }) => {
    await page.getByText('Start ticker').click();

    await page.waitForFunction(() => {
      // Use boreDOM query helper.
      const el = window.__BOREDOM__.query('[data-ref="updateCount"]');
      if (!el) return false;
      const value = Number(el.textContent || 0);
      return value >= 5;
    });

    await expect(page.locator('[data-ref="rebuildCount"]')).toHaveText('0');
    await expect(page.locator('[data-ref="stableFlag"]')).toHaveText('yes');
  });

  test('should keep clicks responsive while ticker runs', async ({ page }) => {
    await page.getByText('Start ticker').click();

    const clickCount = page.locator('[data-text="local.clicks"]');
    await expect(clickCount).toHaveText('0');

    await page.locator('.pad').first().click();
    await expect(clickCount).toHaveText('1');
    await expect(page.locator('[data-text="local.lastPad"]')).not.toHaveText('-');
  });
});
