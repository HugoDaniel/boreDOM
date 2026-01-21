import { test, expect } from '@playwright/test';

test.describe('Style System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/palette-test.html');
  });

  test('should inherit global CSS variables', async ({ page }) => {
    const card = page.locator('display-card .card');
    await expect(card).toHaveCSS('background-color', 'rgb(59, 130, 246)');
  });

  test('should react to global theme changes and update computed values', async ({ page }) => {
    // Initial state (Light Mode)
    // #3b82f6 -> rgb(59, 130, 246) - spaces might vary
    await expect(page.locator('theme-switcher .debug strong')).toContainText('#3b82f6');

    // Switch to Dark Mode
    await page.locator('theme-switcher button').filter({ hasText: 'Dark' }).click();

    // Check CSS update
    const card = page.locator('display-card .card');
    await expect(card).toHaveCSS('background-color', 'rgb(239, 68, 68)');

    // Check text update (computed value reflection)
    // #ef4444
    await expect(page.locator('theme-switcher .debug strong')).toContainText('#ef4444');
    await expect(page.locator('display-card code[data-text]')).toContainText('#ef4444');
  });

  test('should strictly isolate component styles', async ({ page }) => {
    const switcherBtn = page.locator('theme-switcher button').first();
    await expect(switcherBtn).toHaveCSS('border-top-width', '3px');
    await expect(switcherBtn).toHaveCSS('border-top-color', 'rgb(0, 128, 0)');

    const cardBtn = page.locator('display-card button');
    await expect(cardBtn).toHaveCSS('border-top-width', '0px');
  });
});