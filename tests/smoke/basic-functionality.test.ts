/**
 * Smoke Tests - Basic Functionality
 *
 * These are quick tests that verify critical functionality works.
 * They should run in under 30 seconds and catch major breakage.
 * Run these before deployment as a final sanity check.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

describe('Project structure smoke tests', () => {
  it('package.json exists and is valid', () => {
    const pkgJsonPath = join(process.cwd(), 'package.json')
    expect(existsSync(pkgJsonPath)).toBe(true)

    const content = readFileSync(pkgJsonPath, 'utf-8')
    const pkgJson = JSON.parse(content)

    expect(pkgJson.name).toBe('keyflash')
    expect(pkgJson.version).toBeDefined()
  })

  it('critical directories exist', () => {
    const dirs = ['docs', '.github', '.github/workflows', '.husky', 'tests']

    for (const dir of dirs) {
      const dirPath = join(process.cwd(), dir)
      expect(existsSync(dirPath)).toBe(true)
    }
  })

  it('critical configuration files exist', () => {
    const files = [
      'package.json',
      '.prettierrc',
      '.prettierignore',
      '.eslintrc.json',
      'tsconfig.json',
      '.gitignore',
      'README.md',
      'vitest.config.ts',
      '.stylelintrc.json',
    ]

    for (const file of files) {
      const filePath = join(process.cwd(), file)
      if (!existsSync(filePath)) {
        throw new Error(`Missing critical file: ${file}`)
      }
      expect(existsSync(filePath)).toBe(true)
    }
  })
})

describe('Dependencies smoke tests', () => {
  it('all critical dependencies are installed', () => {
    const pkgJsonPath = join(process.cwd(), 'package.json')
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))

    // Production dependencies
    const criticalDeps = ['zod', '@upstash/redis']

    // Dev dependencies (includes Next.js, React, etc.)
    const criticalDevDeps = [
      'next',
      'react',
      'react-dom',
      'typescript',
      'eslint',
      'prettier',
      'vitest',
      '@playwright/test',
      'husky',
      'lint-staged',
    ]

    for (const dep of criticalDeps) {
      expect(pkgJson.dependencies).toHaveProperty(dep)
    }

    for (const dep of criticalDevDeps) {
      expect(pkgJson.devDependencies).toHaveProperty(dep)
    }
  })

  it('node version requirement is correct', () => {
    const pkgJsonPath = join(process.cwd(), 'package.json')
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))

    expect(pkgJson.engines).toHaveProperty('node')
    expect(pkgJson.engines.node).toContain('20')
  })
})

describe('Scripts smoke tests', () => {
  it('all critical npm scripts are defined', () => {
    const pkgJsonPath = join(process.cwd(), 'package.json')
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))

    const criticalScripts = [
      'dev',
      'build',
      'start',
      'test',
      'lint',
      'format',
      'format:check',
    ]

    for (const script of criticalScripts) {
      expect(pkgJson.scripts).toHaveProperty(script)
      expect(pkgJson.scripts[script]).toBeTruthy()
    }
  })

  it('security scripts are defined', () => {
    const pkgJsonPath = join(process.cwd(), 'package.json')
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))

    expect(pkgJson.scripts).toHaveProperty('security:audit')
    expect(pkgJson.scripts).toHaveProperty('security:secrets')
  })
})

describe('Quality automation smoke tests', () => {
  it('GitHub Actions workflow is valid YAML', () => {
    const workflowPath = join(process.cwd(), '.github/workflows/quality.yml')
    expect(existsSync(workflowPath)).toBe(true)

    const content = readFileSync(workflowPath, 'utf-8')

    // Basic YAML validation
    expect(content).toContain('name:')
    expect(content).toContain('on:')
    expect(content).toContain('jobs:')
    expect(content).not.toContain('\t') // No tabs in YAML
  })

  it('pre-commit hook is configured', () => {
    const hookPath = join(process.cwd(), '.husky/pre-commit')
    expect(existsSync(hookPath)).toBe(true)

    const content = readFileSync(hookPath, 'utf-8')
    expect(content).toContain('lint-staged')
  })

  it('lint-staged is configured', () => {
    const pkgJsonPath = join(process.cwd(), 'package.json')
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))

    expect(pkgJson).toHaveProperty('lint-staged')
    expect(typeof pkgJson['lint-staged']).toBe('object')
  })
})

describe('Documentation smoke tests', () => {
  it('critical documentation files exist', () => {
    const docs = [
      'README.md',
      'LICENSE',
      'docs/REQUIREMENTS.md',
      'docs/ARCHITECTURE.md',
      'docs/SECURITY.md',
      'docs/TESTING_STRATEGY.md',
    ]

    for (const doc of docs) {
      const docPath = join(process.cwd(), doc)
      expect(existsSync(docPath)).toBe(true)
    }
  })

  it('README has essential content', () => {
    const readmePath = join(process.cwd(), 'README.md')
    const content = readFileSync(readmePath, 'utf-8')

    // Should mention KeyFlash
    expect(content.toLowerCase()).toContain('keyflash')

    // Should have features section
    expect(content).toMatch(/##.*[Ff]eatures/i)
  })

  it('LICENSE exists and is valid', () => {
    const licensePath = join(process.cwd(), 'LICENSE')
    const content = readFileSync(licensePath, 'utf-8')

    // KeyFlash uses MIT license (open source)
    expect(content).toContain('MIT License')
    expect(content).toContain('Vibe Build Lab')
  })
})

describe('Security configuration smoke tests', () => {
  it('gitignore includes sensitive files', () => {
    const gitignorePath = join(process.cwd(), '.gitignore')
    const content = readFileSync(gitignorePath, 'utf-8')

    // Should ignore environment files
    expect(content).toMatch(/\.env/)

    // Should ignore node_modules
    expect(content).toContain('node_modules')

    // Should ignore build outputs
    expect(content).toMatch(/\.next|dist|build/)
  })

  it('no dangerous .env files are committed', () => {
    // .env.local is allowed for development (excluded by .gitignore)
    const dangerousFiles = ['.env', '.env.production']

    for (const file of dangerousFiles) {
      const filePath = join(process.cwd(), file)
      expect(existsSync(filePath)).toBe(false)
    }
  })

  it('env.example exists as template', () => {
    const examplePath = join(process.cwd(), '.env.example')
    expect(existsSync(examplePath)).toBe(true)
  })
})

describe('TypeScript configuration smoke tests', () => {
  // Helper to strip JSON comments (tsconfig.json supports JSONC format)
  // This handles comments correctly by skipping content inside strings
  const stripJsonComments = (jsonString: string): string => {
    let result = ''
    let inString = false
    let inComment = false
    let commentType: 'single' | 'multi' | null = null

    for (let i = 0; i < jsonString.length; i++) {
      const char = jsonString[i]
      const nextChar = jsonString[i + 1]

      if (inComment) {
        if (commentType === 'single' && char === '\n') {
          inComment = false
          commentType = null
          result += char // Keep newline for line structure
        } else if (
          commentType === 'multi' &&
          char === '*' &&
          nextChar === '/'
        ) {
          inComment = false
          commentType = null
          i++ // Skip the closing /
        }
        continue
      }

      if (inString) {
        result += char
        if (char === '\\') {
          // Skip escaped character
          result += jsonString[++i]
        } else if (char === '"') {
          inString = false
        }
        continue
      }

      // Not in string or comment
      if (char === '"') {
        inString = true
        result += char
      } else if (char === '/' && nextChar === '/') {
        inComment = true
        commentType = 'single'
        i++ // Skip the second /
      } else if (char === '/' && nextChar === '*') {
        inComment = true
        commentType = 'multi'
        i++ // Skip the *
      } else {
        result += char
      }
    }
    return result
  }

  it('tsconfig.json exists and is valid', () => {
    const tsconfigPath = join(process.cwd(), 'tsconfig.json')
    expect(existsSync(tsconfigPath)).toBe(true)

    const content = readFileSync(tsconfigPath, 'utf-8')
    const tsconfig = JSON.parse(stripJsonComments(content))

    expect(tsconfig.compilerOptions).toBeDefined()
  })

  it('TypeScript strict mode is enabled', () => {
    const tsconfigPath = join(process.cwd(), 'tsconfig.json')
    const content = readFileSync(tsconfigPath, 'utf-8')
    const tsconfig = JSON.parse(stripJsonComments(content))

    // Strict mode should be enabled for better type safety
    expect(tsconfig.compilerOptions.strict).toBe(true)
  })
})

describe('Test infrastructure smoke tests', () => {
  it('test directory exists with structure', () => {
    const testDirs = [
      'tests',
      'tests/helpers',
      'tests/command-execution',
      'tests/quality-automation',
      'tests/config-validation',
      'tests/smoke',
    ]

    for (const dir of testDirs) {
      const dirPath = join(process.cwd(), dir)
      expect(existsSync(dirPath)).toBe(true)
    }
  })

  it('test helper utilities exist', () => {
    const helpers = [
      'tests/helpers/isolated-test-env.ts',
      'tests/helpers/test-setup.ts',
    ]

    for (const helper of helpers) {
      const helperPath = join(process.cwd(), helper)
      expect(existsSync(helperPath)).toBe(true)
    }
  })
})
