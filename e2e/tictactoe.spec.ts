import { test, expect } from '@playwright/test';

test.describe('Tic Tac Toe', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tictactoe.html');
  });

  test('should verify initial state', async ({ page }) => {
    await expect(page.locator('.game-status')).toContainText('Next player: O');
    const buttons = page.locator('.game-grid .game-button');
    await expect(buttons).toHaveCount(9);
    for (let i = 0; i < 9; i++) {
        await expect(buttons.nth(i)).toBeEmpty();
    }
  });

  test('should play a game and declare winner', async ({ page }) => {
    const buttons = page.locator('.game-grid .game-button');

    // O plays 0
    await buttons.nth(0).click();
    await expect(buttons.nth(0)).toHaveText('O');
    await expect(page.locator('.game-status')).toContainText('Next player: X');

    // X plays 3
    await buttons.nth(3).click();
    await expect(buttons.nth(3)).toHaveText('X');
    await expect(page.locator('.game-status')).toContainText('Next player: O');

    // O plays 1
    await buttons.nth(1).click();
    // X plays 4
    await buttons.nth(4).click();
    // O plays 2 -> Win
    await buttons.nth(2).click();

    await expect(page.locator('.game-status')).toContainText('Victory for Player O');
  });

  test('should reset the game', async ({ page }) => {
    const buttons = page.locator('.game-grid .game-button');
    await buttons.nth(0).click();
    await expect(buttons.nth(0)).toHaveText('O');

    await page.click('button[data-dispatch="reset"]');
    
    await expect(buttons.nth(0)).toBeEmpty();
    await expect(page.locator('.game-status')).toContainText('Next player: O');
  });

  test('should cache expression compilation across mapped list updates', async ({ page }) => {
    await page.addInitScript(() => {
      const OriginalFunction = Function;
      let compileCount = 0;

      function CountedFunction(...args) {
        compileCount += 1;
        return OriginalFunction(...args);
      }

      Object.setPrototypeOf(CountedFunction, OriginalFunction);
      CountedFunction.prototype = OriginalFunction.prototype;

      window.__getCompileCount__ = () => compileCount;
      // @ts-ignore
      window.Function = CountedFunction;
    });

    await page.goto('/tictactoe.html');

    const buttons = page.locator('.game-grid .game-button');
    const status = page.locator('.game-status');

    await buttons.nth(0).click();
    await expect(buttons.nth(0)).toHaveText('O');
    await expect(status).toContainText('Next player: X');

    const warmedCount = await page.evaluate(() => window.__getCompileCount__());

    const rounds = [
      [3, 1, 4, 2],
      [0, 3, 1, 4, 2],
      [0, 3, 1, 4, 2],
    ];

    for (const moves of rounds) {
      for (const move of moves) {
        await buttons.nth(move).click();
      }
      await expect(status).toContainText('Victory for Player O');
      await page.click('button[data-dispatch="reset"]');
      await expect(status).toContainText('Next player: O');
    }

    const finalCount = await page.evaluate(() => window.__getCompileCount__());
    expect(finalCount).toBe(warmedCount);
  });
});
