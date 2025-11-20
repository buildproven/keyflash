import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('should display landing page with correct content', async ({ page }) => {
    await page.goto('/');

    // Check page title
    await expect(page).toHaveTitle(/KeyFlash/);

    // Check main heading
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('KeyFlash');

    // Check for search link/button
    const searchLink = page.getByRole('link', { name: /search/i });
    await expect(searchLink).toBeVisible();
  });

  test('should navigate to search page', async ({ page }) => {
    await page.goto('/');

    // Click search link
    await page.getByRole('link', { name: /search/i }).click();

    // Verify navigation
    await expect(page).toHaveURL('/search');
  });

  test('should have fast initial load (performance)', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    // Should load in under 3 seconds (requirement)
    expect(loadTime).toBeLessThan(3000);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check main content is visible
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();

    // Check search link is accessible
    const searchLink = page.getByRole('link', { name: /search/i });
    await expect(searchLink).toBeVisible();
  });

  test('should have accessible navigation', async ({ page }) => {
    await page.goto('/');

    // Check keyboard navigation
    await page.keyboard.press('Tab');

    // Focus should move to interactive elements
    const focusedElement = await page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});
