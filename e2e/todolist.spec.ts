import { test, expect } from '@playwright/test';

test.describe('Todo List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/todolist.html');
  });

  test('should add a new task', async ({ page }) => {
    await page.fill('input[placeholder="Add new task"]', 'New Task');
    await page.click('button[data-dispatch="addTask"]');

    const item = page.locator('.todo-item').first();
    await expect(item.locator('.todo-text')).toHaveText('New Task');
    await expect(page.locator('.todo-stats')).toContainText('Total: 2');
  });

  test('should toggle task completion', async ({ page }) => {
    const firstItem = page.locator('.todo-item').first();
    const checkbox = firstItem.locator('.todo-checkbox');
    
    await expect(firstItem).not.toHaveClass(/done/);
    await checkbox.click();
    await expect(firstItem).toHaveClass(/done/);
    await expect(page.locator('.todo-stats')).toContainText('Done: 1');
    
    await checkbox.click();
    await expect(firstItem).not.toHaveClass(/done/);
    await expect(page.locator('.todo-stats')).toContainText('Done: 0');
  });

  test('should remove a task', async ({ page }) => {
    const items = page.locator('.todo-item');
    await expect(items).toHaveCount(1);
    
    await page.click('.todo-remove');
    await expect(items).toHaveCount(0);
    await expect(page.locator('.todo-empty')).toBeVisible();
  });
});
