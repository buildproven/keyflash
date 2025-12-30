import type { KeywordData, MatchType } from './keyword'

export interface SavedSearchParams {
  keywords: string[]
  matchType: MatchType
  location: string
  language?: string
}

export interface SavedSearchMetadata {
  createdAt: string
  updatedAt: string
  lastRunAt?: string
  resultCount?: number
}

export interface SavedSearch {
  id: string
  clerkUserId: string
  name: string
  description?: string
  searchParams: SavedSearchParams
  results?: KeywordData[]
  metadata: SavedSearchMetadata
}

export interface SavedSearchSummary {
  id: string
  name: string
  description?: string
  keywordCount: number
  location: string
  metadata: SavedSearchMetadata
}

export interface CreateSavedSearchInput {
  name: string
  description?: string
  searchParams: SavedSearchParams
  results?: KeywordData[]
}

export interface UpdateSavedSearchInput {
  name?: string
  description?: string
}
