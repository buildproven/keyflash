import { describe, it, expect } from 'vitest'
import {
  KeywordSearchSchema,
  KeywordInputSchema,
  RelatedKeywordsSchema,
} from '@/lib/validation/schemas'

describe('KeywordSearchSchema', () => {
  it('should validate correct keyword search data', () => {
    const validData = {
      keywords: ['seo tools', 'keyword research'],
      matchType: 'phrase' as const,
      location: 'US',
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
      location: 'US',
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
    expect(result.location).toBe('US')
  })
})

describe('RelatedKeywordsSchema', () => {
  it('should validate correct related keywords request', () => {
    const validData = {
      keyword: 'seo tools',
      location: 'US',
      language: 'en',
    }

    const result = RelatedKeywordsSchema.parse(validData)
    expect(result.keyword).toBe('seo tools')
    expect(result.location).toBe('US')
    expect(result.language).toBe('en')
  })

  it('should require keyword field', () => {
    const invalidData = {
      location: 'US',
    }

    expect(() => RelatedKeywordsSchema.parse(invalidData)).toThrow()
  })

  it('should reject empty keyword', () => {
    const invalidData = {
      keyword: '',
    }

    expect(() => RelatedKeywordsSchema.parse(invalidData)).toThrow()
  })

  it('should reject keyword exceeding max length', () => {
    const invalidData = {
      keyword: 'a'.repeat(101),
    }

    expect(() => RelatedKeywordsSchema.parse(invalidData)).toThrow()
  })

  it('should reject keywords with special characters', () => {
    const invalidData = {
      keyword: '<script>alert(1)</script>',
    }

    expect(() => RelatedKeywordsSchema.parse(invalidData)).toThrow()
  })

  it('should accept keywords with hyphens and underscores', () => {
    const validData = {
      keyword: 'seo-tools_2024',
    }

    const result = RelatedKeywordsSchema.parse(validData)
    expect(result.keyword).toBe('seo-tools_2024')
  })

  it('should trim whitespace from keyword', () => {
    const data = {
      keyword: '  seo tools  ',
    }

    const result = RelatedKeywordsSchema.parse(data)
    expect(result.keyword).toBe('seo tools')
  })

  it('should validate location format', () => {
    const invalidData = {
      keyword: 'test',
      location: 'invalid',
    }

    expect(() => RelatedKeywordsSchema.parse(invalidData)).toThrow()
  })

  it('should accept valid 2-letter country codes', () => {
    const validData = {
      keyword: 'test',
      location: 'GB',
    }

    const result = RelatedKeywordsSchema.parse(validData)
    expect(result.location).toBe('GB')
  })

  it('should accept GL for global location', () => {
    const validData = {
      keyword: 'test',
      location: 'GL',
    }

    const result = RelatedKeywordsSchema.parse(validData)
    expect(result.location).toBe('GL')
  })

  it('should allow empty location (optional)', () => {
    const validData = {
      keyword: 'test',
      location: '',
    }

    const result = RelatedKeywordsSchema.parse(validData)
    expect(result.location).toBeUndefined()
  })

  it('should validate language format', () => {
    const invalidData = {
      keyword: 'test',
      language: 'invalid-format',
    }

    expect(() => RelatedKeywordsSchema.parse(invalidData)).toThrow()
  })

  it('should accept valid language codes', () => {
    const validData = {
      keyword: 'test',
      language: 'en-US',
    }

    const result = RelatedKeywordsSchema.parse(validData)
    expect(result.language).toBe('en-US')
  })

  it('should accept simple language code', () => {
    const validData = {
      keyword: 'test',
      language: 'de',
    }

    const result = RelatedKeywordsSchema.parse(validData)
    expect(result.language).toBe('de')
  })

  it('should validate limit is positive integer', () => {
    const invalidData = {
      keyword: 'test',
      limit: -5,
    }

    expect(() => RelatedKeywordsSchema.parse(invalidData)).toThrow()
  })

  it('should validate limit is not too large', () => {
    const invalidData = {
      keyword: 'test',
      limit: 100,
    }

    expect(() => RelatedKeywordsSchema.parse(invalidData)).toThrow()
  })

  it('should accept valid limit', () => {
    const validData = {
      keyword: 'test',
      limit: 20,
    }

    const result = RelatedKeywordsSchema.parse(validData)
    expect(result.limit).toBe(20)
  })

  it('should make limit optional', () => {
    const validData = {
      keyword: 'test',
    }

    const result = RelatedKeywordsSchema.parse(validData)
    expect(result.limit).toBeUndefined()
  })
})
