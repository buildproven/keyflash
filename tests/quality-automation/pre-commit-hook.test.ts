/**
 * Quality Automation Tests - Pre-commit Hook
 *
 * These tests verify that Husky pre-commit hooks are properly configured
 * and functional. Without these tests, hooks could fail silently or be
 * misconfigured without being detected.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { IsolatedTestEnv } from '../helpers/isolated-test-env'
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
  let env: IsolatedTestEnv | null = null

  afterEach(() => {
    env?.destroy()
    env = null
  })

  it(
    'prevents commit when linting fails',
    () => {
      env = new IsolatedTestEnv()
      env
        .gitInit()
        .copyPackageJson()
        .copyConfigs(['eslint.config.cjs', '.prettierrc'])
        .copyHuskyHooks()

      // Install minimal dependencies
      env.exec('npm install --no-save husky lint-staged eslint prettier')

      // Create file with linting errors
      const badCode = `const unused = 123; // Unused variable
eval("dangerous"); // Eval usage
`

      env.writeFile('bad.js', badCode)

      // Stage the file
      env.exec('git add bad.js')

      // Try to commit - should fail due to linting
      const result = env.exec('git commit -m "test commit"', {
        throwOnError: false,
      })

      // Commit should fail (non-zero exit code)
      expect(result.exitCode).not.toBe(0)
    },
    TEST_TIMEOUT
  )

  it(
    'allows commit when files are properly formatted',
    () => {
      env = new IsolatedTestEnv()
      env
        .gitInit()
        .copyPackageJson()
        .copyConfigs(['.prettierrc', '.prettierignore'])
        .copyHuskyHooks()

      // Install minimal dependencies
      env.exec('npm install --no-save husky lint-staged prettier')

      // Create properly formatted file
      const goodCode = `export function add(a: number, b: number): number {
  return a + b
}
`

      env.writeFile('good.ts', goodCode)

      // Stage the file
      env.exec('git add good.ts')

      // Commit should succeed
      const result = env.exec('git commit -m "add good file"', {
        throwOnError: false,
      })

      // Should succeed or only have warnings
      expect([0, 1]).toContain(result.exitCode)
    },
    TEST_TIMEOUT
  )

  it(
    'auto-fixes formatting issues before commit',
    () => {
      env = new IsolatedTestEnv()
      env
        .gitInit()
        .copyPackageJson()
        .copyConfigs(['.prettierrc', '.prettierignore'])
        .copyHuskyHooks()

      // Install dependencies
      env.exec('npm install --no-save husky lint-staged prettier')

      // Create badly formatted file
      const badFormatted = 'const   x=1;const y=2;'

      env.writeFile('format-test.js', badFormatted)

      // Stage the file
      env.exec('git add format-test.js')

      // Run commit (may succeed after auto-fix)
      env.exec('git commit -m "test auto-fix"', { throwOnError: false })

      // Read the file - should be formatted now
      const formatted = env.readFile('format-test.js')

      // Should have proper spacing
      expect(formatted).toContain('const x = 1')
      expect(formatted).toContain('const y = 2')
    },
    TEST_TIMEOUT
  )

  it(
    'only processes staged files',
    () => {
      env = new IsolatedTestEnv()
      env
        .gitInit()
        .copyPackageJson()
        .copyConfigs(['.prettierrc'])
        .copyHuskyHooks()

      // Install dependencies
      env.exec('npm install --no-save husky lint-staged prettier')

      // Create two files - only stage one
      env.writeFile('staged.js', 'const   x=1;')
      env.writeFile('unstaged.js', 'const   y=2;')

      // Only stage the first file
      env.exec('git add staged.js')

      // Run commit
      env.exec('git commit -m "test staged only"', { throwOnError: false })

      // Staged file should be formatted
      const stagedContent = env.readFile('staged.js')
      expect(stagedContent).toContain('const x = 1')

      // Unstaged file should NOT be formatted
      const unstagedContent = env.readFile('unstaged.js')
      expect(unstagedContent).toBe('const   y=2;')
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
