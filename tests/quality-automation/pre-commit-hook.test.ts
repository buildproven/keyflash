/**
 * Quality Automation Tests - Pre-commit Hook
 *
 * These tests verify that Husky pre-commit hooks are properly configured
 * and functional. Without these tests, hooks could fail silently or be
 * misconfigured without being detected.
 */

import { describe, it, expect } from 'vitest'
import { IsolatedTestEnv } from '../helpers/isolated-test-env'
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

  it('pre-commit hook uses valid shell format', () => {
    const content = readFileSync(hookPath, 'utf-8')

    // Husky v9+ uses a simpler format without sourcing husky.sh
    // Just verify it has shell commands
    expect(content).toMatch(/npm|npx|lint-staged/)
  })
})

describe('pre-commit hook execution', () => {
  // Opt-in for slow hook execution tests (default skip to keep suite fast/stable)
  // Run with: RUN_PRECOMMIT_TESTS=true npm run test
  const shouldSkip = process.env.RUN_PRECOMMIT_TESTS !== 'true'

  // NOTE: These tests are slow (30+ seconds) because they install npm packages
  // They verify that pre-commit hooks actually execute, not just that config exists

  it.skipIf(shouldSkip)(
    'prevents commit when linting fails',
    () => {
      const env = new IsolatedTestEnv()
      try {
        env
          .gitInit()
          .copyPackageJson()
          .copyConfigs(['.eslintrc.json', '.prettierrc', '.husky/pre-commit'])

        // Install dependencies (slow)
        env.exec('npm install --no-save husky@^9.1.7 lint-staged@^15.3.0')
        env.exec('npm install --no-save prettier@^3.3.3 eslint@^8.57.1')

        // Initialize Husky
        env.exec('npx husky install')
        env.exec('git config core.hooksPath .husky')
        env.exec('chmod +x .husky/pre-commit')

        // Create lint-staged config in separate file to avoid node_modules conflicts
        const lintStagedConfig = {
          '*.{js,ts,tsx}': ['eslint'],
        }
        env.writeFile(
          '.lintstagedrc.json',
          JSON.stringify(lintStagedConfig, null, 2)
        )

        // Create a file with linting errors
        const badCode = `eval("alert('xss')")`
        env.writeFile('test.js', badCode)

        // Try to commit - should fail due to lint errors
        env.exec('git add test.js')
        const result = env.exec('git commit -m "test commit"', {
          throwOnError: false,
        })

        // Commit should fail
        expect(result.exitCode).not.toBe(0)
      } finally {
        env.destroy()
      }
    },
    60000
  )

  it.skipIf(shouldSkip)(
    'allows commit when files are properly formatted',
    () => {
      const env = new IsolatedTestEnv()
      try {
        env
          .gitInit()
          .copyPackageJson()
          .copyConfigs(['.eslintrc.json', '.prettierrc', '.husky/pre-commit'])

        // Install dependencies (slow)
        env.exec('npm install --no-save husky@^9.1.7 lint-staged@^15.3.0')
        env.exec('npm install --no-save prettier@^3.3.3 eslint@^8.57.1')

        // Initialize Husky
        env.exec('npx husky install')
        env.exec('git config core.hooksPath .husky')
        env.exec('chmod +x .husky/pre-commit')

        // Create lint-staged config in separate file to avoid node_modules conflicts
        const lintStagedConfig = {
          '*.{js,ts,tsx}': ['prettier --list-different'],
        }
        env.writeFile(
          '.lintstagedrc.json',
          JSON.stringify(lintStagedConfig, null, 2)
        )

        // Create a valid, properly formatted file
        const goodCode = `export function add(a, b) {\n  return a + b\n}\n`
        env.writeFile('test.js', goodCode)

        // Commit should succeed
        env.exec('git add test.js')
        const result = env.exec('git commit -m "test commit"', {
          throwOnError: false,
        })

        // Commit should succeed
        expect(result.exitCode).toBe(0)
      } finally {
        env.destroy()
      }
    },
    60000
  )

  it.skipIf(shouldSkip)(
    'auto-fixes formatting issues before commit',
    () => {
      const env = new IsolatedTestEnv()
      try {
        env
          .gitInit()
          .copyPackageJson()
          .copyConfigs(['.prettierrc', '.husky/pre-commit'])

        // Install dependencies (slow)
        env.exec('npm install --no-save husky@^9.1.7 lint-staged@^15.3.0')
        env.exec('npm install --no-save prettier@^3.3.3')

        // Initialize Husky
        env.exec('npx husky install')
        env.exec('git config core.hooksPath .husky')
        env.exec('chmod +x .husky/pre-commit')

        // Create lint-staged config in separate file to avoid node_modules conflicts
        const lintStagedConfig = {
          '*.{js,ts,tsx}': ['prettier --write'],
        }
        env.writeFile(
          '.lintstagedrc.json',
          JSON.stringify(lintStagedConfig, null, 2)
        )

        // Create badly formatted file
        const badlyFormatted = `const   x=1;const y=2;`
        env.writeFile('test.js', badlyFormatted)

        // Commit
        env.exec('git add test.js')
        env.exec('git commit -m "test commit"')

        // File should be auto-formatted
        const formatted = env.readFile('test.js')
        expect(formatted).toContain('const x = 1')
        expect(formatted).toContain('const y = 2')
      } finally {
        env.destroy()
      }
    },
    60000
  )

  it.skipIf(shouldSkip)(
    'only processes staged files',
    () => {
      const env = new IsolatedTestEnv()
      try {
        env
          .gitInit()
          .copyPackageJson()
          .copyConfigs(['.prettierrc', '.husky/pre-commit'])

        // Install dependencies (slow)
        env.exec('npm install --no-save husky@^9.1.7 lint-staged@^15.3.0')
        env.exec('npm install --no-save prettier@^3.3.3')

        // Initialize Husky
        env.exec('npx husky install')
        env.exec('git config core.hooksPath .husky')
        env.exec('chmod +x .husky/pre-commit')

        // Create lint-staged config in separate file to avoid node_modules conflicts
        const lintStagedConfig = {
          '*.js': ['prettier --write'],
        }
        env.writeFile(
          '.lintstagedrc.json',
          JSON.stringify(lintStagedConfig, null, 2)
        )

        // Create two files - only stage one
        const badlyFormatted = `const   x=1;`
        env.writeFile('staged.js', badlyFormatted)
        env.writeFile('unstaged.js', badlyFormatted)

        // Only stage one file
        env.exec('git add staged.js')
        env.exec('git commit -m "test commit"')

        // Staged file should be formatted
        const staged = env.readFile('staged.js')
        expect(staged).toContain('const x = 1')

        // Unstaged file should NOT be formatted
        const unstaged = env.readFile('unstaged.js')
        expect(unstaged).toBe(badlyFormatted)
      } finally {
        env.destroy()
      }
    },
    60000
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
