import { test, expect } from '@playwright/test';

test.describe('Action Scope', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/action-scope.html');
  });

  test('should keep action handlers scoped to their component', async ({ page }) => {
    const rows = page.locator('.row');
    await expect(rows).toHaveCount(2);

    const countA = rows.nth(0).locator('.count');
    const countB = rows.nth(1).locator('.count');

    await expect(countA).toHaveText('0');
    await expect(countB).toHaveText('0');

    await rows.nth(0).getByText('Ping A').click();
    await expect(countA).toHaveText('1');
    await expect(countB).toHaveText('0');

    await rows.nth(1).getByText('Ping B').click();
    await expect(countA).toHaveText('1');
    await expect(countB).toHaveText('1');
  });
});
