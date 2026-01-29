import { test, expect } from '@playwright/test';

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Set up authenticated state with a test board
    await page.goto('/');
  });

  test.skip('should focus search with / key', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Press / key
    await page.keyboard.press('/');

    // Search input should be focused
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeFocused();
  });

  test.skip('should open keyboard shortcuts help with ? key', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Press ? key (Shift + /)
    await page.keyboard.press('Shift+/');

    // Shortcuts modal should open
    await expect(page.getByText(/keyboard shortcuts/i)).toBeVisible();
  });

  test.skip('should close modal with Escape key', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Open shortcuts modal
    await page.keyboard.press('Shift+/');
    await expect(page.getByText(/keyboard shortcuts/i)).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Modal should close
    await expect(page.getByText(/keyboard shortcuts/i)).not.toBeVisible();
  });

  test.skip('should navigate between columns with arrow keys', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Click on board to focus it
    await page.locator('[data-board]').click();

    // Press right arrow to focus first column
    await page.keyboard.press('ArrowRight');

    // First column should have focus indicator
    const firstColumn = page.locator('[data-column]').first();
    await expect(firstColumn).toHaveAttribute('data-focused', 'true');

    // Press right arrow again
    await page.keyboard.press('ArrowRight');

    // Second column should have focus
    const secondColumn = page.locator('[data-column]').nth(1);
    await expect(secondColumn).toHaveAttribute('data-focused', 'true');
  });

  test.skip('should navigate between cards with up/down arrow keys', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Focus first column
    await page.locator('[data-column]').first().click();

    // Press down arrow to focus first card
    await page.keyboard.press('ArrowDown');

    // First card should be focused
    const firstCard = page.locator('[data-card-id]').first();
    await expect(firstCard).toHaveClass(/ring-orange-500/);

    // Press down arrow again
    await page.keyboard.press('ArrowDown');

    // Second card should be focused
    const secondCard = page.locator('[data-card-id]').nth(1);
    await expect(secondCard).toHaveClass(/ring-orange-500/);
  });

  test.skip('should open focused card with Enter key', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Focus a card
    await page.locator('[data-column]').first().click();
    await page.keyboard.press('ArrowDown');

    // Press Enter
    await page.keyboard.press('Enter');

    // Card modal should open
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test.skip('should add new card with n key', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Focus first column
    await page.locator('[data-column]').first().click();

    // Press n key
    await page.keyboard.press('n');

    // New card input should appear and be focused
    const input = page.locator('[data-column]').first().getByRole('textbox');
    await expect(input).toBeFocused();
  });

  test.skip('should edit focused card with e key', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Focus a card
    await page.locator('[data-column]').first().click();
    await page.keyboard.press('ArrowDown');

    // Press e key
    await page.keyboard.press('e');

    // Card modal should open in edit mode
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByLabel(/english title/i)).toBeFocused();
  });

  test.skip('should clear search with Escape in search input', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Open search and type
    await page.keyboard.press('/');
    await page.keyboard.type('test search');

    // Verify search has content
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toHaveValue('test search');

    // Press Escape
    await page.keyboard.press('Escape');

    // Search should be cleared and unfocused
    await expect(searchInput).toHaveValue('');
    await expect(searchInput).not.toBeFocused();
  });
});

test.describe('Focus Management', () => {
  test.skip('should trap focus in modal', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Open card modal
    await page.locator('[data-card-id]').first().click();

    // Tab through elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Focus should stay within modal
    const dialog = page.getByRole('dialog');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeAttached();
    
    // Focused element should be inside dialog
    const isInDialog = await focusedElement.evaluate((el, dialogEl) => {
      return dialogEl?.contains(el) ?? false;
    }, await dialog.elementHandle());
    
    expect(isInDialog).toBe(true);
  });

  test.skip('should return focus to trigger element on modal close', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Click on a card
    const card = page.locator('[data-card-id]').first();
    await card.click();

    // Close modal with Escape
    await page.keyboard.press('Escape');

    // Focus should return to the card
    await expect(card).toBeFocused();
  });
});
