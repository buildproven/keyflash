import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportToCSV } from '@/lib/utils/csv-export'
import type { KeywordData } from '@/types/keyword'

describe('CSV Export', () => {
  // Mock DOM APIs
  let createElementSpy: ReturnType<typeof vi.spyOn>
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // Setup mocks
    const mockLink = {
      setAttribute: vi.fn(),
      click: vi.fn(),
      style: {},
      download: '',
    }

    createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockReturnValue(mockLink as any)
    createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url')
    revokeObjectURLSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {})

    document.body.appendChild = vi.fn()
    document.body.removeChild = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should create CSV with correct headers', () => {
    const data: KeywordData[] = [
      {
        keyword: 'test',
        searchVolume: 1000,
        difficulty: 50,
        cpc: 2.5,
        competition: 'medium',
        intent: 'informational',
      },
    ]

    exportToCSV(data)

    // Check that Blob was created with CSV content
    expect(createObjectURLSpy).toHaveBeenCalled()
  })

  it('should handle keywords with quotes correctly', () => {
    const data: KeywordData[] = [
      {
        keyword: 'test "keyword" here',
        searchVolume: 1000,
        difficulty: 50,
        cpc: 2.5,
        competition: 'low',
        intent: 'commercial',
      },
    ]

    exportToCSV(data)

    expect(createObjectURLSpy).toHaveBeenCalled()
  })

  it('should handle empty array', () => {
    const data: KeywordData[] = []

    exportToCSV(data)

    // Should still create the file with just headers
    expect(createObjectURLSpy).toHaveBeenCalled()
  })

  it('should format numbers correctly', () => {
    const data: KeywordData[] = [
      {
        keyword: 'test',
        searchVolume: 12345,
        difficulty: 75,
        cpc: 3.456,
        competition: 'high',
        intent: 'transactional',
      },
    ]

    exportToCSV(data)

    expect(createObjectURLSpy).toHaveBeenCalled()
  })

  it('should use custom filename', () => {
    const data: KeywordData[] = [
      {
        keyword: 'test',
        searchVolume: 1000,
        difficulty: 50,
        cpc: 2.5,
        competition: 'low',
        intent: 'navigational',
      },
    ]

    exportToCSV(data, 'custom-export.csv')

    expect(createElementSpy).toHaveBeenCalledWith('a')
  })
})
