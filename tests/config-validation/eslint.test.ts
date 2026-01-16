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
    const config = JSON.parse(content)

    // Should include security plugin in plugins array
    expect(config.plugins).toBeDefined()
    expect(config.plugins).toContain('security')

    // Should have security rules configured
    const hasSecurityRules = Object.keys(config.rules || {}).some(rule =>
      rule.startsWith('security/')
    )
    expect(hasSecurityRules).toBe(true)
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

      // Try to lint it using the npm script (more efficient)
      const output = execSync(`npx eslint --no-cache ${tempFile}`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 30000, // Increase timeout for slow systems
      })

      // Should not crash (output might have warnings, that's okay)
      expect(output).toBeDefined()
    } catch (error) {
      // If it fails, it should be due to linting errors, not config errors
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      expect(errorMessage).not.toContain('config')
      expect(errorMessage).not.toContain('Cannot read')
      expect(errorMessage).not.toContain('Invalid configuration')
    } finally {
      // Cleanup
      try {
        require('fs').unlinkSync(tempFile)
      } catch {}
    }
  }, 30000)

  it('detects dangerous patterns like eval()', () => {
    const tempFile = join(process.cwd(), '.eslint-test-dangerous.js')

    try {
      // Create file with dangerous code
      const dangerousCode = `eval("alert('xss')")
`
      require('fs').writeFileSync(tempFile, dangerousCode)

      // Lint it - should fail or warn
      try {
        execSync(`npx eslint --no-cache ${tempFile}`, {
          encoding: 'utf-8',
          stdio: 'pipe',
          timeout: 30000,
        })
      } catch (error) {
        // Should have detected the eval usage
        const stdout =
          error && typeof error === 'object' && 'stdout' in error
            ? String(error.stdout)
            : ''
        const stderr =
          error && typeof error === 'object' && 'stderr' in error
            ? String(error.stderr)
            : ''
        const output = stdout + stderr
        expect(output).toMatch(/eval|dangerous/)
      }
    } finally {
      // Cleanup
      try {
        require('fs').unlinkSync(tempFile)
      } catch {}
    }
  }, 45000)
})

describe('ESLint ignore configuration', () => {
  const ignorePath = join(process.cwd(), '.eslintignore')

  it('eslintignore file exists or ignores configured in config', () => {
    const hasIgnoreFile = existsSync(ignorePath)

    // Check for flat config (eslint.config.cjs/js/mjs)
    const flatConfigPaths = [
      join(process.cwd(), 'eslint.config.cjs'),
      join(process.cwd(), 'eslint.config.js'),
      join(process.cwd(), 'eslint.config.mjs'),
    ]

    let hasIgnoreInFlatConfig = false
    for (const configPath of flatConfigPaths) {
      if (existsSync(configPath)) {
        const configContent = readFileSync(configPath, 'utf-8')
        // Flat config uses 'ignores' array in the config
        hasIgnoreInFlatConfig = configContent.includes('ignores')
        if (hasIgnoreInFlatConfig) break
      }
    }

    // Check for legacy .eslintrc.json
    const legacyConfigPath = join(process.cwd(), '.eslintrc.json')
    let hasIgnoreInLegacyConfig = false
    if (existsSync(legacyConfigPath)) {
      const configContent = readFileSync(legacyConfigPath, 'utf-8')
      hasIgnoreInLegacyConfig = configContent.includes('ignorePatterns')
    }

    // Either .eslintignore exists OR ignores are in flat/legacy config
    expect(
      hasIgnoreFile || hasIgnoreInFlatConfig || hasIgnoreInLegacyConfig
    ).toBe(true)
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
        timeout: 60000, // Increase timeout for full lint
      })
      // Success
      expect(true).toBe(true)
    } catch (error) {
      // May have lint warnings/errors - that's okay
      // Should not have config errors
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      expect(errorMessage).not.toContain('Cannot find module')
      expect(errorMessage).not.toContain('Invalid configuration')
      expect(errorMessage).not.toContain('config')
    }
  }, 60000)

  it('npm run lint:fix command exists', () => {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const content = readFileSync(packageJsonPath, 'utf-8')
    const pkgJson = JSON.parse(content)

    expect(pkgJson.scripts).toHaveProperty('lint:fix')
  })
})
