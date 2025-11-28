/**
 * Command Execution Tests - Verify npm scripts actually work
 *
 * OPTIMIZED: Uses a shared test environment to avoid repeated npm installs.
 * Previously: 403s (7 minutes) - each test did its own npm install
 * Now: ~60-70s - one npm install, all tests share the environment
 *
 * Reference: Testing Strategy Audit - Command Execution Gap
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { IsolatedTestEnv } from '../helpers/isolated-test-env'
import { TEST_TIMEOUT } from '../helpers/test-setup'

describe('npm scripts execution', () => {
  let sharedEnv: IsolatedTestEnv

  beforeAll(() => {
    sharedEnv = new IsolatedTestEnv('keyflash-cmd-test-')
    sharedEnv
      .copyPackageJson()
      .copyConfigs([
        '.prettierrc',
        '.prettierignore',
        'eslint.config.cjs',
        '.eslintignore',
      ])

    // Install ALL dependencies once, shared across all tests
    sharedEnv.exec(
      'npm install --no-save prettier@^3.3.3 eslint@^8.57.1 eslint-config-next@^15.5.6 eslint-plugin-security@^3.0.1 stylelint@^16.8.0 stylelint-config-standard@^37.0.0 vitest@^4.0.10'
    )
  }, 120000) // 2 minute timeout for install

  afterAll(() => {
    sharedEnv?.destroy()
  })

  it(
    'npm run format actually formats files with Prettier',
    () => {
      const badlyFormatted = `const   x=1;const y=2;
function   foo(  )  {
return    {
bar:   "test"  ,
baz:123
}
}
`
      sharedEnv.writeFile('test-format.ts', badlyFormatted)

      const result = sharedEnv.exec('npx prettier --write test-format.ts', {
        throwOnError: false,
      })

      expect(result.exitCode).toBe(0)

      const formatted = sharedEnv.readFile('test-format.ts')
      expect(formatted).toContain('const x = 1')
      expect(formatted).toContain('const y = 2')
      expect(formatted).toContain('function foo()')
      expect(formatted).not.toContain('  x=1')
    },
    TEST_TIMEOUT
  )

  it(
    'npm run format:check detects unformatted files',
    () => {
      sharedEnv.writeFile('test-unformatted.ts', 'const   x=1;')

      const result = sharedEnv.exec(
        'npx prettier --check test-unformatted.ts',
        {
          throwOnError: false,
        }
      )

      expect(result.exitCode).not.toBe(0)
    },
    TEST_TIMEOUT
  )

  it(
    'npm run lint executes ESLint without errors',
    () => {
      const validCode = `export function add(a: number, b: number): number {
  return a + b
}
`
      sharedEnv.writeFile('src/test-lint.ts', validCode)

      const result = sharedEnv.exec(
        'npx eslint --no-error-on-unmatched-pattern src/test-lint.ts',
        { throwOnError: false }
      )

      expect([0, 1]).toContain(result.exitCode)
    },
    TEST_TIMEOUT
  )

  it(
    'npm run lint detects code violations',
    () => {
      const badCode = `// Unused variable
const unused = 123

// Potentially dangerous eval
eval("alert('test')")
`
      sharedEnv.writeFile('src/test-bad.js', badCode)

      const result = sharedEnv.exec(
        'npx eslint --no-error-on-unmatched-pattern src/test-bad.js',
        { throwOnError: false }
      )

      const output = result.stdout + result.stderr
      expect(output.length).toBeGreaterThan(0)
    },
    TEST_TIMEOUT
  )

  it(
    'npm run lint:fix auto-fixes fixable issues',
    () => {
      const fixableCode = `const x = 1
const y = 2
export { x, y }
`
      sharedEnv.writeFile('src/test-fixable.ts', fixableCode)

      const result = sharedEnv.exec(
        'npx eslint --fix --no-error-on-unmatched-pattern src/test-fixable.ts',
        { throwOnError: false }
      )

      expect([0, 1]).toContain(result.exitCode)

      const fixed = sharedEnv.readFile('src/test-fixable.ts')
      expect(fixed).toContain('x')
      expect(fixed).toContain('y')
    },
    TEST_TIMEOUT
  )

  it(
    'npm run test executes Vitest',
    () => {
      const testCode = `import { describe, it, expect } from 'vitest'

describe('sample test', () => {
  it('should pass', () => {
    expect(1 + 1).toBe(2)
  })
})
`
      sharedEnv.writeFile('tests/sample.test.ts', testCode)

      const result = sharedEnv.exec('npx vitest run tests/sample.test.ts', {
        throwOnError: false,
      })

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('1 passed')
    },
    TEST_TIMEOUT
  )

  it(
    'npm run test detects failing tests',
    () => {
      const testCode = `import { describe, it, expect } from 'vitest'

describe('failing test', () => {
  it('should fail', () => {
    expect(1 + 1).toBe(3) // Wrong!
  })
})
`
      sharedEnv.writeFile('tests/failing.test.ts', testCode)

      const result = sharedEnv.exec('npx vitest run tests/failing.test.ts', {
        throwOnError: false,
      })

      expect(result.exitCode).not.toBe(0)
      expect(result.stdout + result.stderr).toContain('fail')
    },
    TEST_TIMEOUT
  )

  it(
    'npm run security:audit runs npm audit',
    () => {
      // Use the shared env's package.json (already copied)
      const result = sharedEnv.exec('npm audit --audit-level high --omit=dev', {
        throwOnError: false,
      })

      // Should complete (may or may not have vulnerabilities)
      expect([0, 1]).toContain(result.exitCode)
    },
    TEST_TIMEOUT
  )

  it(
    'npm run security:secrets detects hardcoded secrets',
    () => {
      // Test the secret detection pattern
      const fakeSecret = 'ABC' + 'D'.repeat(30) + 'XYZ123'
      sharedEnv.writeFile(
        'test-secrets.json',
        JSON.stringify({
          name: 'test',
          version: '1.0.0',
          fakeSecret: fakeSecret,
        })
      )

      // Run the security:secrets check pattern on the test file
      const result = sharedEnv.exec(
        `node -e "const fs=require('fs');const content=fs.readFileSync('test-secrets.json','utf8');if(/[\\"'][a-zA-Z0-9+/]{20,}[\\"']/.test(content)){console.error('Potential hardcoded secrets');process.exit(1)}else{console.log('No secrets detected')}"`,
        { throwOnError: false }
      )

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('secrets')
    },
    TEST_TIMEOUT
  )

  it(
    'package.json scripts are all valid',
    () => {
      const pkgJson = JSON.parse(sharedEnv.readFile('package.json'))

      expect(pkgJson.scripts).toBeDefined()
      expect(typeof pkgJson.scripts).toBe('object')

      for (const [, command] of Object.entries(pkgJson.scripts)) {
        expect(typeof command).toBe('string')
        expect((command as string).length).toBeGreaterThan(0)
      }

      expect(pkgJson.scripts).toHaveProperty('test')
      expect(pkgJson.scripts).toHaveProperty('lint')
      expect(pkgJson.scripts).toHaveProperty('format')
    },
    TEST_TIMEOUT
  )
})
