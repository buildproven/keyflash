# Circuit Breaker Pattern

**Status**: Implemented (ARCH-002)
**Provider**: DataForSEO
**Last Updated**: 2026-01-16

## Overview

The circuit breaker pattern prevents cascading failures by monitoring external service health and failing fast when a dependency is unavailable. This ensures the application remains responsive even when external APIs experience outages.

## Implementation

### Circuit States

The circuit breaker operates in three states:

```
CLOSED → OPEN → HALF_OPEN → CLOSED
  ↑                            ↓
  └────────────────────────────┘
```

#### CLOSED (Normal Operation)

- All requests pass through to the external service
- Failures are counted within a sliding time window
- Transitions to OPEN after threshold failures

#### OPEN (Service Down)

- All requests fail immediately without calling the service
- Returns fallback data for graceful degradation
- After timeout period, transitions to HALF_OPEN

#### HALF_OPEN (Testing Recovery)

- Limited requests allowed to test if service recovered
- Success → increment success counter
- Failure → return to OPEN
- After success threshold → transitions to CLOSED

### Configuration

Default settings for DataForSEO:

```typescript
{
  failureThreshold: 5,      // Open after 5 failures
  failureWindow: 60_000,    // Within 60 seconds
  resetTimeout: 60_000,     // Wait 60s before retry
  successThreshold: 2       // Close after 2 successes
}
```

## Usage

### DataForSEO Provider

The DataForSEO provider automatically uses circuit breaker protection:

```typescript
// Circuit breaker wraps all API calls
const keywords = await provider.getKeywordData(['seo tools'], {
  location: 'US',
  language: 'en',
})

// If circuit is OPEN, returns fallback data instead of throwing
```

### Monitoring

Check circuit breaker health via health endpoint:

```bash
curl https://keyflash.vibebuildlab.com/api/health
```

Response includes circuit breaker stats:

```json
{
  "status": "healthy",
  "checks": {
    "provider": {
      "healthy": true,
      "details": {
        "provider": "dataforseo",
        "circuitBreaker": {
          "healthy": true,
          "state": "CLOSED",
          "failures": 0,
          "successes": 42,
          "totalRequests": 42,
          "totalFailures": 0,
          "totalSuccesses": 42
        }
      }
    }
  }
}
```

### Provider Health Check

```typescript
import { createProvider } from '@/lib/api/factory'

const provider = createProvider()

// Check if provider is healthy (circuit not open)
if ('isHealthy' in provider && typeof provider.isHealthy === 'function') {
  const healthy = provider.isHealthy()
  console.log(`Provider healthy: ${healthy}`)
}

// Get detailed stats
if ('getCircuitBreakerStats' in provider) {
  const stats = provider.getCircuitBreakerStats()
  console.log('Circuit breaker stats:', stats)
}
```

## Fallback Strategy

When circuit breaker is OPEN, the system gracefully degrades:

### Fallback Data

Returns basic keyword structure with:

- Keyword string
- Empty search volume (0)
- Unknown competition level
- No CPC data
- No trend data

This allows the UI to continue functioning without displaying real data.

### User Experience

- API returns 200 OK (not 503)
- Response includes fallback data
- Client can detect fallback via missing/zero values
- Users see partial functionality instead of errors

## Failure Scenarios

### Scenario 1: DataForSEO API Down

1. **Request 1-4**: Failures recorded, requests still attempted
2. **Request 5**: Circuit opens (threshold reached)
3. **Request 6+**: Fail fast, return fallback data
4. **After 60s**: Circuit transitions to HALF_OPEN
5. **Test request**: If succeeds, continue testing
6. **After 2 successes**: Circuit closes, normal operation resumes

### Scenario 2: Intermittent Failures

1. **3 failures** within 60s window
2. Circuit remains CLOSED (below threshold)
3. **1 success** resets failure count
4. Normal operation continues

### Scenario 3: Slow Recovery

1. Circuit opens after 5 failures
2. After 60s, transitions to HALF_OPEN
3. **First test fails** → back to OPEN
4. Wait another 60s
5. **Next test succeeds** → increment counter
6. **Second test succeeds** → circuit closes

## Metrics & Logging

### Log Events

Circuit breaker logs key events:

```typescript
// Failure recorded
logger.warn('Circuit breaker recorded failure', {
  name: 'DataForSEO',
  state: 'CLOSED',
  failures: 3,
  threshold: 5,
})

// Circuit opened
logger.error('Circuit breaker opened (service unhealthy)', {
  name: 'DataForSEO',
  failures: 5,
  nextAttemptTime: '2026-01-16T12:34:56Z',
})

// Recovery attempt
logger.info('Circuit breaker attempting recovery', {
  name: 'DataForSEO',
  previousState: 'OPEN',
  newState: 'HALF_OPEN',
})

// Circuit closed
logger.info('Circuit breaker closing (service recovered)', {
  name: 'DataForSEO',
  previousState: 'HALF_OPEN',
  newState: 'CLOSED',
})
```

### Statistics Tracked

- `state`: Current circuit state
- `failures`: Recent failure count (within window)
- `successes`: Success count in HALF_OPEN state
- `lastFailureTime`: Timestamp of last failure
- `lastSuccessTime`: Timestamp of last success
- `nextAttemptTime`: When HALF_OPEN will be attempted
- `totalRequests`: Lifetime request count
- `totalFailures`: Lifetime failure count
- `totalSuccesses`: Lifetime success count

## Testing

### Simulate Circuit Opening

```typescript
// Make 5 rapid requests that fail
for (let i = 0; i < 5; i++) {
  try {
    await provider.getKeywordData(['invalid-keyword!!!'], {
      location: 'INVALID',
      language: 'xx',
    })
  } catch (error) {
    console.log(`Failure ${i + 1}`)
  }
}

// Circuit should now be OPEN
const stats = provider.getCircuitBreakerStats()
console.assert(stats.state === 'OPEN')

// Next request fails fast with fallback
const result = await provider.getKeywordData(['seo tools'], {
  location: 'US',
  language: 'en',
})
console.log('Got fallback data:', result)
```

### Test Recovery

```typescript
// Wait for reset timeout
await new Promise(resolve => setTimeout(resolve, 61_000))

// Make successful request
const result = await provider.getKeywordData(['seo tools'], {
  location: 'US',
  language: 'en',
})

// Circuit transitions to HALF_OPEN, then CLOSED after 2 successes
```

## Future Enhancements

Potential improvements:

1. **Adaptive thresholds**: Adjust based on error rate
2. **Multiple backends**: Failover to secondary provider
3. **Metrics export**: Prometheus/StatsD integration
4. **Dashboard**: Real-time circuit breaker visualization
5. **Custom fallback strategies**: Per-endpoint fallback logic
6. **Rate-based triggers**: Open on high latency, not just failures

## References

- [Martin Fowler - CircuitBreaker](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Microsoft - Circuit Breaker Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
- [AWS - Circuit Breaker Pattern](https://aws.amazon.com/builders-library/using-circuit-breakers-to-protect-services/)

## Related Documents

- `src/lib/circuit-breaker/circuit-breaker.ts` - Implementation
- `src/lib/api/providers/dataforseo.ts` - Provider integration
- `docs/ARCHITECTURE.md` - System architecture
- `docs/API_VERSIONING.md` - API versioning strategy
