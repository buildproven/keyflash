/**
 * Global test setup for all test suites
 */

import { afterEach } from 'vitest'

// Global test timeout (increased for command execution tests and npm installs)
export const TEST_TIMEOUT = 120000 // 120 seconds

// Cleanup tracking for isolated test environments
const cleanupCallbacks: Array<() => void> = []

/**
 * Register a cleanup callback to run after each test
 */
export function registerCleanup(callback: () => void): void {
  cleanupCallbacks.push(callback)
}

/**
 * Run all registered cleanup callbacks
 */
afterEach(() => {
  for (const callback of cleanupCallbacks) {
    try {
      callback()
    } catch (error) {
      console.warn('Cleanup error:', error)
    }
  }
  cleanupCallbacks.length = 0
})
