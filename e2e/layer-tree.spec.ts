import { test, expect } from '@playwright/test';

const multiSelectModifier = process.platform === 'darwin' ? 'Meta' : 'Control';
const getOpacity = async (locator) =>
  locator.evaluate((el) => Number.parseFloat(getComputedStyle(el).opacity));
const expectOpacityBetween = async (locator, min, max) => {
  await expect.poll(async () => getOpacity(locator)).toBeGreaterThan(min);
  await expect.poll(async () => getOpacity(locator)).toBeLessThan(max);
};

test.describe('UI Layer Tree', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the test fixture served by src/serve.js
    await page.goto('/layer-tree-demo.html');
    // Wait for hydration
    await page.waitForSelector('ui-layer-tree .tree-item');
  });

  test('renders the tree structure', async ({ page }) => {
    // Check root items
    const header = page.getByText('Header', { exact: true });
    const hero = page.getByText('Hero Section');
    
    await expect(header).toBeVisible();
    await expect(hero).toBeVisible();
    
    // Check initial expansion (Header should be expanded)
    const logo = page.getByText('Logo');
    await expect(logo).toBeVisible();
    
    // Check collapsed item (Footer should be visible, but it has no children so expansion doesn't apply)
    // Check 'Background' -> 'Image' should NOT be visible initially (not in expandedIds list in HTML)
    // Wait, in HTML expandedIds = ['1', '1-2']. '4' (Background) is not expanded.
    const image = page.getByText('Image');
    await expect(image).not.toBeVisible();
  });

  test('expands and collapses nodes', async ({ page }) => {
    // Header (id=1) is expanded. Logo is visible.
    const headerToggle = page.locator('.tree-item', { hasText: 'Header' }).locator('.toggle-btn');
    await headerToggle.click();
    
    // Now Logo should be hidden
    const logo = page.getByText('Logo');
    await expect(logo).not.toBeVisible();
    
    // Expand again
    await headerToggle.click();
    await expect(logo).toBeVisible();
  });

  test('selects items', async ({ page }) => {
    const headerRow = page.locator('.tree-item', { hasText: 'Header' });
    const logoRow = page.locator('.tree-item', { hasText: 'Logo' });
    
    // Initial state: not selected
    await expect(headerRow).not.toHaveClass(/selected/);
    
    // Click to select
    await headerRow.click();
    await expect(headerRow).toHaveClass(/selected/);
    await expect(logoRow).toHaveClass(/selected-faint/);
    
    // Verify event log
    const log = page.locator('#debug-log');
    await expect(log).toContainText('"1"');
    await expect(log).toContainText('"1-1"');
  });

  test('multi-selects items', async ({ page }) => {
    const headerRow = page.locator('.tree-item', { hasText: 'Header' });
    const heroRow = page.locator('.tree-item', { hasText: 'Hero Section' });
    const logoRow = page.locator('.tree-item', { hasText: 'Logo' });
    
    await headerRow.click();
    await page.keyboard.down(multiSelectModifier);
    await heroRow.click();
    await page.keyboard.up(multiSelectModifier);
    
    await expect(headerRow).toHaveClass(/selected/);
    await expect(heroRow).toHaveClass(/selected/);
    await expect(logoRow).toHaveClass(/selected-faint/);
    
    const log = page.locator('#debug-log');
    await expect(log).toContainText('"2"');
    await expect(log).toContainText('"1-2-1"');
  });

  test('selecting a group selects descendants as faint inherited selection', async ({ page }) => {
    const headerRow = page.locator('.tree-item', { hasText: 'Header' });
    const logoRow = page.locator('.tree-item', { hasText: 'Logo' });
    const navRow = page.locator('.tree-item', { hasText: 'Nav' });

    await headerRow.click();

    await expect(headerRow).toHaveClass(/selected/);
    await expect(logoRow).toHaveClass(/selected-faint/);
    await expect(navRow).toHaveClass(/selected-faint/);
  });

  test('renames inline on double click', async ({ page }) => {
    const headerRow = page.locator('.tree-item', { hasText: 'Header' });
    const headerLabel = headerRow.locator('.label');

    await headerLabel.dblclick();

    const input = headerRow.locator('.label-input');
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();
    await input.type('T');
    await expect(input).toBeFocused();
    await input.type('op Header');
    await expect(input).toHaveValue('Top Header');
    await input.press('Enter');

    await expect(page.getByText('Top Header', { exact: true })).toBeVisible();
    const log = page.locator('#debug-log');
    await expect(log).toContainText('Rename: 1 -> Top Header');
  });

  test('shows only active status icon when row is not hovered', async ({ page }) => {
    await page.locator('h2').first().hover();

    const headerRow = page.locator('.tree-item', { hasText: 'Header' });
    const heroRow = page.locator('.tree-item', { hasText: 'Hero Section' });
    const footerRow = page.locator('.tree-item', { hasText: 'Footer' });

    const headerLockBtn = headerRow.locator('.action-btn').nth(0);
    const headerVisBtn = headerRow.locator('.action-btn').nth(1);
    const heroLockBtn = heroRow.locator('.action-btn').nth(0);
    const heroVisBtn = heroRow.locator('.action-btn').nth(1);
    const footerLockBtn = footerRow.locator('.action-btn').nth(0);
    const footerVisBtn = footerRow.locator('.action-btn').nth(1);

    await expectOpacityBetween(headerLockBtn, -0.01, 0.1);
    await expectOpacityBetween(headerVisBtn, -0.01, 0.1);
    await expectOpacityBetween(heroLockBtn, -0.01, 0.1);
    await expectOpacityBetween(heroVisBtn, 0.85, 1.01);
    await expectOpacityBetween(footerLockBtn, 0.85, 1.01);
    await expectOpacityBetween(footerVisBtn, -0.01, 0.1);
  });

  test('keeps active icon emphasis while row is hovered', async ({ page }) => {
    const heroRow = page.locator('.tree-item', { hasText: 'Hero Section' });
    const footerRow = page.locator('.tree-item', { hasText: 'Footer' });

    const heroLockBtn = heroRow.locator('.action-btn').nth(0);
    const heroVisBtn = heroRow.locator('.action-btn').nth(1);
    const footerLockBtn = footerRow.locator('.action-btn').nth(0);
    const footerVisBtn = footerRow.locator('.action-btn').nth(1);

    await heroRow.hover();
    await expectOpacityBetween(heroVisBtn, 0.85, 1.01);
    await expectOpacityBetween(heroLockBtn, 0.2, 0.7);

    await footerRow.hover();
    await expectOpacityBetween(footerLockBtn, 0.85, 1.01);
    await expectOpacityBetween(footerVisBtn, 0.2, 0.7);
  });

  test('renders hidden layer content faint while keeping eye icon emphasized', async ({ page }) => {
    await page.locator('h2').first().hover();

    const heroRow = page.locator('.tree-item', { hasText: 'Hero Section' });
    const heroTypeIcon = heroRow.locator('.type-icon');
    const heroLabel = heroRow.locator('.label');
    const heroVisBtn = heroRow.locator('.action-btn').nth(1);

    await expectOpacityBetween(heroTypeIcon, 0.35, 0.55);
    await expectOpacityBetween(heroLabel, 0.35, 0.55);
    await expectOpacityBetween(heroVisBtn, 0.85, 1.01);
  });

  test('shows chevrons only when the panel is hovered', async ({ page }) => {
    const tree = page.locator('ui-layer-tree');
    const headerToggle = page.locator('.tree-item', { hasText: 'Header' }).locator('.toggle-btn');

    await page.locator('h2').first().hover();
    await expectOpacityBetween(headerToggle, -0.01, 0.1);

    await tree.hover();
    await expectOpacityBetween(headerToggle, 0.2, 0.8);

    await headerToggle.hover();
    await expectOpacityBetween(headerToggle, 0.85, 1.01);
  });

  test('top-right toggle expands and collapses all groups', async ({ page }) => {
    const toggleAll = page.locator('.expand-all-btn');
    const logo = page.getByText('Logo', { exact: true });
    const image = page.getByText('Image', { exact: true });

    await expect(logo).toBeVisible();
    await expect(image).not.toBeVisible();

    await toggleAll.click();
    await expect(image).toBeVisible();
    await expect(toggleAll).toHaveAttribute('title', 'Collapse all layers');

    await toggleAll.click();
    await expect(logo).not.toBeVisible();
    await expect(image).not.toBeVisible();
    await expect(toggleAll).toHaveAttribute('title', 'Expand all layers');
  });

  test('toggles visibility and lock', async ({ page }) => {
    const heroRow = page.locator('.tree-item', { hasText: 'Hero Section' });
    
    // Hover to see actions (Playwright might not need hover to click if forced, but let's hover)
    await heroRow.hover();
    
    // Hero is initially hidden (isVisible: false)
    // Find visibility button (second action button)
    // In our template, visibility is the 2nd button.
    // Button class 'action-btn'.
    const visBtn = heroRow.locator('.action-btn').nth(1);
    
    // Click to toggle
    await visBtn.click();
    
    // Check log for update event
    const log = page.locator('#debug-log');
    await expect(log).toContainText('"id":"2"');
    await expect(log).toContainText('"visible":"toggle"');
  });
});
