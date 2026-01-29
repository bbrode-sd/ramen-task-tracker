import { test, expect } from '@playwright/test';

test.describe('Offline Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Set up authenticated state
    await page.goto('/');
  });

  test.skip('should show offline indicator when network is disconnected', async ({ page, context }) => {
    await page.goto('/boards/test-board-id');

    // Go offline
    await context.setOffline(true);

    // Offline indicator should appear
    await expect(page.getByText(/you.*offline/i)).toBeVisible();
  });

  test.skip('should hide offline indicator when network is restored', async ({ page, context }) => {
    await page.goto('/boards/test-board-id');

    // Go offline
    await context.setOffline(true);
    await expect(page.getByText(/you.*offline/i)).toBeVisible();

    // Go back online
    await context.setOffline(false);

    // Offline indicator should disappear
    await expect(page.getByText(/you.*offline/i)).not.toBeVisible();
  });

  test.skip('should allow creating cards while offline', async ({ page, context }) => {
    await page.goto('/boards/test-board-id');

    // Go offline
    await context.setOffline(true);

    // Create a new card
    const column = page.locator('[data-column]').first();
    await column.getByRole('button', { name: /add.*card/i }).click();
    await column.getByRole('textbox').fill('Offline card');
    await page.keyboard.press('Enter');

    // Card should appear locally
    await expect(column.getByText('Offline card')).toBeVisible();

    // Should show pending sync indicator
    await expect(page.getByText(/pending/i)).toBeVisible();
  });

  test.skip('should allow editing cards while offline', async ({ page, context }) => {
    await page.goto('/boards/test-board-id');

    // Go offline
    await context.setOffline(true);

    // Open a card
    await page.locator('[data-card-id]').first().click();

    // Edit the title
    const titleInput = page.getByLabel(/english title/i);
    await titleInput.fill('Edited offline');
    await titleInput.blur();

    // Change should be visible
    await expect(page.getByText('Edited offline')).toBeVisible();
  });

  test.skip('should sync pending changes when back online', async ({ page, context }) => {
    await page.goto('/boards/test-board-id');

    // Go offline
    await context.setOffline(true);

    // Create a card offline
    const column = page.locator('[data-column]').first();
    await column.getByRole('button', { name: /add.*card/i }).click();
    await column.getByRole('textbox').fill('Will sync later');
    await page.keyboard.press('Enter');

    // Should show pending indicator
    await expect(page.getByText(/pending/i)).toBeVisible();

    // Go back online
    await context.setOffline(false);

    // Wait for sync
    await expect(page.getByText(/synced/i)).toBeVisible({ timeout: 10000 });

    // Card should still be there
    await expect(column.getByText('Will sync later')).toBeVisible();
  });

  test.skip('should queue multiple operations while offline', async ({ page, context }) => {
    await page.goto('/boards/test-board-id');

    // Go offline
    await context.setOffline(true);

    // Perform multiple operations
    const column = page.locator('[data-column]').first();
    
    // Create card 1
    await column.getByRole('button', { name: /add.*card/i }).click();
    await column.getByRole('textbox').fill('Offline card 1');
    await page.keyboard.press('Enter');

    // Create card 2
    await column.getByRole('button', { name: /add.*card/i }).click();
    await column.getByRole('textbox').fill('Offline card 2');
    await page.keyboard.press('Enter');

    // Should show pending count
    await expect(page.getByText(/2.*pending/i)).toBeVisible();
  });

  test.skip('should persist offline changes across page reload', async ({ page, context }) => {
    await page.goto('/boards/test-board-id');

    // Go offline
    await context.setOffline(true);

    // Create a card
    const column = page.locator('[data-column]').first();
    await column.getByRole('button', { name: /add.*card/i }).click();
    await column.getByRole('textbox').fill('Persisted offline');
    await page.keyboard.press('Enter');

    // Reload page (still offline)
    await page.reload();

    // Card should still be visible
    await expect(page.getByText('Persisted offline')).toBeVisible();
  });

  test.skip('should show sync error and retry option', async ({ page, context }) => {
    await page.goto('/boards/test-board-id');

    // Create a card while online
    const column = page.locator('[data-column]').first();
    await column.getByRole('button', { name: /add.*card/i }).click();
    await column.getByRole('textbox').fill('May fail');
    
    // Go offline right before saving
    await context.setOffline(true);
    await page.keyboard.press('Enter');

    // Should show error or pending state
    await expect(page.getByText(/error|pending/i)).toBeVisible();

    // Go back online
    await context.setOffline(false);

    // Click retry if available
    const retryButton = page.getByRole('button', { name: /retry/i });
    if (await retryButton.isVisible()) {
      await retryButton.click();
    }

    // Should eventually sync
    await expect(page.getByText(/synced/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Sync Status Indicator', () => {
  test.skip('should show syncing status during save', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Open a card and edit
    await page.locator('[data-card-id]').first().click();
    
    // Edit quickly
    const titleInput = page.getByLabel(/english title/i);
    await titleInput.fill('Quick edit');
    await titleInput.blur();

    // Should briefly show syncing status
    await expect(page.getByText(/syncing/i)).toBeVisible();
  });

  test.skip('should show saved status after successful save', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Make a change
    await page.locator('[data-card-id]').first().click();
    const titleInput = page.getByLabel(/english title/i);
    await titleInput.fill('Saved successfully');
    await titleInput.blur();

    // Should show saved status
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });
  });

  test.skip('should return to idle after save completes', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Make a change
    await page.locator('[data-card-id]').first().click();
    const titleInput = page.getByLabel(/english title/i);
    await titleInput.fill('Will become idle');
    await titleInput.blur();

    // Wait for saved
    await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 });

    // Wait for idle (saved text disappears)
    await expect(page.getByText(/saved/i)).not.toBeVisible({ timeout: 10000 });
  });
});
