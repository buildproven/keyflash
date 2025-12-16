/**
 * Test helpers for creating isolated test environments
 * Prevents tests from running against the main project context
 */

import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  readFileSync,
  cpSync,
  mkdirSync,
} from 'fs'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'

export interface IsolatedTestEnvOptions {
  copyPackageJson?: boolean
  copyConfigs?: boolean
  installDependencies?: boolean
  gitInit?: boolean
}

/**
 * Creates an isolated temporary directory for testing
 * This ensures tests run against fresh environments, not the main project
 */
export class IsolatedTestEnv {
  public readonly path: string
  private cleanup: boolean = true

  constructor(prefix: string = 'keyflash-test-') {
    this.path = mkdtempSync(join(tmpdir(), prefix))
  }

  /**
   * Copy package.json to the isolated environment
   */
  copyPackageJson(): this {
    const packageJsonPath = join(process.cwd(), 'package.json')
    const destPath = join(this.path, 'package.json')
    cpSync(packageJsonPath, destPath)
    return this
  }

  /**
   * Copy configuration files to the isolated environment
   */
  copyConfigs(configs: string[] = []): this {
    const defaultConfigs = [
      '.prettierrc',
      '.prettierignore',
      'eslint.config.cjs',
      '.eslintignore',
      '.stylelintrc.json',
      'tsconfig.json',
    ]

    const configsToCopy = configs.length > 0 ? configs : defaultConfigs

    for (const config of configsToCopy) {
      try {
        const srcPath = join(process.cwd(), config)
        const destPath = join(this.path, config)
        cpSync(srcPath, destPath)
      } catch {
        // Config file might not exist yet - that's okay
        console.warn(`Warning: Could not copy ${config}`)
      }
    }

    return this
  }

  /**
   * Initialize a git repository in the isolated environment
   */
  gitInit(): this {
    execSync('git init', { cwd: this.path, stdio: 'pipe' })
    execSync('git config user.name "Test User"', {
      cwd: this.path,
      stdio: 'pipe',
    })
    execSync('git config user.email "test@example.com"', {
      cwd: this.path,
      stdio: 'pipe',
    })
    return this
  }

  /**
   * Copy Husky hooks to the isolated environment
   */
  copyHuskyHooks(): this {
    try {
      const huskyPath = join(process.cwd(), '.husky')
      const destPath = join(this.path, '.husky')
      cpSync(huskyPath, destPath, { recursive: true })
    } catch {
      console.warn('Warning: Could not copy .husky directory')
    }
    return this
  }

  /**
   * Install dependencies in the isolated environment
   * WARNING: This is slow - use sparingly
   */
  installDependencies(minimal: boolean = true): this {
    if (minimal) {
      // Only install essential dev dependencies for testing
      execSync('npm install --no-save prettier eslint stylelint', {
        cwd: this.path,
        stdio: 'pipe',
      })
    } else {
      // Full install
      execSync('npm install', { cwd: this.path, stdio: 'pipe' })
    }
    return this
  }

  /**
   * Write a file to the isolated environment
   * Automatically creates parent directories if they don't exist
   */
  writeFile(relativePath: string, content: string): this {
    const filePath = join(this.path, relativePath)
    const dir = dirname(filePath)

    // Create parent directories if they don't exist
    mkdirSync(dir, { recursive: true })

    writeFileSync(filePath, content, 'utf-8')
    return this
  }

  /**
   * Read a file from the isolated environment
   */
  readFile(relativePath: string): string {
    const filePath = join(this.path, relativePath)
    return readFileSync(filePath, 'utf-8')
  }

  /**
   * Execute a command in the isolated environment
   */
  exec(
    command: string,
    options: { throwOnError?: boolean } = {}
  ): {
    stdout: string
    stderr: string
    exitCode: number
  } {
    try {
      const env = {
        ...process.env,
        npm_config_cache: join(this.path, '.npm-cache'),
      }
      const stdout = execSync(command, {
        cwd: this.path,
        encoding: 'utf-8',
        stdio: 'pipe',
        env,
      })
      return { stdout, stderr: '', exitCode: 0 }
    } catch (error: any) {
      if (options.throwOnError !== false) {
        throw error
      }
      return {
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || '',
        exitCode: error.status || 1,
      }
    }
  }

  /**
   * Disable automatic cleanup (useful for debugging)
   */
  disableCleanup(): this {
    this.cleanup = false
    return this
  }

  /**
   * Clean up the isolated environment
   */
  destroy(): void {
    if (this.cleanup) {
      try {
        rmSync(this.path, { recursive: true, force: true })
      } catch {
        console.warn(`Warning: Could not clean up ${this.path}`)
      }
    }
  }
}

/**
 * Helper function to create a quick isolated test environment
 */
export function createIsolatedTestEnv(
  options: IsolatedTestEnvOptions = {}
): IsolatedTestEnv {
  const env = new IsolatedTestEnv()

  if (options.copyPackageJson) {
    env.copyPackageJson()
  }

  if (options.copyConfigs) {
    env.copyConfigs()
  }

  if (options.gitInit) {
    env.gitInit()
  }

  if (options.installDependencies) {
    env.installDependencies()
  }

  return env
}
