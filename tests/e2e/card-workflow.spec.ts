import { test, expect } from '@playwright/test';

test.describe('Card Workflow', () => {
  // These tests require a board to exist with columns
  // In a real setup, use fixtures or Firebase emulators

  test.beforeEach(async ({ page }) => {
    // TODO: Set up authenticated state with a test board
    await page.goto('/');
  });

  test.skip('should create a new card', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Find the first column
    const column = page.locator('[data-column]').first();

    // Click add card button
    await column.getByRole('button', { name: /add.*card/i }).click();

    // Type card title
    const input = column.getByRole('textbox');
    await input.fill('New test card');
    await input.press('Enter');

    // Card should appear in the column
    await expect(column.getByText('New test card')).toBeVisible();
  });

  test.skip('should open card modal on click', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Click on a card
    await page.locator('[data-card-id]').first().click();

    // Modal should open
    await expect(page.getByRole('dialog')).toBeVisible();

    // Should show card details
    await expect(page.getByText(/description/i)).toBeVisible();
    await expect(page.getByText(/comments/i)).toBeVisible();
  });

  test.skip('should edit card title in modal', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Open card modal
    await page.locator('[data-card-id]').first().click();

    // Click on title to edit
    const titleInput = page.getByLabel(/english title/i);
    await titleInput.click();
    await titleInput.fill('Updated card title');

    // Save changes (blur or click save)
    await titleInput.blur();

    // Title should be updated
    await expect(page.getByText('Updated card title')).toBeVisible();
  });

  test.skip('should add labels to card', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Open card modal
    await page.locator('[data-card-id]').first().click();

    // Click labels button
    await page.getByRole('button', { name: /labels/i }).click();

    // Type new label
    await page.getByPlaceholder(/add label/i).fill('Bug');
    await page.keyboard.press('Enter');

    // Label should appear on card
    await expect(page.getByText('Bug')).toBeVisible();
  });

  test.skip('should set due date', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Open card modal
    await page.locator('[data-card-id]').first().click();

    // Click due date button
    await page.getByRole('button', { name: /due date/i }).click();

    // Select tomorrow's date
    await page.getByRole('button', { name: /tomorrow/i }).click();

    // Due date should appear
    await expect(page.getByText(/tomorrow/i)).toBeVisible();
  });

  test.skip('should add checklist', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Open card modal
    await page.locator('[data-card-id]').first().click();

    // Click add checklist button
    await page.getByRole('button', { name: /checklist/i }).click();

    // Name the checklist
    await page.getByPlaceholder(/checklist name/i).fill('Tasks');
    await page.keyboard.press('Enter');

    // Add items
    await page.getByPlaceholder(/add item/i).fill('Task 1');
    await page.keyboard.press('Enter');
    await page.getByPlaceholder(/add item/i).fill('Task 2');
    await page.keyboard.press('Enter');

    // Checklist should appear
    await expect(page.getByText('Tasks')).toBeVisible();
    await expect(page.getByText('Task 1')).toBeVisible();
    await expect(page.getByText('Task 2')).toBeVisible();
  });

  test.skip('should check off checklist item', async ({ page }) => {
    await page.goto('/boards/test-board-id?card=card-with-checklist');

    // Find checklist item
    const item = page.getByText('Task 1').locator('..');

    // Click checkbox
    await item.getByRole('checkbox').click();

    // Item should be checked
    await expect(item.getByRole('checkbox')).toBeChecked();
  });

  test.skip('should close modal on escape', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Open card modal
    await page.locator('[data-card-id]').first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Modal should close
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test.skip('should archive card', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Open card modal
    const card = page.locator('[data-card-id]').first();
    const cardId = await card.getAttribute('data-card-id');
    await card.click();

    // Click archive button
    await page.getByRole('button', { name: /archive/i }).click();

    // Card should be removed from board
    await expect(page.locator(`[data-card-id="${cardId}"]`)).not.toBeVisible();
  });

  test.skip('should restore archived card', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Open archive drawer
    await page.getByRole('button', { name: /more/i }).click();
    await page.getByText(/archive/i).click();

    // Find archived card and restore
    await page.getByText(/archived card title/i).locator('..').getByRole('button', { name: /restore/i }).click();

    // Card should reappear on board
    await page.keyboard.press('Escape'); // Close drawer
    await expect(page.getByText(/archived card title/i)).toBeVisible();
  });
});

test.describe('Drag and Drop', () => {
  test.skip('should drag card to another column', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    // Get the card and target column
    const card = page.locator('[data-card-id]').first();
    const targetColumn = page.locator('[data-column]').nth(1);

    // Perform drag
    await card.dragTo(targetColumn);

    // Card should be in target column
    const cardText = await card.textContent();
    if (cardText) {
      await expect(targetColumn.locator('[data-card-id]')).toContainText(cardText);
    }
  });

  test.skip('should reorder cards within column', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    const column = page.locator('[data-column]').first();
    const cards = column.locator('[data-card-id]');

    const firstCard = cards.first();
    const lastCard = cards.last();

    // Drag first card to last position
    await firstCard.dragTo(lastCard);

    // Order should be changed
    const newCards = column.locator('[data-card-id]');
    const firstCardText = await firstCard.textContent();
    if (firstCardText) {
      await expect(newCards.last()).toContainText(firstCardText);
    }
  });

  test.skip('should drag column to reorder', async ({ page }) => {
    await page.goto('/boards/test-board-id');

    const columns = page.locator('[data-column]');
    const firstColumn = columns.first();
    const lastColumn = columns.last();

    // Get column names before drag
    const firstName = await firstColumn.locator('[data-column-name]').textContent();

    // Drag first column to last position
    await firstColumn.locator('[data-column-drag-handle]').dragTo(lastColumn);

    // First column should now be last
    if (firstName) {
      await expect(columns.last().locator('[data-column-name]')).toHaveText(firstName);
    }
  });
});
