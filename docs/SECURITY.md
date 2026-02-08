# KeyFlash - Security Strategy

## Security Philosophy

**Principle**: Security by Design, Privacy by Default

- Assume all inputs are malicious until validated
- Never trust client-side validation alone
- Minimize data collection and storage
- Fail securely (restrictive defaults)
- Defense in depth (multiple security layers)

## Threat Model

### Threat Categories

**🔴 CRITICAL - Immediate business impact**

1. **API Key Theft**
   - Attacker gains access to Google Ads / DataForSEO API keys
   - Impact: Unlimited API usage, financial loss, account suspension
   - Likelihood: High if misconfigured

2. **Injection Attacks** (SQL, NoSQL, Command)
   - Attacker injects malicious code via keyword input
   - Impact: Data breach, server compromise
   - Likelihood: Medium

3. **DDoS / Resource Exhaustion**
   - Attacker floods API with requests
   - Impact: Service unavailable, high API costs
   - Likelihood: Medium to High

**🟡 HIGH - Significant security concern**

4. **Rate Limit Bypass**
   - Attacker circumvents rate limiting
   - Impact: API cost spike, service degradation
   - Likelihood: Medium

5. **Data Scraping**
   - Automated bots scrape keyword data
   - Impact: Competitor advantage, API cost
   - Likelihood: High

6. **XSS (Cross-Site Scripting)**
   - Attacker injects malicious JavaScript
   - Impact: User session hijacking (if auth added)
   - Likelihood: Low (if inputs sanitized)

**🟢 MEDIUM - Monitor and mitigate**

7. **CSRF (Cross-Site Request Forgery)**
   - Attacker tricks user into unwanted actions
   - Impact: Unwanted API calls, unauthorized state changes
   - Likelihood: Low (Clerk session-based protection)
   - Mitigation: See [CSRF Protection Strategy](#csrf-protection-strategy)

8. **Privacy Violations**
   - Keyword searches logged and exposed
   - Impact: GDPR violations, user trust loss
   - Likelihood: Low (by design, no logging)

## Security Controls

### 1. API Key Management

**🔴 CRITICAL CONTROL**

#### Storage

```bash
# ✅ CORRECT - Environment variables only
GOOGLE_ADS_CLIENT_ID=xxx
GOOGLE_ADS_CLIENT_SECRET=xxx
GOOGLE_ADS_DEVELOPER_TOKEN=xxx
DATAFORSEO_API_LOGIN=xxx
DATAFORSEO_API_PASSWORD=xxx

# ❌ FORBIDDEN
# - Hardcoded in source code
# - Committed to Git
# - Stored in frontend code
# - Logged to console/files
```

#### Implementation

```typescript
// ✅ Server-side only (API routes)
const login = process.env.DATAFORSEO_API_LOGIN
const password = process.env.DATAFORSEO_API_PASSWORD

// ❌ Never expose to client
// const password = window.ENV.DATAFORSEO_API_PASSWORD; // WRONG!

// ✅ Validate presence on startup
if (!process.env.GOOGLE_ADS_CLIENT_ID) {
  throw new Error('GOOGLE_ADS_CLIENT_ID not configured')
}
```

#### Rotation Policy

- Rotate API keys every 90 days
- Rotate immediately if:
  - Key potentially exposed (commit, log, error message)
  - Team member with access leaves
  - Suspicious API usage detected

#### Access Control

- API keys stored in:
  - Production: Vercel environment variables (encrypted)
  - Development: .env.local (gitignored)
  - Team: Shared via 1Password/Bitwarden (never Slack/email)

### 2. Input Validation & Sanitization

**🔴 CRITICAL CONTROL**

#### Keyword Input Validation

```typescript
import { z } from 'zod'

// ✅ Strict validation schema
const KeywordSearchSchema = z.object({
  keywords: z
    .array(z.string())
    .min(1, 'At least 1 keyword required')
    .max(200, 'Maximum 200 keywords')
    .refine(
      kws => kws.every(kw => kw.length <= 100),
      'Each keyword must be ≤100 characters'
    )
    .refine(
      kws => kws.every(kw => /^[a-zA-Z0-9\s\-_]+$/.test(kw)),
      'Only alphanumeric, spaces, hyphens, underscores allowed'
    ),

  matchType: z.enum(['phrase', 'exact']),

  location: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[A-Z]{2}$/, 'Must be 2-letter country code'),

  language: z
    .string()
    .min(2)
    .max(5)
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Invalid language code'),
})

// ✅ Server-side validation
export async function POST(request: Request) {
  const body = await request.json()

  // Parse and validate (throws if invalid)
  const validated = KeywordSearchSchema.parse(body)

  // Sanitize (remove extra whitespace, normalize)
  const sanitized = {
    ...validated,
    keywords: validated.keywords.map(kw => kw.trim().toLowerCase()),
  }

  // Process sanitized input
  return processKeywords(sanitized)
}
```

#### Why This Matters

- **Injection Prevention**: Regex blocks SQL/NoSQL/command injection
- **API Protection**: Limits prevent API abuse (200 keyword max)
- **Data Integrity**: Ensures valid inputs to external APIs
- **Error Prevention**: Catch invalid inputs before expensive API calls

#### Sanitization Rules

```typescript
// ✅ Safe sanitization
function sanitizeKeyword(keyword: string): string {
  return keyword
    .trim() // Remove leading/trailing whitespace
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .replace(/[<>\"'&]/g, '') // Remove HTML-dangerous chars
    .slice(0, 100) // Enforce max length
}

// ❌ Dangerous - No sanitization
const userInput = request.body.keyword // Direct use = injection risk
```

### 3. Rate Limiting

**🔴 CRITICAL CONTROL**

#### Multi-Layer Rate Limiting

**Layer 1: IP-Based (Anonymous Users)**

```typescript
// Upstash Rate Limit
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 h'), // 10 requests per hour
  analytics: true,
})

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'

  const { success, limit, remaining, reset } = await ratelimit.limit(`ip:${ip}`)

  if (!success) {
    return Response.json(
      { error: 'Rate limit exceeded. Try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
        },
      }
    )
  }

  // Process request
}
```

**Layer 2: User-Based (Authenticated - Future)**

```typescript
// Stricter limits for abusive users, higher for paying customers
const userLimits = {
  free: { requests: 10, window: '1 h' },
  basic: { requests: 100, window: '1 d' },
  pro: { requests: 1000, window: '1 d' },
}

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(
    userLimits[userTier].requests,
    userLimits[userTier].window
  ),
})
```

**Layer 3: Cloudflare (DDoS Protection)**

- Challenge mode for suspicious IPs
- Block known bot user agents
- JavaScript challenge for non-browser clients

#### Rate Limit Headers

Always return rate limit info:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1700000000
```

### 4. Authentication & Authorization (Future)

**MVP**: No authentication (stateless, anonymous searches)

**Post-MVP**: When adding user accounts

#### Authentication Strategy

```typescript
// ✅ Recommended: NextAuth.js + JWT
import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  session: {
    strategy: 'jwt', // Stateless sessions (serverless-friendly)
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.tier = user.tier // 'free', 'basic', 'pro'
      }
      return token
    },
  },
}
```

#### Authorization Checks

```typescript
// ✅ Protect API routes
import { getServerSession } from 'next-auth'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check tier limits
  if (session.user.tier === 'free' && keywordCount > 10) {
    return Response.json(
      { error: 'Upgrade to search more keywords' },
      { status: 403 }
    )
  }

  // Process request
}
```

### 5. HTTPS & Transport Security

**🔴 CRITICAL CONTROL**

#### Enforced by Vercel

- All traffic automatically upgraded to HTTPS
- TLS 1.3 (modern, secure)
- HTTP/2 enabled
- HSTS header (strict transport security)

#### Additional Headers

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN', // Prevent clickjacking
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff', // Prevent MIME sniffing
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block', // XSS protection
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()', // Disable unused features
  },
]

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}
```

#### Content Security Policy (CSP)

```typescript
// Strict CSP to prevent XSS
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Next.js requires unsafe-inline
  "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
  "img-src 'self' data: https:",
  "font-src 'self'",
  "connect-src 'self' https://api.keyflash.com",
  "frame-ancestors 'none'", // No iframing
].join('; ');

headers: [
  {
    key: 'Content-Security-Policy',
    value: csp,
  },
],
```

### 6. Error Handling & Information Disclosure

**🟡 HIGH PRIORITY**

#### Safe Error Responses

```typescript
// ❌ DANGEROUS - Exposes internal details
try {
  await googleAdsAPI.searchKeywords(keywords)
} catch (error) {
  return Response.json({ error: error.message }) // Might expose API keys, stack traces!
}

// ✅ SAFE - Generic error, log details
try {
  await googleAdsAPI.searchKeywords(keywords)
} catch (error) {
  // Log full error server-side
  console.error('Keyword API error:', error)

  // Return generic error to client
  return Response.json(
    { error: 'Unable to fetch keyword data. Please try again.' },
    { status: 500 }
  )
}
```

#### Error Logging (Sentry)

```typescript
import * as Sentry from '@sentry/nextjs'

try {
  await riskyOperation()
} catch (error) {
  // Capture error with context (NO sensitive data)
  Sentry.captureException(error, {
    tags: { operation: 'keyword_search' },
    extra: {
      keywordCount: keywords.length,
      matchType: matchType,
      // ❌ DON'T LOG: API keys, user IPs, actual keyword list
    },
  })

  throw new Error('Operation failed') // Generic error
}
```

### 7. Data Privacy & Compliance

**🟡 HIGH PRIORITY**

#### Privacy by Design

**What We DON'T Store**:

- ❌ User keyword searches (unless explicitly saved by authenticated user)
- ❌ Search history
- ❌ IP addresses (except for rate limiting, 1 hour TTL)
- ❌ Browser fingerprints
- ❌ Analytics beyond aggregate metrics

**What We DO Store** (Minimal):

```typescript
// Redis cache (only for performance)
interface CachedKeywordData {
  keywords: string[] // The searched keywords
  results: KeywordData[] // API results
  cachedAt: number // Timestamp
  ttl: 604800 // 7 days
}

// ✅ No user identification in cache
// ✅ Automatic expiration (7 days)
// ✅ No cross-user data correlation
```

#### GDPR Compliance (EU Users)

1. **Lawful Basis**: Legitimate interest (providing service)
2. **Data Minimization**: Only cache keyword data (no personal data)
3. **Right to Erasure**: No user data to erase (stateless)
4. **Data Portability**: No user data to export
5. **Privacy Policy**: Required, clearly states no tracking

**Future (with user accounts)**:

- Right to access (export user data)
- Right to erasure (delete account)
- Right to rectification (update profile)
- Consent for marketing emails

#### CCPA Compliance (California Users)

- **Do Not Sell**: We don't sell user data (no user data collected)
- **Right to Know**: Disclose no personal data collection in privacy policy
- **Right to Delete**: N/A (no user data)

### 8. Dependency Security

**🟡 HIGH PRIORITY**

#### Automated Scanning

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '0 0 * * 0' # Weekly

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Snyk Security Scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Run npm audit
        run: npm audit --audit-level moderate --omit=dev

      - name: Check for outdated dependencies
        run: npm outdated
```

#### Dependency Update Policy

- **Critical vulnerabilities**: Patch within 24 hours
- **High vulnerabilities**: Patch within 7 days
- **Medium/Low**: Patch in next release
- **Automated PRs**: Dependabot creates PRs for vulnerabilities

#### Lock Files

```bash
# ✅ Always commit lock files
package-lock.json  # Ensures reproducible builds

# ❌ Never use --no-lockfile
```

### 9. API Security (External APIs)

**🟡 HIGH PRIORITY**

#### Request Signing (DataForSEO)

```typescript
// ✅ Sign requests with HMAC
import crypto from 'crypto'

function signRequest(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

// Send signed request
const signature = signRequest(JSON.stringify(payload), API_SECRET)
const response = await fetch(API_URL, {
  method: 'POST',
  headers: {
    'X-Signature': signature,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
})
```

#### Timeout & Retry Policy

```typescript
// ✅ Prevent hanging requests
const API_TIMEOUT = 10_000 // 10 seconds
const MAX_RETRIES = 2

async function fetchWithTimeout(url: string, options: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

// ✅ Exponential backoff retry
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 2 ** i * 1000))
    }
  }
  throw new Error('Max retries exceeded')
}
```

### 10. CSRF Protection Strategy

**🟡 HIGH PRIORITY**

#### Overview: What is CSRF?

Cross-Site Request Forgery (CSRF) is an attack where a malicious website tricks a user's browser into making unwanted requests to a legitimate application where the user is authenticated. The attack exploits the fact that browsers automatically include credentials (cookies, HTTP auth) with every request.

**Example Attack Scenario**:

```html
<!-- Malicious site: evil.com -->
<form action="https://keyflash.com/api/searches" method="POST">
  <input type="hidden" name="name" value="Hacked Search" />
</form>
<script>
  document.forms[0].submit() // Auto-submit when user visits evil.com
</script>
```

If the user is logged into KeyFlash, their session cookie would be automatically sent with this request, potentially creating an unwanted saved search.

#### Current Protection: Clerk Session-Based CSRF

KeyFlash currently relies on **Clerk's built-in CSRF protection** via secure session cookies:

**How Clerk Protects Against CSRF**:

1. **SameSite Cookie Attribute**: Clerk session cookies are set with `SameSite=Lax` or `SameSite=Strict`, preventing them from being sent with cross-site POST requests
2. **Secure Cookie Flag**: Cookies marked as `Secure`, only transmitted over HTTPS
3. **HttpOnly Flag**: Session cookies are `HttpOnly`, preventing JavaScript access
4. **Session Token Validation**: Clerk validates session tokens server-side on every authenticated request

**Current Implementation**:

```typescript
// API route with Clerk authentication (automatic CSRF protection)
import { auth } from '@clerk/nextjs/server'

export async function POST(request: Request) {
  const { userId } = auth()

  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Session cookie SameSite attribute prevents CSRF
  // No explicit token needed for most cases
  const body = await request.json()
  return processSavedSearch(userId, body)
}
```

#### Why Clerk's Approach is Sufficient

For KeyFlash's current architecture, Clerk's session-based CSRF protection is **acceptable because**:

1. **SameSite Cookies**: Modern browsers (95%+ market share) respect `SameSite` attributes, blocking cross-site request forgery
2. **No Sensitive State-Changing Operations**: Current API operations (keyword searches, saved searches) have limited financial impact
3. **No Financial Transactions Initiated from Client**: Payment flows handled by Stripe-hosted checkout (CSRF-protected)
4. **User Authentication Required**: All state-changing operations require Clerk authentication

**When This is NOT Sufficient**:

- Supporting older browsers that don't respect `SameSite` cookies (IE11, old Android WebView)
- High-value operations (large financial transactions, admin actions, account deletion)
- APIs consumed by third-party clients (mobile apps, desktop apps)
- Regulatory compliance requirements (PCI-DSS Level 1, HIPAA)

#### When Explicit CSRF Tokens Are Needed

You should implement **explicit CSRF token validation** when:

1. **High-Value Operations**:
   - Account deletion
   - Payment method changes
   - Subscription cancellations
   - Admin privilege escalation

2. **Broader Browser Support**:
   - Supporting IE11 or older browsers
   - Embedded WebViews without SameSite support

3. **API Endpoints Without Session Cookies**:
   - Stateless JWT authentication
   - API keys for third-party integrations
   - Webhook endpoints

4. **Compliance Requirements**:
   - PCI-DSS for payment processing
   - HIPAA for health data
   - SOC 2 certification

#### How to Implement Explicit CSRF Tokens

KeyFlash includes a CSRF utility (`src/lib/utils/csrf.ts`) ready for use when explicit tokens are needed.

**Step 1: Generate and Set CSRF Token (Server-Side)**

```typescript
// middleware.ts (Next.js middleware)
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import crypto from 'crypto'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Generate CSRF token on GET requests (safe operations)
  if (request.method === 'GET') {
    const csrfToken = crypto.randomBytes(32).toString('hex')

    // Set token as HttpOnly cookie
    response.cookies.set('csrf-token', csrfToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    })

    // Also set as readable cookie for client-side (not HttpOnly)
    response.cookies.set('csrf-token-client', csrfToken, {
      httpOnly: false,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24,
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

**Step 2: Validate CSRF Token on State-Changing Requests**

```typescript
// src/lib/utils/csrf-validation.ts
import { cookies } from 'next/headers'

export function validateCsrfToken(request: Request): boolean {
  // Only validate on state-changing methods
  const method = request.method
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return true // No validation needed for safe methods
  }

  // Get token from cookie (server-side)
  const cookieStore = cookies()
  const cookieToken = cookieStore.get('csrf-token')?.value

  // Get token from header (client-sent)
  const headerToken = request.headers.get('X-CSRF-Token')

  // Both must exist and match
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return false
  }

  return true
}

// API route with CSRF validation
export async function POST(request: Request) {
  // Validate CSRF token
  if (!validateCsrfToken(request)) {
    return Response.json({ error: 'Invalid CSRF token' }, { status: 403 })
  }

  // Proceed with request
  const body = await request.json()
  return processRequest(body)
}
```

**Step 3: Include CSRF Token in Client Requests**

```typescript
// Client-side component
import { getCsrfHeaders, fetchWithCsrf } from '@/lib/utils/csrf'

// Option 1: Manual header inclusion
async function deleteSavedSearch(searchId: string) {
  const response = await fetch(`/api/searches/${searchId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...getCsrfHeaders(), // Automatically adds X-CSRF-Token header
    },
  })

  return response.json()
}

// Option 2: Using fetchWithCsrf wrapper (recommended)
async function deleteSavedSearch(searchId: string) {
  const response = await fetchWithCsrf(`/api/searches/${searchId}`, {
    method: 'DELETE',
  })

  return response.json()
}
```

**Step 4: Form Submission with CSRF Token**

```typescript
// Server component that renders form
import { cookies } from 'next/headers'

export default function DeleteAccountForm() {
  const cookieStore = cookies()
  const csrfToken = cookieStore.get('csrf-token-client')?.value

  return (
    <form action="/api/account/delete" method="POST">
      <input type="hidden" name="csrf-token" value={csrfToken} />
      <button type="submit">Delete Account</button>
    </form>
  )
}

// API route handler
export async function POST(request: Request) {
  const formData = await request.formData()
  const formToken = formData.get('csrf-token')

  const cookieStore = cookies()
  const cookieToken = cookieStore.get('csrf-token')?.value

  if (!formToken || !cookieToken || formToken !== cookieToken) {
    return Response.json({ error: 'Invalid CSRF token' }, { status: 403 })
  }

  // Proceed with account deletion
  return deleteAccount()
}
```

#### Code Examples from csrf.ts

The existing CSRF utility provides three main functions:

**1. Get CSRF Token from Cookie**

```typescript
import { getCsrfToken } from '@/lib/utils/csrf'

const token = getCsrfToken() // Returns token or null
```

**2. Get CSRF Headers for Fetch**

```typescript
import { getCsrfHeaders } from '@/lib/utils/csrf'

const headers = getCsrfHeaders() // Returns { 'X-CSRF-Token': 'token' } or {}
```

**3. Fetch Wrapper with Automatic CSRF and Timeout**

```typescript
import { fetchWithCsrf } from '@/lib/utils/csrf'

// Automatically includes CSRF token for POST/PUT/DELETE/PATCH
// Includes 30-second timeout protection
const response = await fetchWithCsrf('/api/endpoint', {
  method: 'POST',
  body: JSON.stringify(data),
  headers: {
    'Content-Type': 'application/json',
  },
})

// Custom timeout (60 seconds)
const response = await fetchWithCsrf(
  '/api/slow-endpoint',
  {
    method: 'POST',
  },
  60000
)
```

#### Best Practices

**✅ DO**:

- Rely on Clerk's session-based protection for standard operations
- Use explicit CSRF tokens for high-value operations (account deletion, payment changes)
- Generate new CSRF token on each session (every 24 hours or on login)
- Use `fetchWithCsrf()` wrapper for consistent timeout and CSRF protection
- Validate CSRF tokens server-side (never trust client-only validation)
- Use `SameSite=Strict` for high-security operations, `Lax` for general use

**❌ DON'T**:

- Store CSRF tokens in localStorage (vulnerable to XSS)
- Use the same CSRF token across multiple users
- Implement CSRF protection on GET requests (not necessary, adds overhead)
- Disable CSRF protection "temporarily" and forget to re-enable
- Validate CSRF tokens in client-side code only

#### Testing CSRF Protection

**Manual Test**:

```html
<!-- Create test.html file outside your app -->
<!DOCTYPE html>
<html>
  <body>
    <h1>CSRF Test</h1>
    <form action="http://localhost:3000/api/searches" method="POST">
      <input type="hidden" name="name" value="CSRF Test Search" />
      <button type="submit">Submit Cross-Site Request</button>
    </form>
  </body>
</html>
```

**Expected Result**: Request should fail (403 Forbidden) due to Clerk's SameSite cookie protection.

**Automated Test**:

```typescript
// tests/security/csrf.test.ts
import { describe, it, expect } from 'vitest'

describe('CSRF Protection', () => {
  it('should reject POST request without CSRF token', async () => {
    const response = await fetch('/api/searches', {
      method: 'POST',
      credentials: 'include', // Include cookies
      headers: {
        'Content-Type': 'application/json',
        // Omit X-CSRF-Token header
      },
      body: JSON.stringify({ name: 'Test Search' }),
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Invalid CSRF token' })
  })

  it('should accept POST request with valid CSRF token', async () => {
    const token = getCsrfToken()

    const response = await fetch('/api/searches', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token,
      },
      body: JSON.stringify({ name: 'Test Search' }),
    })

    expect(response.status).toBe(200)
  })
})
```

#### Migration Path

If KeyFlash needs to add explicit CSRF token validation:

1. **Phase 1 - Monitoring** (Week 1):
   - Add CSRF token generation to middleware
   - Log CSRF validation failures (don't block yet)
   - Monitor for false positives

2. **Phase 2 - Gradual Rollout** (Week 2):
   - Enable CSRF validation for high-value operations only (account deletion, payment changes)
   - Use `fetchWithCsrf()` wrapper in client code
   - Monitor error rates

3. **Phase 3 - Full Enforcement** (Week 3):
   - Enable CSRF validation for all state-changing operations
   - Remove legacy fetch calls without CSRF headers
   - Update documentation

#### Security Considerations

**Token Storage**:

- ✅ Store CSRF token in HttpOnly cookie (server-side validation)
- ✅ Duplicate in non-HttpOnly cookie for client-side access (read-only)
- ❌ Never store in localStorage (vulnerable to XSS)

**Token Lifetime**:

- Rotate CSRF token on session change (login/logout)
- Maximum lifetime: 24 hours
- Generate new token on privilege escalation

**Token Entropy**:

- Use cryptographically secure random bytes (`crypto.randomBytes(32)`)
- Minimum 32 bytes (256 bits) of entropy
- Encode as hex or base64

**Defense in Depth**:

- CSRF protection is **one layer** of security
- Always combine with:
  - Input validation (Zod schemas)
  - Rate limiting (prevent brute force)
  - Authentication (Clerk sessions)
  - Authorization (user permissions)
  - XSS protection (CSP headers)

### 11. Monitoring & Alerting

**🟢 RECOMMENDED**

#### Security Metrics to Track

```typescript
// Sentry + Custom Metrics
const securityMetrics = {
  // Rate limiting
  'rate_limit.exceeded': 'counter',
  'rate_limit.by_ip': 'counter',

  // Input validation
  'validation.failed': 'counter',
  'validation.injection_attempt': 'counter',

  // API security
  'api.unauthorized_access': 'counter',
  'api.timeout': 'counter',
  'api.rate_limit_hit': 'counter',

  // Application errors
  'error.5xx': 'counter',
  'error.api_key_missing': 'counter',
}
```

#### Security Alerts

```typescript
// Alert on suspicious activity
if (validationErrors > 10 in 1 minute from same IP) {
  alert('Possible injection attack attempt');
  blockIP(ip, duration: '1 hour');
}

if (rateLimitExceeded > 100 in 1 minute) {
  alert('Possible DDoS attack');
  enableChallengeMode();
}

if (apiKeyMissing) {
  alert('CRITICAL: API key misconfiguration');
  pageAdmin();
}
```

## Security Checklist

### Pre-Launch Security Audit

**🔴 CRITICAL - Must Complete Before Launch**

- [ ] All API keys in environment variables (never committed)
- [ ] .env files in .gitignore
- [ ] Input validation on all API endpoints
- [ ] Rate limiting configured (10 req/hour/IP)
- [ ] HTTPS enforced (automatic via Vercel)
- [ ] Security headers configured
- [ ] Error messages don't expose internal details
- [ ] Dependencies scanned for vulnerabilities
- [ ] No sensitive data logged

**🟡 HIGH - Complete Before Public Launch**

- [ ] CSP header configured
- [ ] CORS policy restricted
- [ ] Sentry error tracking configured
- [ ] Rate limit alerts configured
- [ ] API timeout handling implemented
- [ ] Retry logic with exponential backoff
- [ ] CSRF protection documented and relying on Clerk session cookies
- [ ] CSRF utility available for high-value operations

**🟢 RECOMMENDED - Post-Launch**

- [ ] Security.txt file (responsible disclosure)
- [ ] Bug bounty program (via HackerOne)
- [ ] Penetration testing
- [ ] Quarterly security audits

### Ongoing Security Maintenance

**Weekly**:

- Review Sentry errors for security issues
- Check rate limit metrics
- Review Vercel logs for anomalies

**Monthly**:

- Update dependencies (npm update)
- Review and rotate API keys if needed
- Check for new vulnerabilities (Snyk)

**Quarterly**:

- Security code review
- Update security headers
- Review and update threat model

## Incident Response Plan

### Severity Levels

**🔴 P0 - Critical (Respond Immediately)**

- API key leak
- Active data breach
- Complete service outage
- Active DDoS attack

**🟡 P1 - High (Respond Within 1 Hour)**

- Significant vulnerability discovered
- Partial service outage
- Sustained rate limit bypass

**🟢 P2 - Medium (Respond Within 24 Hours)**

- Minor security issue
- Dependency vulnerability (low/medium severity)

### Response Steps

1. **Detect**: Monitoring alerts or user report
2. **Assess**: Determine severity and impact
3. **Contain**: Block attack vector, rate limit, disable feature
4. **Eradicate**: Fix vulnerability, rotate keys
5. **Recover**: Restore service, verify fix
6. **Learn**: Post-mortem, update security measures

### Emergency Contacts

```yaml
P0_Incidents:
  - Admin: security@buildproven.ai
  - Vercel Support: support@vercel.com
  - API Provider Support: (see provider documentation)

P1_Incidents:
  - Security Lead: security@buildproven.ai
  - Dev Team: support@buildproven.ai
```

## Security Resources

**Tools**:

- [Snyk](https://snyk.io) - Dependency vulnerability scanning
- [Sentry](https://sentry.io) - Error tracking
- [OWASP ZAP](https://www.zaproxy.org/) - Security testing

**References**:

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/security)
- [Vercel Security](https://vercel.com/docs/security)

---

**Document Version**: 1.1
**Last Updated**: 2026-01-17
**Next Security Review**: Before MVP launch
**Owner**: Technical Lead
