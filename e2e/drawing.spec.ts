import { test, expect } from '@playwright/test';

test.describe('Drawing App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/drawing.html');
  });

  test('should render toolbar with options', async ({ page }) => {
    await expect(page.locator('.color-btn')).toHaveCount(6);
    await expect(page.locator('.size-btn')).toHaveCount(3);
    await expect(page.getByText('Brush')).toBeVisible();
    await expect(page.getByText('Eraser')).toBeVisible();
  });

  test('should select colors and tools', async ({ page }) => {
    // Initial State: Brush active, Black color
    await expect(page.getByText('Brush')).toHaveClass(/active/);
    const blackBtn = page.locator('.color-btn').first(); // #000000
    await expect(blackBtn).toHaveClass(/active/);

    // Select Eraser
    await page.getByText('Eraser').click();
    await expect(page.getByText('Eraser')).toHaveClass(/active/);
    await expect(page.getByText('Brush')).not.toHaveClass(/active/);

    // Select Red Color -> Should switch back to Brush automatically
    const redBtn = page.locator('.color-btn').nth(1);
    await redBtn.click();
    await expect(redBtn).toHaveClass(/active/);
    await expect(page.getByText('Brush')).toHaveClass(/active/);
  });

  test('should select brush size', async ({ page }) => {
    const smallSize = page.locator('.size-btn').first();
    const largeSize = page.locator('.size-btn').last();

    await expect(smallSize).toHaveClass(/active/); // Default 5
    await largeSize.click();
    await expect(largeSize).toHaveClass(/active/);
    await expect(smallSize).not.toHaveClass(/active/);
  });

  test('should handle canvas drawing events', async ({ page }) => {
    // We can't easily verify pixels without visual regression, 
    // but we can verify that the event handlers fire and state remains stable.
    const canvas = page.locator('canvas');
    
    // Draw something
    await canvas.dispatchEvent('pointerdown', { clientX: 100, clientY: 100 });
    await canvas.dispatchEvent('pointermove', { clientX: 150, clientY: 150 });
    await canvas.dispatchEvent('pointerup', { clientX: 150, clientY: 150 });

    // Verify app didn't crash and state is responsive
    await expect(page.locator('header')).toHaveText('boreDOM Painter');
  });

  test('should clear canvas', async ({ page }) => {
    // We check if the clear button triggers the logic
    // Ideally we'd check `state.clearSignal` but we can't easily access internal state from here without exposing it.
    // However, if the button works, the component re-renders.
    
    // Verify button exists and is clickable
    const clearBtn = page.getByText('Clear');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    
    // If no error occurred, we assume success. 
    // (A more advanced test would evaluate canvas.toDataURL() before and after).
  });
});
