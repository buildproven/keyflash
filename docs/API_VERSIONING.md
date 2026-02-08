# API Versioning Strategy

**Status**: Implemented (ARCH-001)
**Current Version**: v1
**Last Updated**: 2026-01-16

## Overview

KeyFlash implements URL-based API versioning to ensure backwards compatibility and smooth upgrades for clients as the API evolves.

## Versioning Format

### URL Structure

```
/api/v1/keywords
/api/v1/searches
/api/v1/health
```

### Version Headers

All API responses include an `API-Version` header:

```http
API-Version: v1
```

Clients can optionally send an `API-Version` header in requests for explicit version selection:

```http
GET /api/keywords
API-Version: v1
```

## Backwards Compatibility

### Implicit v1

For backwards compatibility, unversioned paths `/api/*` automatically map to `/api/v1/*`:

- `/api/keywords` → treated as `/api/v1/keywords`
- `/api/health` → treated as `/api/v1/health`

This ensures existing clients continue working without changes.

## Version Support Policy

### Current Versions

- **v1**: Current stable version (introduced 2026-01-16)

### Deprecation Policy

When introducing breaking changes:

1. **New version created** (e.g., v2)
2. **6-month notice period**: Old version marked as deprecated
3. **Deprecation headers** added to responses:
   ```http
   Deprecation: true
   Deprecation-Date: 2026-07-01
   Sunset: 2027-01-01
   Link: </api/v2/keywords>; rel="successor-version"
   ```
4. **6-month sunset period**: Both versions supported
5. **Removal**: Old version removed after sunset date

Minimum support window: **12 months** from deprecation notice.

## Breaking vs Non-Breaking Changes

### Non-Breaking Changes (no new version needed)

- Adding new endpoints
- Adding optional request parameters
- Adding new response fields
- Bug fixes that don't change behavior
- Performance improvements

### Breaking Changes (new version required)

- Removing endpoints
- Removing request parameters
- Removing response fields
- Changing field types or formats
- Changing error response structure
- Changing authentication requirements

## Implementation Details

### File Structure

```
src/app/api/
├── v1/                    # Version 1 routes
│   ├── keywords/
│   ├── searches/
│   └── health/
├── keywords/              # Legacy unversioned (maps to v1)
├── searches/              # Legacy unversioned (maps to v1)
└── health/                # Legacy unversioned (maps to v1)
```

### Version Detection

Version is detected from:

1. URL path: `/api/v1/keywords` → v1
2. API-Version header (fallback)
3. Unversioned paths → v1 (implicit)

See `src/lib/utils/api-version.ts` for implementation.

### Response Headers

All responses automatically include version metadata via:

- `handleAPIError()` for error responses
- `createSuccessResponse()` for success responses

## Migration Guide

### For API Clients

#### Current (v1 implicit)

```typescript
// Works, but considered legacy
fetch('/api/keywords', {
  method: 'POST',
  body: JSON.stringify({ keywords: ['seo tools'] }),
})
```

#### Recommended (explicit v1)

```typescript
// Explicit version - recommended
fetch('/api/v1/keywords', {
  method: 'POST',
  headers: { 'API-Version': 'v1' },
  body: JSON.stringify({ keywords: ['seo tools'] }),
})
```

#### Future (v2 example)

```typescript
// When v2 is released
fetch('/api/v2/keywords', {
  method: 'POST',
  headers: { 'API-Version': 'v2' },
  body: JSON.stringify({ queries: ['seo tools'] }), // new format
})
```

### Version Detection in Client Code

```typescript
const response = await fetch('/api/v1/keywords', {
  /* ... */
})
const apiVersion = response.headers.get('API-Version')
const deprecated = response.headers.get('Deprecation') === 'true'

if (deprecated) {
  const sunsetDate = response.headers.get('Sunset')
  console.warn(`API version ${apiVersion} will be removed on ${sunsetDate}`)
}
```

## Testing

### Version Header Validation

```bash
# Check response includes version header
curl -i https://keyflash.buildproven.ai/api/v1/health

# Expected:
# HTTP/1.1 200 OK
# API-Version: v1
# ...
```

### Backwards Compatibility

```bash
# Verify unversioned paths work
curl -i https://keyflash.buildproven.ai/api/health

# Expected:
# HTTP/1.1 200 OK
# API-Version: v1  (implicit v1)
# ...
```

## Future Versioning

When creating v2:

1. Create new directory: `src/app/api/v2/`
2. Update `SUPPORTED_API_VERSIONS` in `api-version.ts`
3. Add deprecation metadata for v1
4. Update middleware to handle both versions
5. Document migration guide
6. Announce deprecation (6 months notice)
7. Set sunset date (12 months from notice)

## References

- [RFC 8594 - Sunset Header](https://www.rfc-editor.org/rfc/rfc8594.html)
- [REST API Versioning Best Practices](https://www.freecodecamp.org/news/rest-api-design-best-practices-build-a-rest-api/)
- [OpenAPI Versioning](https://swagger.io/docs/specification/api-host-and-base-path/)
