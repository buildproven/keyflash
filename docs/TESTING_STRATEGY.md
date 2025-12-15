# KeyFlash - Testing Strategy

## Testing Philosophy

**Principle**: Test user behavior, not implementation details

- **Write tests that give confidence**: Focus on critical paths and user workflows
- **Test like a user**: Prefer integration/E2E over isolated unit tests
- **Fast feedback loops**: Tests should run quickly in development
- **No flaky tests**: Delete or fix unreliable tests immediately
- **Living documentation**: Tests document how the system works

## Testing Pyramid

```
         /\
        /E2E\           10% - Critical user journeys
       /------\
      /Smoke   \         5% - Pre-deployment checks
     /----------\
    /Integration \      20% - API routes, services
   /--------------\
  /Command & Config\    10% - Verify tools work
 /------------------\
/   Unit Tests       \  55% - Business logic
/____________________\
```

### Test Distribution

**55% Unit Tests** (Fast, Isolated)

- Validation functions
- Data transformation
- Utility functions
- Business logic (keyword difficulty scoring, etc.)

**20% Integration Tests** (Medium Speed)

- API routes (mocked external APIs)
- Cache layer
- API provider implementations

**10% Command Execution & Config Tests** (Medium Speed)

- npm scripts execution
- Configuration validation
- Quality automation (pre-commit hooks, CI/CD)

**10% E2E Tests** (Slower, High Value)

- Complete user workflows
- Critical paths only
- Real browser interactions

**5% Smoke Tests** (Fast, Essential)

- Project structure validation
- Dependency checks
- Quick sanity tests

## Testing Stack

### Unit & Integration Tests

**Framework**: **Vitest**

- **Why**: Faster than Jest (5-10x), better DX, Vite-native
- Drop-in Jest replacement (same API)
- Built-in TypeScript support
- Watch mode with HMR
- Great coverage reporting

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom', // For React component tests
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/', 'tests/', '**/*.config.{js,ts}', '**/types/'],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### React Component Tests

**Library**: **React Testing Library**

- Tests components like users interact with them
- No implementation detail testing
- Excellent accessibility testing
- Encourages best practices

```bash
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

### E2E Tests

**Framework**: **Playwright**

- **Why**: Fast, reliable, modern
- Multi-browser testing (Chromium, Firefox, WebKit)
- Built-in test runner
- Parallel execution
- Auto-wait (no flaky tests)
- Screenshot/video on failure
- Network mocking

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['html'],
    ['list'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### API Testing

**Library**: **MSW (Mock Service Worker)**

- Intercept network requests
- Mock external APIs (Google Ads, DataForSEO)
- Same mocks for tests and development
- Network-level mocking (not fetch/axios mocking)

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  // Mock Google Ads API
  http.post(
    'https://googleads.googleapis.com/v*/customers/:customerId/googleAds:search',
    () => {
      return HttpResponse.json({
        results: [
          {
            keywordPlanAdGroupKeyword: {
              text: 'test keyword',
            },
            keywordPlanAdGroupKeywordHistoricalMetrics: {
              avgMonthlySearches: 1000,
              competition: 'LOW',
            },
          },
        ],
      })
    }
  ),

  // Mock DataForSEO API
  http.post(
    'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
    () => {
      return HttpResponse.json({
        tasks: [
          {
            result: [
              {
                keyword: 'test keyword',
                search_volume: 1000,
                competition: 0.3,
              },
            ],
          },
        ],
      })
    }
  ),
]
```

## Test Categories

### 1. Unit Tests

**What to Test**:

- Input validation (Zod schemas)
- Data transformation functions
- Business logic (keyword difficulty calculation)
- Utility functions (sanitization, formatting)
- Error handling

**What NOT to Test**:

- Third-party libraries
- React internals
- Next.js framework code

#### Examples

```typescript
// tests/unit/validation.test.ts
import { describe, it, expect } from 'vitest'
import { KeywordSearchSchema } from '@/lib/validation/schemas'

describe('KeywordSearchSchema', () => {
  it('accepts valid keyword input', () => {
    const input = {
      keywords: ['seo tools', 'keyword research'],
      matchType: 'phrase',
      location: 'US',
      language: 'en',
    }

    expect(() => KeywordSearchSchema.parse(input)).not.toThrow()
  })

  it('rejects invalid keyword characters', () => {
    const input = {
      keywords: ['<script>alert("xss")</script>'],
      matchType: 'phrase',
      location: 'US',
      language: 'en',
    }

    expect(() => KeywordSearchSchema.parse(input)).toThrow()
  })

  it('enforces max 200 keywords', () => {
    const input = {
      keywords: Array(201).fill('keyword'),
      matchType: 'phrase',
      location: 'US',
      language: 'en',
    }

    expect(() => KeywordSearchSchema.parse(input)).toThrow(
      'Maximum 200 keywords'
    )
  })
})
```

```typescript
// tests/unit/utils/sanitize.test.ts
import { describe, it, expect } from 'vitest'
import { sanitizeKeyword } from '@/lib/utils/sanitize'

describe('sanitizeKeyword', () => {
  it('removes dangerous HTML characters', () => {
    expect(sanitizeKeyword('<script>alert("xss")</script>')).toBe(
      'scriptalert("xss")/script'
    )
  })

  it('collapses multiple spaces', () => {
    expect(sanitizeKeyword('keyword    research')).toBe('keyword research')
  })

  it('trims leading/trailing whitespace', () => {
    expect(sanitizeKeyword('  keyword  ')).toBe('keyword')
  })

  it('enforces max length', () => {
    const longKeyword = 'a'.repeat(150)
    expect(sanitizeKeyword(longKeyword).length).toBe(100)
  })
})
```

### 2. Integration Tests

**What to Test**:

- API routes with mocked external services
- Cache layer behavior
- API provider switching logic
- Rate limiting

#### Examples

```typescript
// tests/integration/api/keywords.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { handlers } from '@/tests/mocks/handlers'

const server = setupServer(...handlers)

beforeAll(() => server.listen())
afterAll(() => server.close())

describe('POST /api/keywords', () => {
  it('returns keyword data for valid input', async () => {
    const response = await fetch('http://localhost:3000/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords: ['seo tools'],
        matchType: 'phrase',
        location: 'US',
        language: 'en',
      }),
    })

    expect(response.ok).toBe(true)

    const data = await response.json()
    expect(data.results).toHaveLength(1)
    expect(data.results[0]).toMatchObject({
      keyword: 'seo tools',
      searchVolume: expect.any(Number),
      difficulty: expect.any(Number),
    })
  })

  it('returns 400 for invalid input', async () => {
    const response = await fetch('http://localhost:3000/api/keywords', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keywords: [], // Invalid: empty array
        matchType: 'phrase',
      }),
    })

    expect(response.status).toBe(400)
  })

  it('returns 429 when rate limit exceeded', async () => {
    // Make 11 requests (limit is 10/hour)
    const requests = Array(11)
      .fill(null)
      .map(() =>
        fetch('http://localhost:3000/api/keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keywords: ['test'],
            matchType: 'phrase',
            location: 'US',
            language: 'en',
          }),
        })
      )

    const responses = await Promise.all(requests)
    const lastResponse = responses[responses.length - 1]

    expect(lastResponse.status).toBe(429)
  })
})
```

```typescript
// tests/integration/cache/redis.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { cacheKeywordData, getCachedKeywordData } from '@/lib/cache/redis'

describe('Redis Cache', () => {
  beforeEach(async () => {
    // Clear cache before each test
    await clearTestCache()
  })

  it('caches and retrieves keyword data', async () => {
    const data = {
      keywords: ['test'],
      results: [{ keyword: 'test', searchVolume: 1000 }],
    }

    await cacheKeywordData('test-key', data)
    const cached = await getCachedKeywordData('test-key')

    expect(cached).toEqual(data)
  })

  it('returns null for cache miss', async () => {
    const cached = await getCachedKeywordData('nonexistent-key')
    expect(cached).toBeNull()
  })

  it('respects TTL expiration', async () => {
    const data = { keywords: ['test'], results: [] }

    await cacheKeywordData('test-key', data, 1) // 1 second TTL

    // Immediately available
    let cached = await getCachedKeywordData('test-key')
    expect(cached).not.toBeNull()

    // Wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Should be expired
    cached = await getCachedKeywordData('test-key')
    expect(cached).toBeNull()
  }, 5000) // Extend test timeout
})
```

### 3. Component Tests

**What to Test**:

- User interactions (clicks, form inputs)
- Conditional rendering
- Error states
- Accessibility

#### Examples

```typescript
// tests/components/KeywordSearchForm.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KeywordSearchForm } from '@/components/forms/KeywordSearchForm';

describe('KeywordSearchForm', () => {
  it('submits form with valid input', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<KeywordSearchForm onSubmit={onSubmit} />);

    // Enter keywords
    await user.type(
      screen.getByLabelText(/keywords/i),
      'seo tools\nkeyword research'
    );

    // Select match type
    await user.click(screen.getByRole('radio', { name: /phrase match/i }));

    // Submit form
    await user.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        keywords: ['seo tools', 'keyword research'],
        matchType: 'phrase',
        location: 'US',
        language: 'en',
      });
    });
  });

  it('shows validation error for empty keywords', async () => {
    const user = userEvent.setup();

    render(<KeywordSearchForm onSubmit={() => {}} />);

    await user.click(screen.getByRole('button', { name: /search/i }));

    expect(await screen.findByText(/at least 1 keyword required/i))
      .toBeInTheDocument();
  });

  it('disables submit button during submission', async () => {
    const user = userEvent.setup();

    render(<KeywordSearchForm onSubmit={async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }} />);

    await user.type(screen.getByLabelText(/keywords/i), 'test');
    const submitButton = screen.getByRole('button', { name: /search/i });

    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
  });

  it('is accessible', async () => {
    const { container } = render(<KeywordSearchForm onSubmit={() => {}} />);

    // Check for proper labels
    expect(screen.getByLabelText(/keywords/i)).toBeInTheDocument();

    // Check ARIA attributes
    const form = container.querySelector('form');
    expect(form).toHaveAttribute('aria-label');
  });
});
```

### 4. E2E Tests

**What to Test**:

- Critical user journeys
- Full workflows from start to finish
- Cross-browser compatibility
- Real API integrations (in staging)

#### Examples

```typescript
// tests/e2e/keyword-search.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Keyword Search Workflow', () => {
  test('complete keyword search from landing to results', async ({ page }) => {
    // Navigate to landing page
    await page.goto('/')

    // Verify landing page loaded
    await expect(page.getByRole('heading', { name: /keyflash/i })).toBeVisible()

    // Click "Get Started"
    await page.getByRole('link', { name: /get started/i }).click()

    // Verify search page loaded
    await expect(
      page.getByRole('heading', { name: /keyword search/i })
    ).toBeVisible()

    // Enter keywords
    await page.getByLabel(/keywords/i).fill('seo tools\nkeyword research')

    // Select options
    await page.getByLabel(/phrase match/i).check()
    await page.getByLabel(/batch size/i).selectOption('20')

    // Submit search
    await page.getByRole('button', { name: /search keywords/i }).click()

    // Wait for results
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 })

    // Verify results table has data
    const rows = page.getByRole('row')
    await expect(rows).toHaveCount(3) // Header + 2 keywords

    // Verify columns
    await expect(
      page.getByRole('columnheader', { name: /keyword/i })
    ).toBeVisible()
    await expect(
      page.getByRole('columnheader', { name: /volume/i })
    ).toBeVisible()
    await expect(
      page.getByRole('columnheader', { name: /difficulty/i })
    ).toBeVisible()

    // Verify data
    await expect(page.getByRole('cell', { name: /seo tools/i })).toBeVisible()
  })

  test('handles rate limiting gracefully', async ({ page }) => {
    await page.goto('/search')

    // Make 11 searches rapidly (limit is 10/hour)
    for (let i = 0; i < 11; i++) {
      await page.getByLabel(/keywords/i).fill(`keyword ${i}`)
      await page.getByRole('button', { name: /search/i }).click()

      if (i < 10) {
        await expect(page.getByRole('table')).toBeVisible()
      }
    }

    // 11th search should show rate limit error
    await expect(page.getByText(/rate limit exceeded/i)).toBeVisible()
    await expect(page.getByText(/try again in \d+ minutes/i)).toBeVisible()
  })

  test('exports results to CSV', async ({ page }) => {
    await page.goto('/search')

    // Perform search
    await page.getByLabel(/keywords/i).fill('test keyword')
    await page.getByRole('button', { name: /search/i }).click()
    await expect(page.getByRole('table')).toBeVisible()

    // Export CSV
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /export csv/i }).click()
    const download = await downloadPromise

    // Verify filename
    expect(download.suggestedFilename()).toMatch(/keyflash-results-.*\.csv/)

    // Verify content
    const content = await download.createReadStream()
    // TODO: Parse and validate CSV content
  })
})

test.describe('Accessibility', () => {
  test('keyboard navigation works', async ({ page }) => {
    await page.goto('/search')

    // Tab through form elements
    await page.keyboard.press('Tab')
    await expect(page.getByLabel(/keywords/i)).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.getByLabel(/phrase match/i)).toBeFocused()

    // Submit with Enter
    await page.getByLabel(/keywords/i).fill('test')
    await page.keyboard.press('Enter')

    await expect(page.getByRole('table')).toBeVisible()
  })

  test('screen reader landmarks present', async ({ page }) => {
    await page.goto('/')

    // Check for proper landmarks
    await expect(page.getByRole('banner')).toBeVisible() // Header
    await expect(page.getByRole('main')).toBeVisible() // Main content
    await expect(page.getByRole('contentinfo')).toBeVisible() // Footer
  })
})
```

### 5. Command Execution Tests

**What to Test**:

- npm scripts actually execute successfully
- Commands produce expected behavior
- Auto-fix commands modify files correctly
- Error conditions are detected

**Critical**: These tests prevent shipping broken commands to users.

#### Examples

```typescript
// tests/command-execution/npm-scripts.test.ts
import { describe, it, expect } from 'vitest'
import { IsolatedTestEnv } from '../helpers/isolated-test-env'

describe('npm scripts execution', () => {
  it('npm run format actually formats files', () => {
    const env = new IsolatedTestEnv()
    env.copyPackageJson().copyConfigs(['.prettierrc'])

    // Create badly formatted file
    env.writeFile('test.ts', 'const   x=1;')

    // Install Prettier
    env.exec('npm install --no-save prettier')

    // Run format command
    env.exec('npm run format')

    // Verify file was formatted
    const formatted = env.readFile('test.ts')
    expect(formatted).toContain('const x = 1')
  })
})
```

### 6. Quality Automation Tests

**What to Test**:

- Pre-commit hooks execute correctly
- GitHub Actions workflows are valid
- lint-staged configuration works
- Husky hooks are properly installed

#### Examples

```typescript
// tests/quality-automation/pre-commit-hook.test.ts
describe('pre-commit hook', () => {
  it('prevents commit when linting fails', () => {
    const env = new IsolatedTestEnv()
    env.gitInit().copyHuskyHooks()

    // Create file with errors
    env.writeFile('bad.js', 'eval("dangerous")')
    env.exec('git add bad.js')

    // Commit should fail
    const result = env.exec('git commit -m "test"', { throwOnError: false })
    expect(result.exitCode).not.toBe(0)
  })
})
```

### 7. Configuration Validation Tests

**What to Test**:

- ESLint config is valid and functional
- Prettier config is valid and functional
- Vitest config is valid
- All config files have correct syntax
- Tools can actually run with the configs

#### Examples

```typescript
// tests/config-validation/eslint.test.ts
describe('ESLint configuration', () => {
  it('config file has valid syntax', () => {
    const config = require('../../eslint.config.cjs')
    expect(config).toBeDefined()
  })

  it('can lint a simple file', () => {
    // Create temp file and try to lint it
    const output = execSync('npx eslint test.ts', { stdio: 'pipe' })
    expect(output).toBeDefined()
  })
})
```

### 8. Smoke Tests

**What to Test**:

- Critical dependencies are installed
- Essential files and directories exist
- Basic npm scripts are defined
- No .env files are committed
- Documentation files exist

**Purpose**: Quick pre-deployment sanity checks (< 30 seconds).

#### Examples

```typescript
// tests/smoke/basic-functionality.test.ts
describe('Project structure smoke tests', () => {
  it('all critical dependencies are installed', () => {
    const pkgJson = require('../../package.json')

    const criticalDeps = ['next', 'react', 'zod', '@upstash/redis']
    for (const dep of criticalDeps) {
      expect(pkgJson.dependencies).toHaveProperty(dep)
    }
  })

  it('critical npm scripts are defined', () => {
    const pkgJson = require('../../package.json')
    expect(pkgJson.scripts).toHaveProperty('test')
    expect(pkgJson.scripts).toHaveProperty('lint')
    expect(pkgJson.scripts).toHaveProperty('build')
  })
})
```

## Test Coverage Goals

### Coverage Targets

```
Overall: 70% minimum

By Category:
- Critical paths (auth, payments): 90%+
- Business logic: 80%+
- UI components: 70%+
- Utilities: 80%+
- Config files: Validated (not coverage-tracked)
```

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html

# CI: Upload to Codecov
- uses: codecov/codecov-action@v4
  with:
    files: ./coverage/lcov.info
```

### Coverage Enforcement

```typescript
// vitest.config.ts
coverage: {
  thresholds: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
  // Fail CI if below thresholds
  failOnLow: true,
}
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run type check
        run: npm run type-check:all

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration
        env:
          UPSTASH_REDIS_REST_URL: ${{ secrets.UPSTASH_REDIS_REST_URL_TEST }}
          UPSTASH_REDIS_REST_TOKEN: ${{ secrets.UPSTASH_REDIS_REST_TOKEN_TEST }}

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info

  e2e:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          BASE_URL: http://localhost:3000

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

## Testing Commands

```json
// package.json scripts
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:commands": "vitest run tests/command-execution",
    "test:config": "vitest run tests/config-validation",
    "test:quality": "vitest run tests/quality-automation",
    "test:smoke": "vitest run tests/smoke",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:commands && npm run test:config && npm run test:quality && npm run test:smoke && npm run test:e2e",
    "test:ci": "npm run test:config && npm run test:commands && npm run test:quality && npm run test:unit && npm run test:integration && npm run test:smoke",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

### Quick Command Reference

```bash
# Run all tests
npm run test:all

# Run only specific test categories
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:commands       # Command execution tests
npm run test:config         # Configuration validation
npm run test:quality        # Quality automation tests
npm run test:smoke          # Smoke tests
npm run test:e2e            # E2E tests

# CI/CD optimized (runs critical tests first)
npm run test:ci

# Development workflow
npm run test:watch      # Watch mode for TDD

# Coverage reports
npm run test:coverage   # Generate coverage report
```

## Testing Best Practices

### Do's ✅

- **Test user behavior**, not implementation
- **Use descriptive test names**: "should show error when keywords exceed 200"
- **Arrange-Act-Assert** pattern
- **Mock external services** (APIs, databases)
- **Test edge cases** (empty input, max length, special characters)
- **Test error states** (network errors, validation errors)
- **Keep tests independent** (no shared state)
- **Use factories** for test data

### Don'ts ❌

- ❌ **Don't test third-party libraries**
- ❌ **Don't test implementation details** (state, methods)
- ❌ **Don't write flaky tests** (race conditions, timeouts)
- ❌ **Don't use random data** in tests
- ❌ **Don't skip tests** (fix or delete them)
- ❌ **Don't test private functions** (test through public API)

## Manual Testing Checklist

### Pre-Release Testing

**Functionality**:

- [ ] Keyword search returns results
- [ ] All filter options work
- [ ] CSV export works
- [ ] Error messages display correctly
- [ ] Rate limiting triggers after limit

**Performance**:

- [ ] Search completes in <5 seconds
- [ ] No memory leaks (check DevTools)
- [ ] Page load <2 seconds

**Cross-Browser** (use BrowserStack):

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Mobile** (responsive design):

- [ ] iPhone (Safari)
- [ ] Android (Chrome)
- [ ] Tablet (iPad)

**Accessibility**:

- [ ] Keyboard navigation works
- [ ] Screen reader compatible (NVDA/VoiceOver)
- [ ] Sufficient color contrast (WCAG AA)
- [ ] Focus indicators visible

## Test Data Management

### Test Fixtures

```typescript
// tests/fixtures/keywords.ts
export const mockKeywordData = [
  {
    keyword: 'seo tools',
    searchVolume: 5000,
    difficulty: 45,
    cpc: 3.2,
    intent: 'commercial',
    competition: 'medium',
  },
  {
    keyword: 'keyword research',
    searchVolume: 8000,
    difficulty: 52,
    cpc: 2.8,
    intent: 'informational',
    competition: 'high',
  },
]

export const mockApiResponse = {
  tasks: [
    {
      result: mockKeywordData,
    },
  ],
}
```

### Test Factories

```typescript
// tests/factories/keyword.ts
import { faker } from '@faker-js/faker'

export function createKeyword(overrides = {}) {
  return {
    keyword: faker.word.words(2),
    searchVolume: faker.number.int({ min: 100, max: 100000 }),
    difficulty: faker.number.int({ min: 0, max: 100 }),
    cpc: faker.number.float({ min: 0.5, max: 10 }),
    intent: faker.helpers.arrayElement([
      'informational',
      'commercial',
      'transactional',
    ]),
    competition: faker.helpers.arrayElement(['low', 'medium', 'high']),
    ...overrides,
  }
}
```

---

**Document Version**: 1.0
**Last Updated**: 2025-11-19
**Next Review**: After MVP development
**Owner**: Technical Lead
