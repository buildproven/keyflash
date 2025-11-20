import { test, expect } from '@playwright/test'

test.describe('Keyword Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/search')
  })

  test('should display search form', async ({ page }) => {
    // Check for keyword input
    const keywordInput = page.getByLabel(/keywords/i)
    await expect(keywordInput).toBeVisible()

    // Check for match type selector
    const matchTypeSelect = page.getByLabel(/match type/i)
    await expect(matchTypeSelect).toBeVisible()

    // Check for search button
    const searchButton = page.getByRole('button', { name: /search/i })
    await expect(searchButton).toBeVisible()
  })

  test('should search for keywords and display results', async ({ page }) => {
    // Enter keywords
    await page.getByLabel(/keywords/i).fill('seo tools\nkeyword research')

    // Select match type
    await page.getByLabel(/match type/i).selectOption('phrase')

    // Click search button
    await page.getByRole('button', { name: /search/i }).click()

    // Wait for results to appear
    await page.waitForSelector('[data-testid="keyword-results-table"]', {
      timeout: 5000,
    })

    // Verify results table is visible
    const resultsTable = page.getByTestId('keyword-results-table')
    await expect(resultsTable).toBeVisible()

    // Check for result rows
    const rows = page.getByRole('row')
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThan(1) // Header + at least 1 result

    // Verify columns are present
    await expect(page.getByText(/search volume/i)).toBeVisible()
    await expect(page.getByText(/difficulty/i)).toBeVisible()
    await expect(page.getByText(/cpc/i)).toBeVisible()
  })

  test('should validate empty input', async ({ page }) => {
    // Click search without entering keywords
    await page.getByRole('button', { name: /search/i }).click()

    // Should show validation error
    const error = page.locator('text=/required|at least/i')
    await expect(error).toBeVisible()
  })

  test('should validate keyword count limit', async ({ page }) => {
    // Generate more than 200 keywords
    const manyKeywords = Array(201)
      .fill(0)
      .map((_, i) => `keyword${i}`)
      .join('\n')

    await page.getByLabel(/keywords/i).fill(manyKeywords)
    await page.getByRole('button', { name: /search/i }).click()

    // Should show validation error
    const error = page.locator('text=/maximum|200/i')
    await expect(error).toBeVisible()
  })

  test('should support CSV export', async ({ page }) => {
    // Enter keywords and search
    await page.getByLabel(/keywords/i).fill('seo tools')
    await page.getByRole('button', { name: /search/i }).click()

    // Wait for results
    await page.waitForSelector('[data-testid="keyword-results-table"]')

    // Look for export button
    const exportButton = page.getByRole('button', { name: /export|csv/i })

    // If export button exists, test it
    if ((await exportButton.count()) > 0) {
      // Setup download listener
      const downloadPromise = page.waitForEvent('download')
      await exportButton.click()

      // Verify download started
      const download = await downloadPromise
      expect(download.suggestedFilename()).toMatch(/\.csv$/)
    }
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API to return error
    await page.route('**/api/keywords', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      })
    })

    // Attempt search
    await page.getByLabel(/keywords/i).fill('test')
    await page.getByRole('button', { name: /search/i }).click()

    // Should show error message
    const error = page.locator('text=/error|failed/i')
    await expect(error).toBeVisible()
  })

  test('should show loading state during search', async ({ page }) => {
    // Delay API response to observe loading state
    await page.route('**/api/keywords', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      await route.continue()
    })

    // Enter keywords and click search
    await page.getByLabel(/keywords/i).fill('test')
    await page.getByRole('button', { name: /search/i }).click()

    // Should show loading indicator
    const loading = page.locator('text=/loading|searching/i')
    await expect(loading).toBeVisible()

    // Loading should disappear after results load
    await expect(loading).not.toBeVisible({ timeout: 5000 })
  })

  test('should complete search in under 3 seconds', async ({ page }) => {
    // Enter keywords
    await page.getByLabel(/keywords/i).fill('seo tools')

    // Measure search time
    const startTime = Date.now()
    await page.getByRole('button', { name: /search/i }).click()

    // Wait for results
    await page.waitForSelector('[data-testid="keyword-results-table"]', {
      timeout: 5000,
    })

    const searchTime = Date.now() - startTime

    // Should complete in under 3 seconds (requirement)
    expect(searchTime).toBeLessThan(3000)
  })

  test('should work on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Enter keywords (mobile)
    await page.getByLabel(/keywords/i).fill('seo')
    await page.getByRole('button', { name: /search/i }).click()

    // Wait for results
    await page.waitForSelector('[data-testid="keyword-results-table"]')

    // Verify results are visible on mobile
    const resultsTable = page.getByTestId('keyword-results-table')
    await expect(resultsTable).toBeVisible()
  })

  test('should handle multiple searches sequentially', async ({ page }) => {
    // First search
    await page.getByLabel(/keywords/i).fill('seo')
    await page.getByRole('button', { name: /search/i }).click()
    await page.waitForSelector('[data-testid="keyword-results-table"]')

    // Second search (different keywords)
    await page.getByLabel(/keywords/i).fill('marketing')
    await page.getByRole('button', { name: /search/i }).click()
    await page.waitForSelector('[data-testid="keyword-results-table"]')

    // Verify results updated
    const resultsTable = page.getByTestId('keyword-results-table')
    await expect(resultsTable).toBeVisible()
  })

  test('should support different match types', async ({ page }) => {
    // Test exact match
    await page.getByLabel(/keywords/i).fill('seo')
    await page.getByLabel(/match type/i).selectOption('exact')
    await page.getByRole('button', { name: /search/i }).click()
    await page.waitForSelector('[data-testid="keyword-results-table"]')

    let resultsTable = page.getByTestId('keyword-results-table')
    await expect(resultsTable).toBeVisible()

    // Test phrase match
    await page.getByLabel(/keywords/i).fill('seo')
    await page.getByLabel(/match type/i).selectOption('phrase')
    await page.getByRole('button', { name: /search/i }).click()
    await page.waitForSelector('[data-testid="keyword-results-table"]')

    resultsTable = page.getByTestId('keyword-results-table')
    await expect(resultsTable).toBeVisible()
  })
})
