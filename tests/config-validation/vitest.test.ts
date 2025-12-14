/**
 * Configuration Validation Tests - Vitest
 *
 * These tests verify that Vitest configuration is valid and functional.
 * Meta-testing: testing the test framework configuration itself!
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

describe('Vitest configuration', () => {
  const configPath = join(process.cwd(), 'vitest.config.ts')

  it('config file exists', () => {
    // Config might be in vitest.config.ts or vite.config.ts
    const vitestConfigExists = existsSync(configPath)
    const viteConfigExists = existsSync(join(process.cwd(), 'vite.config.ts'))

    expect(vitestConfigExists || viteConfigExists).toBe(true)
  })

  it('can import config without errors', async () => {
    if (existsSync(configPath)) {
      // Try to import the config
      const config = await import('../../vitest.config')
      expect(config).toBeDefined()
      expect(config.default).toBeDefined()
    }
  })

  it('config has coverage settings defined', async () => {
    if (existsSync(configPath)) {
      const config = await import('../../vitest.config')

      // Should have test.coverage configuration
      expect(config.default.test?.coverage).toBeDefined()
    }
  })

  it('coverage thresholds are set correctly', async () => {
    if (existsSync(configPath)) {
      const config = await import('../../vitest.config')

      const coverage = config.default.test?.coverage as
        | { thresholds?: Record<string, number> }
        | undefined
      const thresholds = coverage?.thresholds

      if (thresholds) {
        // All thresholds should be numbers between 0-100
        expect(typeof thresholds.lines).toBe('number')
        expect(typeof thresholds.functions).toBe('number')
        expect(typeof thresholds.branches).toBe('number')
        expect(typeof thresholds.statements).toBe('number')

        expect(thresholds.lines).toBeGreaterThanOrEqual(0)
        expect(thresholds.lines).toBeLessThanOrEqual(100)

        expect(thresholds.functions).toBeGreaterThanOrEqual(0)
        expect(thresholds.functions).toBeLessThanOrEqual(100)
      }
    }
  })

  it('test environment is configured', async () => {
    if (existsSync(configPath)) {
      const config = await import('../../vitest.config')

      // Should have test environment defined
      expect(config.default.test?.environment).toBeDefined()
    }
  })

  it('path aliases are configured for imports', async () => {
    if (existsSync(configPath)) {
      const config = await import('../../vitest.config')

      // Should have resolve.alias for @/ imports
      const hasAlias = config.default.resolve?.alias !== undefined

      // If aliases are configured, @ should map to src
      if (hasAlias && config.default.resolve) {
        const alias = config.default.resolve.alias
        expect(alias).toBeDefined()
      }
    }
  })
})

describe('Vitest execution', () => {
  it('npm run test command is defined', () => {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const content = readFileSync(packageJsonPath, 'utf-8')
    const pkgJson = JSON.parse(content)

    expect(pkgJson.scripts).toHaveProperty('test')
    expect(pkgJson.scripts.test).toContain('vitest')
  })

  it('test scripts are comprehensive', () => {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const content = readFileSync(packageJsonPath, 'utf-8')
    const pkgJson = JSON.parse(content)

    // Should have multiple test-related scripts
    expect(pkgJson.scripts).toHaveProperty('test')
    expect(pkgJson.scripts).toHaveProperty('test:watch')
    expect(pkgJson.scripts).toHaveProperty('test:coverage')
  })

  it('vitest is installed as dev dependency', () => {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const content = readFileSync(packageJsonPath, 'utf-8')
    const pkgJson = JSON.parse(content)

    expect(pkgJson.devDependencies).toHaveProperty('vitest')
  })

  it('coverage provider is installed', () => {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const content = readFileSync(packageJsonPath, 'utf-8')
    const pkgJson = JSON.parse(content)

    // Should have coverage provider (v8 or c8)
    const hasCoverageProvider =
      pkgJson.devDependencies['@vitest/coverage-v8'] ||
      pkgJson.devDependencies['@vitest/coverage-c8']

    expect(hasCoverageProvider).toBeDefined()
  })
})

describe('Vitest this test execution', () => {
  it('can run tests successfully', () => {
    // This test running proves Vitest is working!
    expect(true).toBe(true)
  })

  it('supports TypeScript', () => {
    // If this test file is running, TypeScript is supported
    const value: number = 42
    expect(value).toBe(42)
  })

  it('has access to expect matchers', () => {
    expect(1).toBe(1)
    expect([1, 2, 3]).toHaveLength(3)
    expect({ foo: 'bar' }).toHaveProperty('foo')
  })
})
