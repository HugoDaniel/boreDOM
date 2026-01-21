import { test, expect } from '@playwright/test';

test.describe('Tic Tac Toe', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tictactoe.html');
  });

  test('should verify initial state', async ({ page }) => {
    await expect(page.locator('.game-status')).toContainText('Next player: O');
    const buttons = page.locator('game-button button');
    await expect(buttons).toHaveCount(9);
    for (let i = 0; i < 9; i++) {
        await expect(buttons.nth(i)).toBeEmpty();
    }
  });

  test('should play a game and declare winner', async ({ page }) => {
    const buttons = page.locator('game-button button');

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
    const buttons = page.locator('game-button button');
    await buttons.nth(0).click();
    await expect(buttons.nth(0)).toHaveText('O');

    await page.click('button[data-dispatch="reset"]');
    
    await expect(buttons.nth(0)).toBeEmpty();
    await expect(page.locator('.game-status')).toContainText('Next player: O');
  });
});
