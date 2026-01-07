/**
 * Startup Robustness Test
 *
 * Tests that the application startup process gracefully handles missing
 * environment variables in development mode without crashing the server.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Startup Robustness', () => {
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment for each test
    process.env = { ...originalEnv }

    // Clear module cache to ensure fresh imports
    Object.keys(require.cache).forEach(key => {
      if (key.includes('env-validation') || key.includes('startup')) {
        delete require.cache[key]
      }
    })
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('Process Exit Removal', () => {
    it('should not use process.exit in validateEnvironment', () => {
      const validationFilePath = join(
        process.cwd(),
        'src',
        'lib',
        'config',
        'env-validation.ts'
      )
      const fileContent = readFileSync(validationFilePath, 'utf-8')

      // Should not contain actual process.exit calls (comments are ok)
      const lines = fileContent.split('\n')
      const codeLines = lines.filter(
        line =>
          line.includes('process.exit') &&
          !line.trim().startsWith('//') &&
          !line.trim().startsWith('*')
      )

      expect(codeLines.length).toBe(0)

      // Should contain throw Error instead
      expect(fileContent).toContain('throw new Error')
    })
  })

  describe('Environment Validation Error Handling', () => {
    it('should throw errors instead of exiting when validation fails', async () => {
      ;(process.env as Record<string, string>).NODE_ENV = 'production'
      delete process.env.RATE_LIMIT_HMAC_SECRET // Required in production

      let didThrow = false
      let errorMessage = ''

      try {
        // Dynamic import to avoid module caching issues
        const { validateEnvironment } =
          await import('../../src/lib/config/env-validation.js')
        validateEnvironment()
      } catch (error) {
        didThrow = true
        errorMessage = (error as Error).message
      }

      // Should throw error, not exit
      expect(didThrow).toBe(true)
      expect(errorMessage).toContain('Environment validation failed')
      expect(errorMessage).toContain('RATE_LIMIT_HMAC_SECRET')
    })

    it('should provide detailed error messages for Zod validation errors', async () => {
      ;(process.env as Record<string, string>).NODE_ENV = 'production'
      process.env.RATE_LIMIT_REQUESTS_PER_HOUR = 'invalid_number'
      process.env.RATE_LIMIT_HMAC_SECRET = 'valid_secret_that_is_long_enough'

      let errorMessage = ''
      try {
        const { validateEnvironment } =
          await import('../../src/lib/config/env-validation.js')
        validateEnvironment()
      } catch (error) {
        errorMessage = (error as Error).message
      }

      expect(errorMessage).toContain('Environment validation failed')
      expect(errorMessage).toContain('RATE_LIMIT_REQUESTS_PER_HOUR')
    })

    it('should handle Google Ads provider validation correctly', async () => {
      ;(process.env as Record<string, string>).NODE_ENV = 'production'
      process.env.KEYWORD_API_PROVIDER = 'google-ads'
      process.env.RATE_LIMIT_HMAC_SECRET = 'valid_secret_that_is_long_enough'
      // Missing Google Ads credentials

      let errorMessage = ''
      try {
        const { validateEnvironment } =
          await import('../../src/lib/config/env-validation.js')
        validateEnvironment()
      } catch (error) {
        errorMessage = (error as Error).message
      }

      expect(errorMessage).toContain('Environment validation failed')
      expect(errorMessage).toContain('GOOGLE_ADS')
    })
  })

  describe('Development Mode Behavior', () => {
    it('should skip environment validation entirely in development', () => {
      // Test the startup.ts logic structure
      const startupFilePath = join(
        process.cwd(),
        'src',
        'lib',
        'config',
        'startup.ts'
      )
      const startupContent = readFileSync(startupFilePath, 'utf-8')

      // Should skip validation in development (no try/catch for validateEnvironment in dev branch)
      expect(startupContent).toContain(
        'Development mode: environment validation skipped'
      )
      expect(startupContent).not.toContain('try {')

      // Should check for development mode
      expect(startupContent).toContain('isDevelopment')
      expect(startupContent).toContain("NODE_ENV === 'development'")

      // Production should still call validateEnvironment
      const lines = startupContent.split('\n')
      const prodSection = lines
        .slice(
          lines.findIndex(line => line.includes('} else {')),
          lines.findIndex(line => line.includes('// Mark initialization'))
        )
        .join('\n')
      expect(prodSection).toContain('validateEnvironment()')
    })

    it('should validate that error throwing allows proper handling', async () => {
      // Test that errors are throwable and catchable (not process.exit)
      // Use production mode to ensure validation is strict
      ;(process.env as Record<string, string>).NODE_ENV = 'production'
      delete process.env.KEYWORD_API_PROVIDER
      delete process.env.RATE_LIMIT_HMAC_SECRET // Force validation failure

      let caughtError = false
      try {
        const { validateEnvironment } =
          await import('../../src/lib/config/env-validation.js')
        validateEnvironment()
      } catch (error) {
        caughtError = true
        // If we can catch it, it's throwing properly (not using process.exit)
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain(
          'Environment validation failed'
        )
      }

      expect(caughtError).toBe(true)
    })
  })

  describe('Production Safety', () => {
    it('should still enforce strict validation in production', async () => {
      ;(process.env as Record<string, string>).NODE_ENV = 'production'
      // Remove critical production requirements
      delete process.env.RATE_LIMIT_HMAC_SECRET
      delete process.env.KEYWORD_API_PROVIDER

      let didThrow = false
      try {
        const { validateEnvironment } =
          await import('../../src/lib/config/env-validation.js')
        validateEnvironment()
      } catch {
        didThrow = true
      }

      // Production should still fail on missing critical config
      expect(didThrow).toBe(true)
    })
  })
})
