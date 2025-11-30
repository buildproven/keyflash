# Testing Guide

## Quick Reference

| Command              | Purpose                    |
| -------------------- | -------------------------- |
| `pnpm test`          | Run all tests              |
| `pnpm test:unit`     | Unit tests only            |
| `pnpm test:e2e`      | E2E tests with Playwright  |
| `pnpm test:coverage` | Generate coverage report   |
| `pnpm test:watch`    | Watch mode for development |

## Test Structure

```
tests/
├── unit/                    # 55% of coverage
│   ├── api/
│   ├── components/
│   ├── lib/
│   └── utils/
├── integration/             # 20% of coverage
│   ├── api/
│   └── services/
└── e2e/                     # 10% of coverage
    └── flows/
```

## Coverage Targets

- **Overall**: 70% minimum
- **Unit Tests**: 55%
- **Integration Tests**: 20%
- **E2E Tests**: 10%
- **Smoke Tests**: 5%

## Testing Frameworks

- **Unit/Integration**: Vitest
- **E2E**: Playwright
- **UI Components**: Testing Library
- **Mocking**: Vitest mocks + Mock Service Worker

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest'
import { calculateDifficulty } from '@/lib/keywords/difficulty'

describe('calculateDifficulty', () => {
  it('returns correct difficulty score', () => {
    const result = calculateDifficulty('high', 5.5, 10000)
    expect(result).toBe(85)
  })

  it('handles low competition', () => {
    const result = calculateDifficulty('low', 0.5, 1000)
    expect(result).toBeLessThan(30)
  })
})
```

### Integration Test Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { POST } from '@/app/api/keywords/route'

describe('POST /api/keywords', () => {
  it('returns keyword data for valid input', async () => {
    const request = new Request('http://localhost:3000/api/keywords', {
      method: 'POST',
      body: JSON.stringify({
        keywords: ['seo'],
        matchType: 'phrase',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
  })
})
```

## Test Data

- Use fixtures in `tests/fixtures/`
- Mock API responses in tests
- Keep test data minimal and focused

## Common Testing Patterns

### Mocking API Calls

```typescript
import { vi } from 'vitest'
import { fetchKeywordData } from '@/lib/api'

vi.mock('@/lib/api', () => ({
  fetchKeywordData: vi
    .fn()
    .mockResolvedValue([{ keyword: 'test', volume: 1000, difficulty: 50 }]),
}))
```

### Testing React Components

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

it('submits form with user input', async () => {
  const user = userEvent.setup()
  render(<KeywordForm onSubmit={vi.fn()} />)

  await user.type(screen.getByLabelText(/keywords/i), 'test')
  await user.click(screen.getByRole('button', { name: /search/i }))
})
```

## Running Tests

```bash
# All tests
pnpm test

# Watch mode (development)
pnpm test:watch

# Specific test file
pnpm test -- keywords.test.ts

# Coverage report
pnpm test:coverage

# E2E tests
pnpm test:e2e

# E2E with UI
pnpm test:e2e --ui
```

## Debugging Tests

```bash
# Run single test
pnpm test -- --reporter=verbose

# Debug with inspector
node --inspect-brk ./node_modules/vitest/vitest.mjs

# Playwright debugging
pnpm test:e2e --debug
```

## CI/CD Integration

Tests run automatically on:

- Pull request creation
- Commits to `main`
- Before deployment

All tests must pass before merge.

---

> **Vibe Build Lab LLC** · [vibebuildlab.com](https://vibebuildlab.com)
