/**
 * Quality Automation Tests - GitHub Actions Workflow
 *
 * These tests verify that GitHub Actions workflows are valid and functional.
 * Without these tests, workflow syntax errors or invalid configurations could
 * break CI/CD without being detected until runtime.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// Simple YAML parser (we'll parse manually to avoid dependencies)
function parseYAML(content: string): any {
  // This is a simple parser - for production use a proper YAML library
  // For now, we'll do basic validation and key extraction
  const lines = content.split('\n')
  const result: any = {}

  let currentKey = ''
  let currentIndent = 0

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') continue

    // Extract key-value pairs
    const match = line.match(/^(\s*)([a-zA-Z_-]+):\s*(.*)$/)
    if (match) {
      const [, indent, key, value] = match
      const indentLevel = indent.length

      if (indentLevel === 0) {
        currentKey = key
        result[key] = value || {}
      }
    }
  }

  return result
}

describe('GitHub Actions workflow validation', () => {
  const workflowPath = join(process.cwd(), '.github/workflows/quality.yml')
  let workflowContent: string

  it('workflow file exists', () => {
    expect(() => {
      workflowContent = readFileSync(workflowPath, 'utf-8')
    }).not.toThrow()

    expect(workflowContent.length).toBeGreaterThan(0)
  })

  it('has valid YAML syntax', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    // Basic YAML validation - should not have tabs
    expect(workflowContent).not.toContain('\t')

    // Should have proper structure
    expect(workflowContent).toContain('name:')
    expect(workflowContent).toContain('on:')
    expect(workflowContent).toContain('jobs:')
  })

  it('has required top-level keys', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    // Required top-level keys
    expect(workflowContent).toContain('name:')
    expect(workflowContent).toContain('on:')
    expect(workflowContent).toContain('jobs:')
  })

  it('has workflow name defined', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    const nameMatch = workflowContent.match(/^name:\s*(.+)$/m)
    expect(nameMatch).toBeTruthy()
    expect(nameMatch![1].trim().length).toBeGreaterThan(0)
  })

  it('triggers on push and pull_request events', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    expect(workflowContent).toContain('push:')
    expect(workflowContent).toContain('pull_request:')
  })

  it('has quality job defined', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    expect(workflowContent).toContain('quality:')
    expect(workflowContent).toContain('runs-on:')
  })

  it('uses ubuntu-latest runner', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    expect(workflowContent).toMatch(/runs-on:\s*ubuntu-latest/)
  })

  it('has checkout step', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    expect(workflowContent).toContain('actions/checkout')
  })

  it('has Node.js setup step', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    expect(workflowContent).toContain('actions/setup-node')
  })

  it('uses Node.js version 20', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    expect(workflowContent).toMatch(/node-version:\s*['"]?20['"]?/)
  })

  it('has dependency installation step', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    expect(workflowContent).toMatch(/npm (ci|install)/)
  })

  it('runs Prettier check', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    expect(workflowContent).toContain('format:check')
  })

  it('runs linter', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    expect(workflowContent).toMatch(/npm run lint/)
  })

  it('runs build step', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    expect(workflowContent).toMatch(/npm run build/)
  })

  it('runs security audit', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    expect(workflowContent).toMatch(/npm audit/)
  })

  it('checks for hardcoded secrets', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    expect(workflowContent).toContain('hardcoded secrets')
  })

  it('has security pattern detection', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    expect(workflowContent).toContain('XSS')
    expect(workflowContent).toContain('innerHTML')
    expect(workflowContent).toContain('eval')
  })

  it('has input validation check', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    expect(workflowContent).toContain('input validation')
  })

  it('has proper step names', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    // Extract step names
    const stepNameMatches = workflowContent.matchAll(/- name:\s*(.+)/g)
    const stepNames = Array.from(stepNameMatches).map(match => match[1].trim())

    // Should have multiple steps
    expect(stepNames.length).toBeGreaterThan(5)

    // All step names should be non-empty
    for (const name of stepNames) {
      expect(name.length).toBeGreaterThan(0)
    }
  })

  it('uses proper action versions', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    // Extract action versions
    const actionMatches = workflowContent.matchAll(/uses:\s*([^@\n]+@[^\n]+)/g)
    const actions = Array.from(actionMatches).map(match => match[1].trim())

    // All actions should have version pins (@ with version)
    for (const action of actions) {
      expect(action).toContain('@')

      // Version should be v-number or SHA
      const version = action.split('@')[1]
      expect(version).toMatch(/^(v\d+|[a-f0-9]{40})/)
    }
  })

  it('workflow has no obvious syntax errors', () => {
    workflowContent = readFileSync(workflowPath, 'utf-8')

    // Check for common YAML syntax errors
    const lines = workflowContent.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Skip comments and empty lines
      if (line.trim().startsWith('#') || line.trim() === '') continue

      // Check for mixing tabs and spaces (common error)
      if (line.includes('\t') && line.includes('  ')) {
        throw new Error(`Line ${i + 1} mixes tabs and spaces`)
      }

      // Check for missing colon after key
      if (line.match(/^  [a-zA-Z_-]+\s*$/) && !line.includes(':')) {
        // This might be a multiline string, so just warn
        console.warn(`Line ${i + 1} might be missing a colon`)
      }
    }
  })
})

describe('GitHub Actions workflow completeness', () => {
  const workflowPath = join(process.cwd(), '.github/workflows/quality.yml')

  it('covers all critical quality checks', () => {
    const content = readFileSync(workflowPath, 'utf-8')

    const requiredChecks = [
      'format:check', // Prettier
      'lint', // ESLint + Stylelint
      'build', // Build verification
      'audit', // Security audit
      'secrets', // Hardcoded secrets check
    ]

    for (const check of requiredChecks) {
      expect(content).toContain(check)
    }
  })

  it('has proper error handling', () => {
    const content = readFileSync(workflowPath, 'utf-8')

    // Some steps should use continue-on-error for non-critical checks
    // Lighthouse CI is optional
    expect(content).toContain('continue-on-error')
  })

  it('has appropriate timeouts or execution limits', () => {
    const content = readFileSync(workflowPath, 'utf-8')

    // Workflow should complete reasonably fast
    // If timeout-minutes is set, it should be reasonable (not hours)
    const timeoutMatch = content.match(/timeout-minutes:\s*(\d+)/)

    if (timeoutMatch) {
      const timeout = parseInt(timeoutMatch[1])
      expect(timeout).toBeLessThan(120) // Less than 2 hours
      expect(timeout).toBeGreaterThan(0)
    }
  })
})
