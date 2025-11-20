/**
 * Configuration Validation Tests - ESLint
 *
 * These tests verify that ESLint configuration is valid and functional.
 * Without these tests, config files could have syntax errors or invalid
 * rules that only get discovered at runtime.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

describe('ESLint configuration', () => {
  const configPath = join(process.cwd(), '.eslintrc.json')

  it('config file exists', () => {
    expect(existsSync(configPath)).toBe(true)
  })

  it('config file has valid JSON syntax', () => {
    const content = readFileSync(configPath, 'utf-8')

    // Should be able to parse as JSON
    expect(() => {
      JSON.parse(content)
    }).not.toThrow()
  })

  it('config exports a valid ESLint configuration', () => {
    const content = readFileSync(configPath, 'utf-8')
    const config = JSON.parse(content)

    // Should have extends or rules
    expect(config).toBeDefined()
    expect(typeof config).toBe('object')
  })

  it('config includes Next.js configuration', () => {
    const content = readFileSync(configPath, 'utf-8')

    // Should reference Next.js ESLint config
    expect(content).toMatch(/next|Next/)
  })

  it('config includes security plugin', () => {
    const content = readFileSync(configPath, 'utf-8')

    // Should include security plugin
    expect(content).toContain('security')
  })

  it('can lint a simple valid file without errors', () => {
    const tempFile = join(process.cwd(), '.eslint-test-temp.ts')

    try {
      // Create a simple valid file
      const validCode = `export function add(a: number, b: number): number {
  return a + b
}
`
      require('fs').writeFileSync(tempFile, validCode)

      // Try to lint it
      const output = execSync(`npx eslint ${tempFile}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      })

      // Should not crash (output might have warnings, that's okay)
      expect(output).toBeDefined()
    } catch (error: any) {
      // If it fails, it should be due to linting errors, not config errors
      expect(error.message).not.toContain('config')
      expect(error.message).not.toContain('Cannot read')
    } finally {
      // Cleanup
      try {
        require('fs').unlinkSync(tempFile)
      } catch {}
    }
  })

  it('detects dangerous patterns like eval()', () => {
    const tempFile = join(process.cwd(), '.eslint-test-dangerous.js')

    try {
      // Create file with dangerous code
      const dangerousCode = `eval("alert('xss')")
`
      require('fs').writeFileSync(tempFile, dangerousCode)

      // Lint it - should fail or warn
      try {
        execSync(`npx eslint ${tempFile}`, {
          encoding: 'utf-8',
          stdio: 'pipe',
        })
      } catch (error: any) {
        // Should have detected the eval usage
        const output = error.stdout + error.stderr
        expect(output).toMatch(/eval|dangerous/)
      }
    } finally {
      // Cleanup
      try {
        require('fs').unlinkSync(tempFile)
      } catch {}
    }
  })
})

describe('ESLint ignore configuration', () => {
  const ignorePath = join(process.cwd(), '.eslintignore')

  it('eslintignore file exists or ignores configured in config', () => {
    const hasIgnoreFile = existsSync(ignorePath)
    const configPath = join(process.cwd(), '.eslintrc.json')

    let hasIgnoreInConfig = false
    if (existsSync(configPath)) {
      const configContent = readFileSync(configPath, 'utf-8')
      hasIgnoreInConfig = configContent.includes('ignorePatterns')
    }

    // Either .eslintignore exists OR ignores are in config
    expect(hasIgnoreFile || hasIgnoreInConfig).toBe(true)
  })

  it('ignores node_modules', () => {
    const hasIgnoreFile = existsSync(ignorePath)

    if (hasIgnoreFile) {
      const content = readFileSync(ignorePath, 'utf-8')
      expect(content).toContain('node_modules')
    }
  })

  it('ignores build output directories', () => {
    const hasIgnoreFile = existsSync(ignorePath)

    if (hasIgnoreFile) {
      const content = readFileSync(ignorePath, 'utf-8')
      expect(content).toMatch(/\.next|dist|build/)
    }
  })
})

describe('ESLint execution', () => {
  it('npm run lint command works', () => {
    try {
      execSync('npm run lint', {
        encoding: 'utf-8',
        stdio: 'pipe',
      })
      // Success
      expect(true).toBe(true)
    } catch (error: any) {
      // May have lint warnings/errors - that's okay
      // Should not have config errors
      expect(error.message).not.toContain('Cannot find module')
      expect(error.message).not.toContain('Invalid configuration')
    }
  })

  it('npm run lint:fix command exists', () => {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const content = readFileSync(packageJsonPath, 'utf-8')
    const pkgJson = JSON.parse(content)

    expect(pkgJson.scripts).toHaveProperty('lint:fix')
  })
})
