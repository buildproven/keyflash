# KeyFlash API Documentation

## Overview

KeyFlash provides a RESTful API for keyword research with built-in rate limiting, caching, and multi-provider support. All endpoints return JSON responses and follow standard HTTP status codes.

**Base URL**: `http://localhost:3000` (development) or `https://yourdomain.com` (production)

**Version**: 1.0.0

---

## Table of Contents

1. [Authentication](#authentication)
2. [Rate Limiting](#rate-limiting)
3. [Caching](#caching)
4. [Endpoints](#endpoints)
   - [POST /api/keywords](#post-apikeywords)
   - [GET /api/health](#get-apihealth)
5. [Request Validation](#request-validation)
6. [Error Handling](#error-handling)
7. [Response Headers](#response-headers)
8. [Examples](#examples)

---

## Authentication

**Current Version**: No authentication required (v1.0.0)

**Future Plans**: API key authentication will be added in v2.0.0 for hosted SaaS version.

---

## Rate Limiting

Rate limiting is enforced per IP address using Redis-based storage with HMAC-secured client identification.

### Configuration

- **Default Limit**: 10 requests per hour per IP address
- **Configurable via**: `RATE_LIMIT_REQUESTS_PER_HOUR` environment variable
- **Enable/Disable**: `RATE_LIMIT_ENABLED` environment variable (default: `true`)

### Rate Limit Headers

All API responses include rate limit information:

```http
X-RateLimit-Remaining: 8
X-RateLimit-Reset: 2025-11-21T15:30:00.000Z
```

### Rate Limit Exceeded Response

**Status Code**: `429 Too Many Requests`

```json
{
  "error": "Rate limit exceeded",
  "message": "Rate limit exceeded. Try again in 3540 seconds. Limit: 10 requests/hour.",
  "timestamp": "2025-11-21T14:30:00.000Z"
}
```

**Additional Headers**:

```http
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2025-11-21T15:30:00.000Z
Retry-After: 3540
```

---

## Caching

KeyFlash implements intelligent caching to reduce API costs and improve response times.

### Cache Strategy

- **Cache Backend**: Upstash Redis
- **Cache Duration**: 7 days (keyword data rarely changes weekly)
- **Cache Key Format**: `kw:{location}:{language}:{matchType}:{hash(keywords)}`
- **Privacy Mode**: Caching can be disabled with `PRIVACY_MODE=true` for privacy-focused deployments

### Cache Response Indicators

The API response includes a `cached` field:

```json
{
  "data": [...],
  "cached": true,
  "timestamp": "2025-11-21T14:30:00.000Z",
  "provider": "Google Ads"
}
```

- `cached: true` - Data served from cache (instant response)
- `cached: false` - Fresh data fetched from provider (2-3 seconds)

---

## Endpoints

### POST /api/keywords

Search for keyword metrics including search volume, difficulty, CPC, and competition data.

#### Request

**Method**: `POST`

**URL**: `/api/keywords`

**Headers**:

```http
Content-Type: application/json
```

**Body Parameters**:

| Parameter   | Type       | Required | Description                                                           | Example         |
| ----------- | ---------- | -------- | --------------------------------------------------------------------- | --------------- |
| `keywords`  | `string[]` | Yes      | Array of keywords to research (1-200 keywords, each 1-100 characters) | `["seo tools"]` |
| `matchType` | `string`   | Yes      | Match type: `"phrase"` or `"exact"`                                   | `"phrase"`      |
| `location`  | `string`   | No       | 2-letter country code (`US`, `GB`, `CA`, etc.) or `GL` for Global     | `"US"`          |
| `language`  | `string`   | No       | Language code (`en`, `en-US`, `es`, etc.)                             | `"en"`          |

**Request Body Schema**:

```typescript
{
  keywords: string[]; // Min: 1, Max: 200 keywords
  matchType: "phrase" | "exact";
  location?: string; // ISO 3166-1 alpha-2 code or "GL"
  language?: string; // ISO 639-1 language code
}
```

**Validation Rules**:

- Keywords must contain only letters, numbers, spaces, hyphens, and underscores
- Keywords cannot be empty or exceed 100 characters
- Minimum 1 keyword, maximum 200 keywords per request
- Location must be 2-letter uppercase country code or `GL` for global
- Language must be 2-letter lowercase language code (optionally with country: `en-US`)

#### Response

**Status Code**: `200 OK` (success) | `400 Bad Request` (validation error) | `429 Too Many Requests` (rate limit) | `500 Internal Server Error`

**Response Body**:

```json
{
  "data": [
    {
      "keyword": "seo tools",
      "searchVolume": 12500,
      "difficulty": 67,
      "cpc": 8.45,
      "competition": "high",
      "intent": "commercial"
    }
  ],
  "cached": false,
  "timestamp": "2025-11-21T14:30:00.000Z",
  "mockData": false,
  "provider": "Google Ads"
}
```

**Response Fields**:

| Field       | Type      | Description                                                          |
| ----------- | --------- | -------------------------------------------------------------------- |
| `data`      | `array`   | Array of keyword data objects                                        |
| `cached`    | `boolean` | Whether data was served from cache                                   |
| `timestamp` | `string`  | ISO 8601 timestamp of response generation                            |
| `mockData`  | `boolean` | `true` if mock provider was used (development only)                  |
| `provider`  | `string`  | Name of the provider used (`"Google Ads"`, `"DataForSEO"`, `"Mock"`) |

**Keyword Data Object**:

| Field          | Type     | Description                                                                           |
| -------------- | -------- | ------------------------------------------------------------------------------------- |
| `keyword`      | `string` | The keyword term                                                                      |
| `searchVolume` | `number` | Monthly search volume                                                                 |
| `difficulty`   | `number` | SEO difficulty score (0-100, higher = harder)                                         |
| `cpc`          | `number` | Cost per click in USD                                                                 |
| `competition`  | `string` | Competition level: `"low"`, `"medium"`, `"high"`                                      |
| `intent`       | `string` | Search intent: `"informational"`, `"commercial"`, `"transactional"`, `"navigational"` |

#### Example Requests

**Curl**:

```bash
curl -X POST http://localhost:3000/api/keywords \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["seo tools", "keyword research", "backlink checker"],
    "matchType": "phrase",
    "location": "US",
    "language": "en"
  }'
```

**JavaScript (Fetch)**:

```javascript
const response = await fetch('/api/keywords', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    keywords: ['seo tools', 'keyword research', 'backlink checker'],
    matchType: 'phrase',
    location: 'US',
    language: 'en',
  }),
})

const data = await response.json()
console.log(data)
```

**TypeScript**:

```typescript
interface KeywordSearchRequest {
  keywords: string[]
  matchType: 'phrase' | 'exact'
  location?: string
  language?: string
}

interface KeywordData {
  keyword: string
  searchVolume: number
  difficulty: number
  cpc: number
  competition: 'low' | 'medium' | 'high'
  intent: 'informational' | 'commercial' | 'transactional' | 'navigational'
}

interface KeywordSearchResponse {
  data: KeywordData[]
  cached: boolean
  timestamp: string
  mockData?: boolean
  provider?: string
}

async function searchKeywords(
  request: KeywordSearchRequest
): Promise<KeywordSearchResponse> {
  const response = await fetch('/api/keywords', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`)
  }

  return await response.json()
}
```

---

### GET /api/health

Health check endpoint for monitoring system dependencies and status.

#### Request

**Method**: `GET`

**URL**: `/api/health`

**Headers**: None required

**Query Parameters**: None

#### Response

**Status Codes**:

- `200 OK` - All systems healthy
- `207 Multi-Status` - Degraded (some services unavailable)
- `503 Service Unavailable` - System unhealthy (critical services down)

**Response Body**:

```json
{
  "status": "healthy",
  "timestamp": "2025-11-21T14:30:00.000Z",
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "redis": {
      "healthy": true,
      "responseTime": 45,
      "details": {
        "configured": true,
        "responsive": true
      }
    },
    "provider": {
      "healthy": true,
      "responseTime": 12,
      "details": {
        "provider": "google-ads",
        "requiredVars": [
          "GOOGLE_ADS_CLIENT_ID",
          "GOOGLE_ADS_CLIENT_SECRET",
          "GOOGLE_ADS_DEVELOPER_TOKEN",
          "GOOGLE_ADS_REFRESH_TOKEN",
          "GOOGLE_ADS_CUSTOMER_ID"
        ]
      }
    }
  },
  "responseTime": 57
}
```

**Response Fields**:

| Field          | Type     | Description                                                 |
| -------------- | -------- | ----------------------------------------------------------- |
| `status`       | `string` | Overall health: `"healthy"`, `"degraded"`, or `"unhealthy"` |
| `timestamp`    | `string` | ISO 8601 timestamp of health check                          |
| `version`      | `string` | Application version from package.json                       |
| `environment`  | `string` | Current environment (`"development"`, `"production"`)       |
| `checks`       | `object` | Individual health checks for dependencies                   |
| `responseTime` | `number` | Total health check response time in milliseconds            |

**Health Check Result**:

| Field          | Type      | Description                                 |
| -------------- | --------- | ------------------------------------------- |
| `healthy`      | `boolean` | Whether the service is healthy              |
| `responseTime` | `number`  | Service check response time in milliseconds |
| `error`        | `string`  | Error message if unhealthy (optional)       |
| `details`      | `object`  | Service-specific details (optional)         |

#### Example Requests

**Curl**:

```bash
curl http://localhost:3000/api/health
```

**JavaScript**:

```javascript
const response = await fetch('/api/health')
const health = await response.json()

if (health.status === 'healthy') {
  console.log('✅ System is healthy')
} else {
  console.warn(`⚠️  System is ${health.status}`, health.checks)
}
```

**TypeScript**:

```typescript
interface HealthCheckResult {
  healthy: boolean
  responseTime?: number
  error?: string
  details?: Record<string, any>
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  environment: string
  checks: {
    redis: HealthCheckResult
    provider: HealthCheckResult
  }
  responseTime: number
}

async function checkHealth(): Promise<HealthStatus> {
  const response = await fetch('/api/health')
  return await response.json()
}
```

---

## Request Validation

All API requests are validated using [Zod](https://zod.dev/) schemas to prevent injection attacks and ensure data integrity.

### Validation Errors

**Status Code**: `400 Bad Request`

**Response Format**:

```json
{
  "error": "Validation Error",
  "message": "Keywords must contain only letters, numbers, spaces, hyphens, and underscores",
  "timestamp": "2025-11-21T14:30:00.000Z"
}
```

### Common Validation Errors

| Error                                      | Cause                                      | Fix                                             |
| ------------------------------------------ | ------------------------------------------ | ----------------------------------------------- |
| "At least one keyword is required"         | Empty `keywords` array                     | Provide at least 1 keyword                      |
| "Maximum 200 keywords allowed"             | More than 200 keywords in array            | Reduce to 200 or fewer keywords                 |
| "Keyword cannot be empty"                  | Empty string in keywords array             | Remove empty strings                            |
| "Keyword too long (max 100 chars)"         | Keyword exceeds 100 characters             | Shorten keyword to 100 characters               |
| "Keywords must contain only..."            | Invalid characters (special chars, emojis) | Use only letters, numbers, spaces, `-`, `_`     |
| "Location must be a 2-letter country code" | Invalid location format                    | Use ISO 3166-1 alpha-2 codes (e.g., `US`, `GB`) |
| "Language must be valid language code"     | Invalid language format                    | Use ISO 639-1 codes (e.g., `en`, `es`, `en-US`) |

---

## Error Handling

KeyFlash uses standard HTTP status codes and consistent error response format.

### Error Response Format

```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "timestamp": "2025-11-21T14:30:00.000Z"
}
```

### HTTP Status Codes

| Code | Status                | Description                                                 |
| ---- | --------------------- | ----------------------------------------------------------- |
| 200  | OK                    | Request successful                                          |
| 207  | Multi-Status          | Partial success (used in health checks for degraded status) |
| 400  | Bad Request           | Invalid request parameters or validation error              |
| 405  | Method Not Allowed    | HTTP method not supported for this endpoint                 |
| 429  | Too Many Requests     | Rate limit exceeded                                         |
| 500  | Internal Server Error | Server-side error (logged for debugging)                    |
| 503  | Service Unavailable   | System unhealthy (critical dependencies down)               |

### Error Examples

**Rate Limit Exceeded (429)**:

```json
{
  "error": "Rate limit exceeded",
  "message": "Rate limit exceeded. Try again in 3540 seconds. Limit: 10 requests/hour.",
  "timestamp": "2025-11-21T14:30:00.000Z"
}
```

**Validation Error (400)**:

```json
{
  "error": "Validation Error",
  "message": "Maximum 200 keywords allowed",
  "timestamp": "2025-11-21T14:30:00.000Z"
}
```

**Method Not Allowed (405)**:

```json
{
  "error": "Method Not Allowed",
  "message": "Use POST to search for keywords",
  "supportedMethods": ["POST"],
  "timestamp": "2025-11-21T14:30:00.000Z"
}
```

**Internal Server Error (500)**:

```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred. Please try again later.",
  "timestamp": "2025-11-21T14:30:00.000Z"
}
```

---

## Response Headers

### Security Headers

All API responses include comprehensive security headers:

```http
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; ...
```

### Rate Limit Headers

```http
X-RateLimit-Remaining: 8
X-RateLimit-Reset: 2025-11-21T15:30:00.000Z
```

### Cache Control Headers

API endpoints disable caching:

```http
Cache-Control: no-store, max-age=0
```

---

## Examples

### Full Workflow Example

**1. Check System Health**:

```bash
curl http://localhost:3000/api/health
```

**Response**:

```json
{
  "status": "healthy",
  "timestamp": "2025-11-21T14:30:00.000Z",
  "version": "1.0.0",
  "environment": "development",
  "checks": {
    "redis": { "healthy": true, "responseTime": 45 },
    "provider": { "healthy": true, "responseTime": 12 }
  },
  "responseTime": 57
}
```

**2. Search for Keywords**:

```bash
curl -X POST http://localhost:3000/api/keywords \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["seo tools", "keyword research"],
    "matchType": "phrase",
    "location": "US",
    "language": "en"
  }'
```

**Response** (First Request - Not Cached):

```json
{
  "data": [
    {
      "keyword": "seo tools",
      "searchVolume": 12500,
      "difficulty": 67,
      "cpc": 8.45,
      "competition": "high",
      "intent": "commercial"
    },
    {
      "keyword": "keyword research",
      "searchVolume": 8200,
      "difficulty": 54,
      "cpc": 6.25,
      "competition": "medium",
      "intent": "informational"
    }
  ],
  "cached": false,
  "timestamp": "2025-11-21T14:30:00.000Z",
  "mockData": false,
  "provider": "Google Ads"
}
```

**3. Same Request Again (Cached)**:

```bash
# Same request as above
```

**Response** (Second Request - Served from Cache):

```json
{
  "data": [
    // ... same data as before
  ],
  "cached": true,
  "timestamp": "2025-11-21T14:30:15.000Z",
  "mockData": false,
  "provider": "Google Ads"
}
```

### React Component Example

```typescript
import { useState } from 'react';

interface KeywordData {
  keyword: string;
  searchVolume: number;
  difficulty: number;
  cpc: number;
  competition: 'low' | 'medium' | 'high';
  intent: string;
}

interface SearchResponse {
  data: KeywordData[];
  cached: boolean;
  timestamp: string;
  mockData?: boolean;
  provider?: string;
}

function KeywordSearch() {
  const [results, setResults] = useState<KeywordData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(keywords: string[]) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords,
          matchType: 'phrase',
          location: 'US',
          language: 'en',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch keywords');
      }

      const data: SearchResponse = await response.json();
      setResults(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={() => handleSearch(['seo tools'])}>
        Search Keywords
      </button>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      {results.length > 0 && (
        <ul>
          {results.map((result, index) => (
            <li key={index}>
              {result.keyword} - {result.searchVolume} searches/month
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

## Supported Locations

KeyFlash supports keyword research for the following locations:

| Code | Location      | Code | Location         |
| ---- | ------------- | ---- | ---------------- |
| `US` | United States | `GB` | United Kingdom   |
| `CA` | Canada        | `AU` | Australia        |
| `DE` | Germany       | `FR` | France           |
| `IN` | India         | `GL` | Global/Worldwide |

**Note**: Additional locations may be supported depending on your configured API provider. Check the provider's documentation for full coverage.

---

## Supported Languages

KeyFlash supports keyword research in multiple languages using ISO 639-1 codes:

| Code    | Language     | Code    | Language     |
| ------- | ------------ | ------- | ------------ |
| `en`    | English      | `es`    | Spanish      |
| `fr`    | French       | `de`    | German       |
| `pt`    | Portuguese   | `it`    | Italian      |
| `en-US` | English (US) | `en-GB` | English (UK) |

**Note**: Language support depends on your configured API provider.

---

## API Providers

KeyFlash supports multiple keyword data providers through an abstraction layer:

### Available Providers

1. **Google Ads API** (Recommended for MVP)
   - Free tier available
   - Requires Google Ads account and API credentials
   - Environment variables: `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`

2. **DataForSEO API** (For scaling)
   - Paid API service
   - Higher rate limits and more features
   - Environment variables: `DATAFORSEO_API_LOGIN`, `DATAFORSEO_API_PASSWORD`

3. **Mock Provider** (Development only)
   - Returns generated mock data for testing
   - No API credentials required
   - Environment variable: `KEYWORD_API_PROVIDER=mock`

### Configuring Providers

Set the active provider in your `.env.local` file:

```bash
# Choose one:
KEYWORD_API_PROVIDER=google-ads  # For production
KEYWORD_API_PROVIDER=dataforseo  # For scaling
KEYWORD_API_PROVIDER=mock        # For development (default)
```

---

## Best Practices

### Performance Optimization

1. **Batch Requests**: Request multiple keywords in a single API call instead of making multiple requests
2. **Cache Awareness**: Identical requests within 7 days will be served from cache (instant response)
3. **Rate Limiting**: Keep under 10 requests/hour per IP or configure a higher limit

### Security

1. **Input Validation**: Always validate and sanitize user input on the client side before sending to API
2. **Error Handling**: Implement proper error handling to prevent sensitive data leaks
3. **Rate Limit Monitoring**: Monitor `X-RateLimit-Remaining` header to prevent exceeding limits

### Reliability

1. **Health Checks**: Implement `/api/health` polling for monitoring system status
2. **Retry Logic**: Implement exponential backoff for 5xx errors
3. **Timeout Handling**: Set appropriate request timeouts (recommend 10 seconds)

### Privacy

1. **No Keyword Storage**: KeyFlash does not store keyword searches when `PRIVACY_MODE=true`
2. **GDPR Compliance**: Cache can be disabled entirely for privacy-focused deployments
3. **No User Tracking**: No analytics or tracking cookies are set by the API

---

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for API version history and breaking changes.

---

## Support

- **GitHub Issues**: [https://github.com/brettstark73/keyflash/issues](https://github.com/brettstark73/keyflash/issues)
- **Documentation**: [https://github.com/brettstark73/keyflash](https://github.com/brettstark73/keyflash)
- **License**: AGPL-3.0

---

**Last Updated**: 2025-11-21
**API Version**: 1.0.0
