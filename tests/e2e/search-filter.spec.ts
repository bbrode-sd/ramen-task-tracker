import { test, expect } from '@playwright/test';

test.describe('Search and Filter', () => {
  test.beforeEach(async ({ page }) => {
    // TODO: Set up authenticated state with a test board containing cards
    await page.goto('/');
  });

  test.skip('should filter cards by search query', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Open search
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.click();
    await searchInput.fill('bug');

    // Only matching cards should be visible
    await expect(page.locator('[data-card-id]')).toHaveCount(1);
    await expect(page.getByText(/fix bug/i)).toBeVisible();

    // Non-matching cards should be hidden or dimmed
    await expect(page.getByText(/grocery/i)).not.toBeVisible();
  });

  test.skip('should search in both English and Japanese text', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Search in Japanese
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('バグ'); // "bug" in Japanese

    // Should find cards with Japanese text matching
    await expect(page.locator('[data-card-id]')).toHaveCount(1);
  });

  test.skip('should highlight matching text in cards', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Search for a term
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('test');

    // Matching text should be highlighted
    await expect(page.locator('mark')).toBeVisible();
  });

  test.skip('should show match count', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Search for a term
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('task');

    // Should show match count
    await expect(page.getByText(/\d+ match(es)?/i)).toBeVisible();
  });

  test.skip('should clear search', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Enter search query
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('test');

    // Click clear button
    await page.getByRole('button', { name: /clear/i }).click();

    // Search should be cleared
    await expect(searchInput).toHaveValue('');

    // All cards should be visible
    await expect(page.locator('[data-card-id]')).toHaveCount(10); // Assuming 10 cards
  });

  test.skip('should filter by label', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Open label filter
    await page.getByRole('button', { name: /filter/i }).click();

    // Select a label
    await page.getByText('Bug').click();

    // Only cards with Bug label should be visible
    const cards = page.locator('[data-card-id]');
    for (const card of await cards.all()) {
      await expect(card.getByText('Bug')).toBeVisible();
    }
  });

  test.skip('should filter by multiple labels (OR logic)', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Open label filter
    await page.getByRole('button', { name: /filter/i }).click();

    // Select multiple labels
    await page.getByText('Bug').click();
    await page.getByText('Feature').click();

    // Cards with either Bug or Feature should be visible
    const cards = page.locator('[data-card-id]');
    await expect(cards).toHaveCount(5); // Assuming 5 cards have Bug or Feature
  });

  test.skip('should filter "My Cards"', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Toggle "My Cards" filter
    await page.getByRole('button', { name: /my cards/i }).click();

    // Only cards created by or assigned to current user should be visible
    // This requires knowing the test user's cards
    await expect(page.locator('[data-card-id]')).toHaveCount(3);
  });

  test.skip('should combine search and label filters', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Enter search query
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('api');

    // Also filter by label
    await page.getByRole('button', { name: /filter/i }).click();
    await page.getByText('Backend').click();

    // Only cards matching both should be visible
    await expect(page.locator('[data-card-id]')).toHaveCount(1);
  });

  test.skip('should show empty state when no cards match', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Search for non-existent term
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('xyznonexistent123');

    // Should show empty state
    await expect(page.getByText(/no.*match/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /clear/i })).toBeVisible();
  });

  test.skip('should show active filter indicators', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Apply filters
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('test');

    await page.getByRole('button', { name: /filter/i }).click();
    await page.getByText('Bug').click();

    // Should show filter badge or indicator
    await expect(page.getByText(/filters active/i)).toBeVisible();
  });

  test.skip('should clear all filters at once', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Apply multiple filters
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('test');

    await page.getByRole('button', { name: /filter/i }).click();
    await page.getByText('Bug').click();

    await page.getByRole('button', { name: /my cards/i }).click();

    // Clear all filters
    await page.getByRole('button', { name: /clear.*filters/i }).click();

    // All filters should be cleared
    await expect(searchInput).toHaveValue('');
    await expect(page.getByText(/filters active/i)).not.toBeVisible();
  });
});
