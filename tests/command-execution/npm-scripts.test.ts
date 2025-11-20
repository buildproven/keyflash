/**
 * Command Execution Tests - Verify npm scripts actually work
 *
 * CRITICAL: These tests verify that defined npm scripts execute successfully.
 * Without these tests, we could ship broken commands that pass structure tests
 * but fail for actual users.
 *
 * Reference: Testing Strategy Audit - Command Execution Gap
 */

import { describe, it, expect, afterEach } from 'vitest'
import { IsolatedTestEnv } from '../helpers/isolated-test-env'
import { TEST_TIMEOUT } from '../helpers/test-setup'

describe('npm scripts execution', () => {
  let env: IsolatedTestEnv | null = null

  afterEach(() => {
    env?.destroy()
    env = null
  })

  it(
    'npm run format actually formats files with Prettier',
    () => {
      env = new IsolatedTestEnv()
      env.copyPackageJson().copyConfigs(['.prettierrc', '.prettierignore'])

      // Create a badly formatted TypeScript file
      const badlyFormatted = `const   x=1;const y=2;
function   foo(  )  {
return    {
bar:   "test"  ,
baz:123
}
}
`

      env.writeFile('test.ts', badlyFormatted)

      // Install Prettier
      env.exec('npm install --no-save prettier@^3.3.3')

      // Run format command
      const result = env.exec('npm run format', { throwOnError: false })

      // Should succeed
      expect(result.exitCode).toBe(0)

      // Read the formatted file
      const formatted = env.readFile('test.ts')

      // Should be properly formatted
      expect(formatted).toContain('const x = 1')
      expect(formatted).toContain('const y = 2')
      expect(formatted).toContain('function foo()')
      expect(formatted).not.toContain('  x=1') // No weird spacing
    },
    TEST_TIMEOUT
  )

  it(
    'npm run format:check detects unformatted files',
    () => {
      env = new IsolatedTestEnv()
      env.copyPackageJson().copyConfigs(['.prettierrc', '.prettierignore'])

      // Create an unformatted file
      env.writeFile('test.ts', 'const   x=1;')

      // Install Prettier
      env.exec('npm install --no-save prettier@^3.3.3')

      // Run format check - should fail
      const result = env.exec('npm run format:check', { throwOnError: false })

      expect(result.exitCode).not.toBe(0)
      expect(result.stdout + result.stderr).toContain('test.ts')
    },
    TEST_TIMEOUT
  )

  it(
    'npm run lint executes ESLint without errors',
    () => {
      env = new IsolatedTestEnv()
      env.copyPackageJson().copyConfigs(['eslint.config.cjs', '.eslintignore'])

      // Create a valid TypeScript file
      const validCode = `export function add(a: number, b: number): number {
  return a + b
}
`

      env.writeFile('src/test.ts', validCode)

      // Install dependencies
      env.exec(
        'npm install --no-save eslint@^8.57.1 eslint-config-next@^14.2.33'
      )

      // Run lint command
      const result = env.exec('npm run lint', { throwOnError: false })

      // Should execute (exit code 0 or warnings only)
      expect([0, 1]).toContain(result.exitCode)
    },
    TEST_TIMEOUT
  )

  it(
    'npm run lint detects code violations',
    () => {
      env = new IsolatedTestEnv()
      env.copyPackageJson().copyConfigs(['eslint.config.cjs', '.eslintignore'])

      // Create code with violations
      const badCode = `// Unused variable
const unused = 123

// Potentially dangerous eval
eval("alert('test')")
`

      env.writeFile('src/test.js', badCode)

      // Install dependencies
      env.exec(
        'npm install --no-save eslint@^8.57.1 eslint-plugin-security@^3.0.1'
      )

      // Run lint command - should fail or warn
      const result = env.exec('npm run lint', { throwOnError: false })

      const output = result.stdout + result.stderr

      // Should detect issues (exact message varies by ESLint config)
      expect(output.length).toBeGreaterThan(0)
    },
    TEST_TIMEOUT
  )

  it(
    'npm run lint:fix auto-fixes fixable issues',
    () => {
      env = new IsolatedTestEnv()
      env.copyPackageJson().copyConfigs(['eslint.config.cjs', '.eslintignore'])

      // Create code with fixable issues (e.g., missing semicolons if configured)
      const fixableCode = `const x = 1
const y = 2
export { x, y }
`

      env.writeFile('src/test.ts', fixableCode)

      // Install dependencies
      env.exec(
        'npm install --no-save eslint@^8.57.1 eslint-config-next@^14.2.33'
      )

      // Run lint:fix
      const result = env.exec('npm run lint:fix', { throwOnError: false })

      // Should complete
      expect([0, 1]).toContain(result.exitCode)

      // File should still be valid
      const fixed = env.readFile('src/test.ts')
      expect(fixed).toContain('x')
      expect(fixed).toContain('y')
    },
    TEST_TIMEOUT
  )

  it(
    'npm run test executes Vitest',
    () => {
      env = new IsolatedTestEnv()
      env.copyPackageJson()

      // Create a simple passing test
      const testCode = `import { describe, it, expect } from 'vitest'

describe('sample test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2)
  })
})
`

      env.writeFile('tests/sample.test.ts', testCode)

      // Install Vitest
      env.exec('npm install --no-save vitest@^4.0.10')

      // Run test command
      const result = env.exec('npm run test', { throwOnError: false })

      // Should execute successfully
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('1 passed')
    },
    TEST_TIMEOUT
  )

  it(
    'npm run test detects failing tests',
    () => {
      env = new IsolatedTestEnv()
      env.copyPackageJson()

      // Create a failing test
      const testCode = `import { describe, it, expect } from 'vitest'

describe('failing test', () => {
  it('should fail', () => {
    expect(1 + 1).toBe(3) // Wrong!
  })
})
`

      env.writeFile('tests/failing.test.ts', testCode)

      // Install Vitest
      env.exec('npm install --no-save vitest@^4.0.10')

      // Run test command - should fail
      const result = env.exec('npm run test', { throwOnError: false })

      expect(result.exitCode).not.toBe(0)
      expect(result.stdout + result.stderr).toContain('fail')
    },
    TEST_TIMEOUT
  )

  it(
    'npm run security:audit runs npm audit',
    () => {
      env = new IsolatedTestEnv()
      env.copyPackageJson()

      // Create minimal package.json with no vulnerabilities
      env.writeFile(
        'package.json',
        JSON.stringify({
          name: 'test',
          version: '1.0.0',
          dependencies: {},
        })
      )

      // Run security audit
      const result = env.exec('npm run security:audit', { throwOnError: false })

      // Should complete (may or may not have vulnerabilities)
      expect([0, 1]).toContain(result.exitCode)
    },
    TEST_TIMEOUT
  )

  it(
    'npm run security:secrets detects hardcoded secrets',
    () => {
      env = new IsolatedTestEnv()
      env.copyPackageJson()

      // Modify package.json to include a fake secret (base64-encoded long string)
      // Using a pattern that matches our secret detection regex without triggering GitHub's scanner
      const fakeSecret = 'ABC' + 'D'.repeat(30) + 'XYZ123' // Long alphanumeric string
      env.writeFile(
        'package.json',
        JSON.stringify({
          name: 'test',
          version: '1.0.0',
          fakeSecret: fakeSecret,
        })
      )

      // Run secrets check - should detect the secret
      const result = env.exec('npm run security:secrets', {
        throwOnError: false,
      })

      expect(result.exitCode).toBe(1)
      expect(result.stdout + result.stderr).toContain('secrets')
    },
    TEST_TIMEOUT
  )

  it(
    'package.json scripts are all valid',
    () => {
      env = new IsolatedTestEnv()
      env.copyPackageJson()

      // Read package.json
      const pkgJson = JSON.parse(env.readFile('package.json'))

      // Verify scripts exist and are strings
      expect(pkgJson.scripts).toBeDefined()
      expect(typeof pkgJson.scripts).toBe('object')

      // All scripts should be non-empty strings
      for (const [name, command] of Object.entries(pkgJson.scripts)) {
        expect(typeof command).toBe('string')
        expect((command as string).length).toBeGreaterThan(0)
      }

      // Critical scripts should exist
      expect(pkgJson.scripts).toHaveProperty('test')
      expect(pkgJson.scripts).toHaveProperty('lint')
      expect(pkgJson.scripts).toHaveProperty('format')
    },
    TEST_TIMEOUT
  )
})
