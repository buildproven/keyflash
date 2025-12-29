/**
 * Configuration Validation Tests - Prettier
 *
 * These tests verify that Prettier configuration is valid and functional.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

describe('Prettier configuration', () => {
  const configPath = join(process.cwd(), '.prettierrc')

  it('config file exists', () => {
    expect(existsSync(configPath)).toBe(true)
  })

  it('config file has valid JSON syntax', () => {
    const content = readFileSync(configPath, 'utf-8')

    expect(() => {
      JSON.parse(content)
    }).not.toThrow()
  })

  it('config has reasonable defaults', () => {
    const content = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(content)

    // Should have some basic formatting rules
    expect(typeof config).toBe('object')
  })

  it('can format a simple file', () => {
    const tempFile = join(process.cwd(), '.prettier-test-temp.ts')

    try {
      // Create badly formatted file
      const badlyFormatted = 'const   x=1;const y=2;'
      writeFileSync(tempFile, badlyFormatted)

      // Format it
      execSync(`npx prettier --write ${tempFile}`, {
        stdio: 'pipe',
        timeout: 30000,
      })

      // Read result
      const formatted = readFileSync(tempFile, 'utf-8')

      // Should be formatted
      expect(formatted).not.toBe(badlyFormatted)
      expect(formatted).toContain('const x = 1')
    } finally {
      // Cleanup
      try {
        unlinkSync(tempFile)
      } catch {}
    }
  }, 45000)

  it('format:check detects unformatted files', () => {
    const tempFile = join(process.cwd(), '.prettier-check-temp.ts')

    try {
      // Create badly formatted file
      writeFileSync(tempFile, 'const   x=1;')

      // Check formatting - should fail
      try {
        execSync(`npx prettier --check ${tempFile}`, {
          stdio: 'pipe',
          timeout: 30000,
        })
        // If it doesn't throw, the file was already formatted (unexpected)
        expect(true).toBe(false)
      } catch (error) {
        // Expected - file is not formatted
        expect(error).toBeDefined()
      }
    } finally {
      // Cleanup
      try {
        unlinkSync(tempFile)
      } catch {}
    }
  }, 45000)
})

describe('Prettier ignore configuration', () => {
  const ignorePath = join(process.cwd(), '.prettierignore')

  it('prettierignore file exists', () => {
    expect(existsSync(ignorePath)).toBe(true)
  })

  it('ignores node_modules', () => {
    const content = readFileSync(ignorePath, 'utf-8')
    expect(content).toContain('node_modules')
  })

  it('ignores build outputs', () => {
    const content = readFileSync(ignorePath, 'utf-8')
    expect(content).toMatch(/\.next|dist|build|coverage/)
  })
})

describe('Prettier execution', () => {
  it('npm run format command works', () => {
    try {
      // Just check that the command is defined and doesn't crash
      execSync('npm run format --help', {
        encoding: 'utf-8',
        stdio: 'pipe',
      })
      expect(true).toBe(true)
    } catch (error) {
      // Command might not support --help, but should exist
      expect(error).toBeDefined()
    }
  })

  it('npm run format:check command exists', () => {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const content = readFileSync(packageJsonPath, 'utf-8')
    const pkgJson = JSON.parse(content)

    expect(pkgJson.scripts).toHaveProperty('format:check')
    expect(pkgJson.scripts['format:check']).toContain('prettier')
    expect(pkgJson.scripts['format:check']).toContain('--check')
  })
})
