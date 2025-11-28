import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto'
import { promisify } from 'util'

/**
 * Token Encryption Utility
 *
 * Encrypts sensitive tokens (OAuth access/refresh, API keys) before storing in database.
 * Uses AES-256-GCM for authenticated encryption with key derivation.
 *
 * Setup:
 * 1. Generate key: openssl rand -hex 32
 * 2. Add to .env: ENCRYPTION_KEY=your_generated_key
 *
 * Ported from saas-starter-kit for cross-project security standards.
 */

const scryptAsync = promisify(scrypt)

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 32
const TAG_LENGTH = 16
const KEY_LENGTH = 32

function validateEncryptionKey(): string {
  const encryptionKey = process.env.ENCRYPTION_KEY

  if (!encryptionKey) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required for token encryption. Generate with: openssl rand -hex 32'
    )
  }

  if (encryptionKey.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters). Generate with: openssl rand -hex 32'
    )
  }

  return encryptionKey
}

async function deriveKey(masterKey: string, salt: Buffer): Promise<Buffer> {
  const keyBuffer = Buffer.from(masterKey, 'hex')
  return (await scryptAsync(keyBuffer, salt, KEY_LENGTH)) as Buffer
}

export async function encryptToken(token: string): Promise<string> {
  if (!token) {
    return token
  }

  try {
    const masterKey = validateEncryptionKey()

    const salt = randomBytes(SALT_LENGTH)
    const iv = randomBytes(IV_LENGTH)

    const key = await deriveKey(masterKey, salt)

    const cipher = createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(token, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const tag = cipher.getAuthTag()

    const combined = Buffer.concat([
      salt,
      iv,
      tag,
      Buffer.from(encrypted, 'hex'),
    ])

    return combined.toString('base64')
  } catch (error) {
    console.error('Token encryption failed:', error)
    throw new Error('Failed to encrypt token')
  }
}

export async function decryptToken(encryptedToken: string): Promise<string> {
  if (!encryptedToken) {
    return encryptedToken
  }

  try {
    const masterKey = validateEncryptionKey()

    const combined = Buffer.from(encryptedToken, 'base64')

    const salt = combined.subarray(0, SALT_LENGTH)
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const tag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + TAG_LENGTH
    )
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH)

    const key = await deriveKey(masterKey, salt)

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    let decrypted = decipher.update(encrypted, undefined, 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  } catch (error) {
    console.error('Token decryption failed:', error)
    throw new Error(
      'Failed to decrypt token - token may be corrupted or key changed'
    )
  }
}

export function isEncryptedToken(value: string): boolean {
  if (!value) return false

  try {
    const buffer = Buffer.from(value, 'base64')
    return buffer.length >= SALT_LENGTH + IV_LENGTH + TAG_LENGTH + 1
  } catch {
    return false
  }
}

export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex')
}

export async function rotateTokenEncryption(
  encryptedToken: string,
  oldKey: string,
  newKey: string
): Promise<string> {
  if (!encryptedToken) {
    return encryptedToken
  }

  const originalKey = process.env.ENCRYPTION_KEY
  process.env.ENCRYPTION_KEY = oldKey

  try {
    const decrypted = await decryptToken(encryptedToken)
    process.env.ENCRYPTION_KEY = newKey
    const reencrypted = await encryptToken(decrypted)
    return reencrypted
  } finally {
    process.env.ENCRYPTION_KEY = originalKey
  }
}
