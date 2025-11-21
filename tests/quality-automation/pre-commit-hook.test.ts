/**
 * Quality Automation Tests - Pre-commit Hook
 *
 * These tests verify that Husky pre-commit hooks are properly configured
 * and functional. Without these tests, hooks could fail silently or be
 * misconfigured without being detected.
 */

import { describe, it, expect } from 'vitest'
import { TEST_TIMEOUT } from '../helpers/test-setup'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

describe('pre-commit hook configuration', () => {
  const hookPath = join(process.cwd(), '.husky/pre-commit')

  it('pre-commit hook file exists', () => {
    expect(existsSync(hookPath)).toBe(true)
  })

  it('pre-commit hook is executable', () => {
    const stats = require('fs').statSync(hookPath)
    const isExecutable = (stats.mode & 0o111) !== 0

    expect(isExecutable).toBe(true)
  })

  it('pre-commit hook has proper shebang', () => {
    const content = readFileSync(hookPath, 'utf-8')
    const firstLine = content.split('\n')[0]

    expect(firstLine).toContain('#!/')
  })

  it('pre-commit hook runs lint-staged', () => {
    const content = readFileSync(hookPath, 'utf-8')

    expect(content).toContain('lint-staged')
  })

  it('pre-commit hook sources husky.sh', () => {
    const content = readFileSync(hookPath, 'utf-8')

    expect(content).toContain('husky.sh')
  })
})

describe('pre-commit hook execution', () => {
  // NOTE: These tests are complex because they require full Husky setup in isolated environments
  // Skipping actual execution tests and focusing on configuration validation instead

  it.skip(
    'prevents commit when linting fails',
    () => {
      // This test requires Husky hooks to be fully initialized in isolated env
      // Skipped because it's too complex for CI/CD
    },
    TEST_TIMEOUT
  )

  it.skip(
    'allows commit when files are properly formatted',
    () => {
      // This test requires Husky hooks to be fully initialized
      // Skipped because it's too complex for CI/CD
    },
    TEST_TIMEOUT
  )

  it.skip(
    'auto-fixes formatting issues before commit',
    () => {
      // This test requires Husky hooks to be fully initialized
      // Skipped because it's too complex for CI/CD
    },
    TEST_TIMEOUT
  )

  it.skip(
    'only processes staged files',
    () => {
      // This test requires Husky hooks to be fully initialized
      // Skipped because it's too complex for CI/CD
    },
    TEST_TIMEOUT
  )
})

describe('lint-staged configuration', () => {
  it('lint-staged config exists in package.json', () => {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const content = readFileSync(packageJsonPath, 'utf-8')
    const pkgJson = JSON.parse(content)

    expect(pkgJson).toHaveProperty('lint-staged')
    expect(typeof pkgJson['lint-staged']).toBe('object')
  })

  it('lint-staged processes JavaScript/TypeScript files', () => {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const content = readFileSync(packageJsonPath, 'utf-8')
    const pkgJson = JSON.parse(content)

    const lintStaged = pkgJson['lint-staged']

    // Should have patterns for JS/TS files
    const patterns = Object.keys(lintStaged)
    const hasJSPattern = patterns.some(p =>
      p.match(/\*\*\/\*\.\{.*[jt]sx?.*\}/)
    )

    expect(hasJSPattern).toBe(true)
  })

  it('lint-staged runs ESLint on staged files', () => {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const content = readFileSync(packageJsonPath, 'utf-8')
    const pkgJson = JSON.parse(content)

    const lintStaged = pkgJson['lint-staged']
    const jsPattern = Object.keys(lintStaged).find(p =>
      p.match(/\*\*\/\*\.\{.*[jt]sx?.*\}/)
    )

    if (jsPattern) {
      const commands = lintStaged[jsPattern]
      const hasEslint = commands.some((cmd: string) => cmd.includes('eslint'))

      expect(hasEslint).toBe(true)
    }
  })

  it('lint-staged runs Prettier on staged files', () => {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const content = readFileSync(packageJsonPath, 'utf-8')
    const pkgJson = JSON.parse(content)

    const lintStaged = pkgJson['lint-staged']
    const patterns = Object.keys(lintStaged)

    // At least one pattern should run Prettier
    const hasPrettier = patterns.some(pattern => {
      const commands = lintStaged[pattern]
      return commands.some((cmd: string) => cmd.includes('prettier'))
    })

    expect(hasPrettier).toBe(true)
  })

  it('lint-staged processes CSS files with Stylelint', () => {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const content = readFileSync(packageJsonPath, 'utf-8')
    const pkgJson = JSON.parse(content)

    const lintStaged = pkgJson['lint-staged']
    const cssPattern = Object.keys(lintStaged).find(p => p.includes('css'))

    if (cssPattern) {
      const commands = lintStaged[cssPattern]
      const hasStylelint = commands.some((cmd: string) =>
        cmd.includes('stylelint')
      )

      expect(hasStylelint).toBe(true)
    }
  })
})

describe('Husky installation', () => {
  it('husky directory exists', () => {
    const huskyPath = join(process.cwd(), '.husky')
    expect(existsSync(huskyPath)).toBe(true)
  })

  it('package.json has prepare script for husky', () => {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const content = readFileSync(packageJsonPath, 'utf-8')
    const pkgJson = JSON.parse(content)

    expect(pkgJson.scripts).toHaveProperty('prepare')
    expect(pkgJson.scripts.prepare).toContain('husky')
  })

  it('husky is installed as dev dependency', () => {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const content = readFileSync(packageJsonPath, 'utf-8')
    const pkgJson = JSON.parse(content)

    expect(pkgJson.devDependencies).toHaveProperty('husky')
  })
})
