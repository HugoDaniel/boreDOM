import { test, expect } from '@playwright/test';

test.describe('Counter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/counter.html');
  });

  test('should have initial count of 0', async ({ page }) => {
    const display = page.locator('.counter-display');
    await expect(display).toHaveText('0');
  });

  test('should increment count', async ({ page }) => {
    await page.click('button[data-dispatch="increment"]');
    const display = page.locator('.counter-display');
    await expect(display).toHaveText('1');
  });

  test('should decrement count', async ({ page }) => {
    await page.click('button[data-dispatch="decrement"]');
    const display = page.locator('.counter-display');
    await expect(display).toHaveText('-1');
  });

  test('should reset count', async ({ page }) => {
    await page.click('button[data-dispatch="increment"]');
    await page.click('button[data-dispatch="increment"]');
    await expect(page.locator('.counter-display')).toHaveText('2');

    await page.click('button[data-dispatch="reset"]');
    await expect(page.locator('.counter-display')).toHaveText('0');
  });
});
