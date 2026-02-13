import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('boreDOM Telemetry & Debugging', () => {
  test('should update DOM on action', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../tests/debug-test.html');
    await page.goto(`file://${filePath}`);

    // Wait for hydration
    await page.waitForTimeout(500);
    
    // Trigger Action
    await page.locator('debug-component').getByText('Inc').click();
    await page.waitForTimeout(100);

    await expect(page.locator('debug-component h1')).toHaveText('Count: 1');
  });

  test('should log errors gracefully', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    const filePath = path.resolve(__dirname, '../tests/debug-test.html');
    await page.goto(`file://${filePath}`);

    await page.locator('debug-component').getByText('Error').click();
    await page.waitForTimeout(100);

    const errorLog = logs.find(l => l.includes('[BOREDOM:ERROR]'));
    expect(errorLog).toBeDefined();
    expect(JSON.parse(errorLog!.split('] ')[1])).toMatchObject({
      component: 'debug-component',
      message: 'Simulated Crash'
    });

    await page.locator('debug-component').getByText('Inc').click();
    await expect(page.locator('debug-component h1')).toHaveText('Count: 1');
  });

  test('window.__BOREDOM__ API should work', async ({ page }) => {
    const filePath = path.resolve(__dirname, '../tests/debug-test.html');
    await page.goto(`file://${filePath}`);
    await page.waitForTimeout(500);

    // Test getState
    const state = await page.evaluate(() => window.__BOREDOM__.getState());
    expect(state.count).toBe(0);

    // Test query helper
    // Note: We need to pass the query string carefully
    const hasDeepSpan = await page.evaluate(() => !!window.__BOREDOM__.query('#deep-span'));
    expect(hasDeepSpan).toBe(true);

    // Test reset
    await page.locator('debug-component').getByText('Inc').click();
    const countAfter = await page.evaluate(() => window.__BOREDOM__.getState().count);
    expect(countAfter).toBe(1);

    await page.evaluate(() => window.__BOREDOM__.reset());
    await page.waitForTimeout(100);
    
    const countReset = await page.evaluate(() => window.__BOREDOM__.getState().count);
    expect(countReset).toBe(0);
  });
});
