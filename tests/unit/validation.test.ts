import { describe, it, expect } from 'vitest'
import {
  KeywordSearchSchema,
  KeywordInputSchema,
} from '@/lib/validation/schemas'

describe('KeywordSearchSchema', () => {
  it('should validate correct keyword search data', () => {
    const validData = {
      keywords: ['seo tools', 'keyword research'],
      matchType: 'phrase' as const,
      location: 'United States',
    }

    const result = KeywordSearchSchema.parse(validData)
    expect(result).toEqual(validData)
  })

  it('should reject empty keywords array', () => {
    const invalidData = {
      keywords: [],
      matchType: 'phrase' as const,
    }

    expect(() => KeywordSearchSchema.parse(invalidData)).toThrow()
  })

  it('should reject more than 200 keywords', () => {
    const invalidData = {
      keywords: Array(201).fill('keyword'),
      matchType: 'phrase' as const,
    }

    expect(() => KeywordSearchSchema.parse(invalidData)).toThrow()
  })

  it('should reject invalid match type', () => {
    const invalidData = {
      keywords: ['test'],
      matchType: 'invalid',
    }

    expect(() => KeywordSearchSchema.parse(invalidData)).toThrow()
  })

  it('should trim whitespace from keywords', () => {
    const data = {
      keywords: ['  test  ', '  another  '],
      matchType: 'phrase' as const,
    }

    const result = KeywordSearchSchema.parse(data)
    expect(result.keywords).toEqual(['test', 'another'])
  })
})

describe('KeywordInputSchema', () => {
  it('should validate correct form input', () => {
    const validData = {
      keywordsInput: 'seo tools\nkeyword research',
      matchType: 'phrase' as const,
      location: 'United States',
    }

    const result = KeywordInputSchema.parse(validData)
    expect(result.keywordsInput).toBe('seo tools\nkeyword research')
  })

  it('should reject empty input', () => {
    const invalidData = {
      keywordsInput: '',
      matchType: 'phrase' as const,
    }

    expect(() => KeywordInputSchema.parse(invalidData)).toThrow()
  })

  it('should reject input exceeding max length', () => {
    const invalidData = {
      keywordsInput: 'a'.repeat(10001),
      matchType: 'phrase' as const,
    }

    expect(() => KeywordInputSchema.parse(invalidData)).toThrow()
  })

  it('should use default location', () => {
    const data = {
      keywordsInput: 'test',
      matchType: 'phrase' as const,
    }

    const result = KeywordInputSchema.parse(data)
    expect(result.location).toBe('United States')
  })
})
