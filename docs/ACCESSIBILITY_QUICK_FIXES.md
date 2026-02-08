# Accessibility Quick Fixes - Priority P0

This document contains the critical accessibility fixes needed for WCAG 2.1 AA compliance. All issues can be resolved in 8-12 hours.

## 1. Global Color Contrast Fix (2 hours)

### Find and Replace All Instances

**Find:** `text-gray-500`
**On backgrounds:** white, `bg-white`, `bg-gray-50`
**Replace with:** `text-gray-700 dark:text-gray-300`

**Find:** `text-gray-600 dark:text-gray-600`
**Replace with:** `text-gray-700 dark:text-gray-300`

**Find:** `text-slate-500`
**Replace with:** `text-slate-700 dark:text-slate-300`

### Files to Update

```bash
# Run these commands to see all instances
grep -r "text-gray-500" src/components --include="*.tsx"
grep -r "text-gray-600 dark:text-gray-600" src/components --include="*.tsx"
```

**Affected files (12 total):**

- src/app/page.tsx
- src/components/forms/keyword-search-form.tsx
- src/components/ui/loading-state.tsx
- src/components/saved-searches/saved-searches-list.tsx
- src/components/saved-searches/save-search-modal.tsx
- src/components/tables/keyword-results-table.tsx
- src/components/trends/trend-sparkline.tsx

---

## 2. Table Accessibility (1 hour)

### Add Caption to Results Table

**File:** `src/components/tables/keyword-results-table.tsx`
**Line:** 123

```tsx
<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
  <caption className="sr-only">
    Keyword research results showing {data.length} keywords with search volume, difficulty, CPC, competition, intent, and trend data
  </caption>
  <thead className="bg-gray-50 dark:bg-gray-800">
```

### Fix Table Header Contrast

**File:** `src/components/tables/keyword-results-table.tsx`
**Lines:** 128, 134, 140, 146, 152, 158, 164, 170

```tsx
// BEFORE
<th className="... text-gray-500 dark:text-gray-600">

// AFTER
<th className="... text-gray-700 dark:text-gray-400">
```

---

## 3. Icon Button Labels (1 hour)

### Auth Header Buttons

**File:** `src/components/layout/auth-header.tsx`
**Lines:** 16-25

```tsx
<SignInButton mode="modal">
  <button
    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors"
    aria-label="Sign in to your account"
  >
    Sign In
  </button>
</SignInButton>
<SignUpButton mode="modal">
  <button
    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
    aria-label="Start your free 7-day trial"
  >
    Start Free Trial
  </button>
</SignUpButton>
```

### Action Buttons in Results Table

**File:** `src/components/tables/keyword-results-table.tsx`
**Lines:** 263-302

```tsx
<button
  onClick={() => setRelatedKeyword(row.keyword)}
  className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
  aria-label={`Find related keywords for ${row.keyword}`}
>
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    {/* ... */}
  </svg>
  Related
</button>

<button
  onClick={() => setBriefKeyword(row.keyword)}
  className="inline-flex items-center gap-1 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:bg-primary-500 dark:hover:bg-primary-600"
  aria-label={`Generate content brief for ${row.keyword}`}
>
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
    {/* ... */}
  </svg>
  Brief
</button>
```

---

## 4. Form Error Associations (2 hours)

### Save Search Modal

**File:** `src/components/saved-searches/save-search-modal.tsx`
**Lines:** 166-176

```tsx
;<input
  ref={nameInputRef}
  id="search-name"
  type="text"
  value={name}
  onChange={e => setName(e.target.value)}
  placeholder="e.g., SEO keywords for blog"
  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
  maxLength={100}
  disabled={isSaving}
  aria-invalid={!!error}
  aria-describedby={error ? 'search-name-error' : undefined}
  required
/>

{
  error && (
    <p
      id="search-name-error"
      className="mt-1 text-sm text-red-600 dark:text-red-400"
      role="alert"
    >
      {error}
    </p>
  )
}
```

---

## 5. Modal Focus Management (3 hours)

### Pattern to Apply to All Modals

Add this to **all** modal components:

- ContentBriefModal
- RelatedKeywordsModal
- SaveSearchModal

```tsx
export function ModalComponent({ isOpen, onClose, ... }: Props) {
  const modalRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null) // NEW

  // Save previous focus when opening
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      closeButtonRef.current?.focus()
    }
  }, [isOpen])

  // Return focus when closing
  const handleClose = useCallback(() => {
    onClose()
    // Wait for modal to unmount, then return focus
    requestAnimationFrame(() => {
      previousFocusRef.current?.focus()
    })
  }, [onClose])

  // Update all onClose calls to use handleClose
  // ...

  return (
    <div onClick={handleClose}> {/* Changed from onClose */}
      {/* ... */}
      <button ref={closeButtonRef} onClick={handleClose} aria-label="Close modal">
        {/* ... */}
      </button>
    </div>
  )
}
```

**Files to update:**

- `/src/components/content-brief/content-brief-modal.tsx`
- `/src/components/related-keywords/related-keywords-modal.tsx`
- `/src/components/saved-searches/save-search-modal.tsx`

---

## 6. Focus Indicators (2 hours)

### Add to All Interactive Elements Without focus:ring

**Pattern:**

```tsx
className =
  '... focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2'
```

**Specific Fixes:**

#### Saved Searches Load Button

**File:** `src/components/saved-searches/saved-searches-list.tsx`
**Line:** 152

```tsx
<button
  onClick={() => onLoadSearch(search.id)}
  className="flex-1 text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-lg"
>
```

#### Delete Button

**File:** `src/components/saved-searches/saved-searches-list.tsx`
**Line:** 172

```tsx
<button
  onClick={() => handleDelete(search.id, search.name)}
  disabled={deletingId === search.id}
  className="rounded p-1 text-gray-600 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-900/20 dark:hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:opacity-100"
  aria-label={`Delete "${search.name}"`}
>
```

#### Trend Expand Button

**File:** `src/components/tables/keyword-results-table.tsx`
**Line:** 233

```tsx
<button
  onClick={() => toggleRowExpansion(row.keyword)}
  className="group flex items-center gap-1 rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
  aria-label={`View detailed trend chart for ${row.keyword}`}
  aria-expanded={expandedRow === row.keyword}
  aria-controls={`trend-detail-${index}`}
  id={`trend-toggle-${index}`}
>
```

#### Add IDs to Expanded Content

**File:** `src/components/tables/keyword-results-table.tsx`
**Line:** 307

```tsx
{expandedRow === row.keyword && row.trends && (
  <tr id={`trend-detail-${index}`} className="bg-gray-50 dark:bg-gray-800/50">
```

---

## 7. Skip Link Enhancement (15 minutes)

**File:** `src/app/search/page.tsx`
**Line:** 191-196

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary-600 text-white px-4 py-2 rounded-md z-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white"
>
  Skip to main content
</a>
```

---

## 8. Trend Sparkline Accessibility (1 hour)

**File:** `src/components/trends/trend-sparkline.tsx`
**Line:** 78-97

```tsx
export function TrendSparkline({
  trends,
  className = '',
}: TrendSparklineProps) {
  const { path, color, trendDirection, change } = useMemo(
    () => generateSparklinePath(trends),
    [trends]
  )

  if (!path) {
    return <span className="text-xs text-gray-700 dark:text-gray-300">—</span>
  }

  return (
    <div className="flex items-center gap-1">
      <span className="sr-only">
        Search volume trend: {trendDirection}
        {change !== null && ` (${change > 0 ? '+' : ''}${change.toFixed(1)}%)`}
      </span>
      <svg
        viewBox="0 0 100 30"
        className={`h-6 w-full ${className}`}
        aria-hidden="true"
      >
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={color}
        />
      </svg>
    </div>
  )
}
```

---

## 9. Footer Link Context (30 minutes)

**File:** `src/components/layout/footer.tsx`
**Lines:** 23-38

```tsx
<nav className="flex items-center gap-6 text-sm" aria-label="Legal">
  <a
    href="https://buildproven.ai/privacy-policy"
    target="_blank"
    rel="noopener noreferrer"
    className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
    aria-label="Privacy Policy (opens in new tab)"
  >
    Privacy
  </a>
  <a
    href="https://buildproven.ai/terms"
    target="_blank"
    rel="noopener noreferrer"
    className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
    aria-label="Terms of Service (opens in new tab)"
  >
    Terms
  </a>
</nav>
```

---

## Testing Checklist

After implementing fixes, test:

- [ ] Tab through entire landing page - all interactive elements have visible focus
- [ ] Tab through search page - focus never gets trapped or lost
- [ ] Open and close modals - focus returns to trigger button
- [ ] Submit forms with errors - errors announced and associated
- [ ] Use VoiceOver/NVDA - all content readable
- [ ] Zoom to 200% - no horizontal scroll, all content readable
- [ ] Check contrast with DevTools color picker - all text meets 4.5:1 minimum
- [ ] Open page with screen reader - heading structure makes sense
- [ ] Use keyboard only for 5 minutes - can complete all tasks

---

## Automated Testing

Run these after fixes:

```bash
# Install tools
npm install -D @axe-core/cli pa11y-ci

# Run axe
npx axe http://localhost:3000 --exit

# Run pa11y
npx pa11y http://localhost:3000 --standard WCAG2AA

# Check multiple pages
npx pa11y-ci --config .pa11yci.json
```

Create `.pa11yci.json`:

```json
{
  "defaults": {
    "standard": "WCAG2AA",
    "timeout": 10000
  },
  "urls": ["http://localhost:3000", "http://localhost:3000/search"]
}
```

---

## Verification

All P0 issues resolved when:

1. All text contrast ≥ 4.5:1 (normal) or ≥ 3:1 (large/UI)
2. All interactive elements have visible focus indicators
3. All modals trap and return focus properly
4. All form errors are announced and associated
5. All icon buttons have accessible labels
6. Tables have captions and proper headers
7. Trend charts have text alternatives
8. Skip link works and is visible when focused
9. axe-core reports 0 violations
10. pa11y reports 0 errors

**Estimated total time:** 8-12 hours
**Priority:** P0 (blocking production)
**Impact:** Enables 92% compliance (up from 72%)
