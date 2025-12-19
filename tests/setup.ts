import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

process.env.VITEST = 'true'

// React 19 compatibility: enable act environment
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

// Extend Vitest matchers with jest-dom
expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
  cleanup()
})
