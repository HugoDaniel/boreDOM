import { test, expect } from '@playwright/test';

test.describe('Bindings and Nested Lists', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/bindings-lab.html');
  });

  test('supports two-way data-value for assignable paths and warns once for non-assignable paths', async ({ page }) => {
    const warnings: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[BOREDOM:WARN]') && text.includes('data-value is not assignable')) {
        warnings.push(text);
      }
    });

    const nameInput = page.locator('[data-ref="nameInput"]');
    const invalidInput = page.locator('[data-ref="invalidInput"]');

    await expect(page.locator('[data-ref="nameEcho"]')).toHaveText('Ada');

    await nameInput.fill('Grace');
    await expect(page.locator('[data-ref="nameEcho"]')).toHaveText('Grace');

    await invalidInput.fill('No Sync');
    await expect(page.locator('[data-ref="nameEcho"]')).toHaveText('Grace');

    expect(warnings.length).toBe(1);
  });

  test('coerces number input values to Number type in state', async ({ page }) => {
    await expect(page.locator('[data-ref="numType"]')).toHaveText('number');
    await expect(page.locator('[data-ref="numCalc"]')).toHaveText('1');

    const numInput = page.locator('[data-ref="numInput"]');
    await numInput.fill('5');

    await expect(page.locator('[data-ref="numType"]')).toHaveText('number');
    await expect(page.locator('[data-ref="numCalc"]')).toHaveText('6');
  });

  test('parses class bindings with colons and supports nested alias contexts for dispatch args', async ({ page }) => {
    await expect(page.locator('bindings-lab button')).toHaveCount(4);

    const classFlags = await page.locator('[data-ref="classTarget"]').evaluate((el) => ({
      hasHoverClass: el.classList.contains('hover:bg-red-500'),
      hasActiveClass: el.classList.contains('active'),
    }));

    expect(classFlags.hasHoverClass).toBe(true);
    expect(classFlags.hasActiveClass).toBe(true);

    await page.getByRole('button', { name: '1:Noah' }).click();
    await expect(page.locator('[data-ref="selection"]')).toHaveText('Bass:Noah');
  });

  test('supports Vue-style (item, i) destructuring in data-list', async ({ page }) => {
    const buttons = page.locator('bindings-lab button');
    await expect(buttons).toHaveCount(4);

    // Verify index alias is rendered in button text (format: "i:name")
    await expect(buttons.nth(0)).toHaveText('0:Kick');
    await expect(buttons.nth(1)).toHaveText('1:Snare');
    await expect(buttons.nth(2)).toHaveText('0:Sub');
    await expect(buttons.nth(3)).toHaveText('1:Noah');
  });
});

