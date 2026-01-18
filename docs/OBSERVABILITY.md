# Observability & Monitoring

**Status**: Implemented (ARCH-005)
**Last Updated**: 2026-01-16

## Overview

KeyFlash implements comprehensive observability to enable production debugging, performance monitoring, and operational insights.

## Components

### 1. Structured Logging

All logs use structured format with contextual metadata:

```typescript
logger.info('Request completed', {
  module: 'RequestLogger',
  requestId: 'req_1234567890_abc123',
  method: 'POST',
  pathname: '/api/keywords',
  duration: 245,
  statusCode: 200,
  userId: 'user_abc123',
  cacheHit: true,
})
```

### 2. Request/Response Logging

Automatic logging for all API requests:

```typescript
import { withRequestLogging } from '@/lib/observability/request-logger'

export async function POST(request: NextRequest) {
  return withRequestLogging(request, async context => {
    // Request automatically logged with:
    // - Request ID
    // - Method, pathname
    // - User agent, IP
    // - Start time

    const response = await handleRequest()

    // Response automatically logged with:
    // - Status code
    // - Duration
    // - Cache hit/miss
    // - Provider used

    return response
  })
}
```

### 3. Performance Monitoring

Tracks and alerts on slow operations:

```typescript
// Slow requests (> 2s)
logger.warn('Slow request detected', {
  module: 'PerformanceMonitor',
  duration: 2345,
  threshold: '2000ms',
})

// Slow database operations (> 500ms)
logDatabaseOperation('getUserData', 650, true, {
  userId: 'user_123',
})

// Slow external API calls (> 3s)
logExternalAPICall('DataForSEO', 'getKeywords', 3200, true)
```

### 4. Business Metrics

Track key business indicators:

```typescript
logBusinessMetrics('hourly', {
  keywordSearches: 1247,
  contentBriefsGenerated: 89,
  relatedKeywordsRequests: 453,
  savedSearches: 234,
  checkoutAttempts: 12,
  subscriptions: 8,
  cacheHitRate: 0.87,
})
```

### 5. Circuit Breaker Monitoring

Track service health via circuit breaker events:

```typescript
logCircuitBreakerEvent('DataForSEO', 'opened', {
  failures: 5,
  threshold: 5,
  window: '60s',
})
```

## Log Levels

- **DEBUG**: Development tracing, span creation/end
- **INFO**: Normal operations, successful requests
- **WARN**: Performance issues, degraded states, client errors (4xx)
- **ERROR**: Server errors (5xx), circuit breaker opens, failures

## Request Correlation

Every request gets a unique ID for tracing:

```http
POST /api/keywords
X-Request-ID: req_1737000000_abc123

Response:
X-Request-ID: req_1737000000_abc123
```

All logs for that request include the same `requestId` for correlation.

## Performance Thresholds

| Operation      | Threshold | Alert Level |
| -------------- | --------- | ----------- |
| API Request    | 2000ms    | WARN        |
| Database Query | 500ms     | WARN        |
| External API   | 3000ms    | WARN        |
| Cache Read     | 100ms     | WARN        |

## Metrics Collected

### Request Metrics

- Duration (ms)
- Status code
- Endpoint
- Method
- User ID (if authenticated)
- Cache hit/miss
- Provider used
- Keyword count

### System Health

- Redis connectivity
- Provider health
- Circuit breaker state
- Response times

### Business Metrics

- Keyword searches per hour/day
- Content briefs generated
- Related keywords requests
- Saved searches created
- Checkout attempts
- Active subscriptions
- API call volume
- Cache hit rate (%)

## Usage Examples

### Adding Performance Tracking

```typescript
import { logExternalAPICall } from '@/lib/observability/telemetry'

const start = Date.now()
try {
  const result = await externalAPI.call()
  logExternalAPICall('ProviderName', 'operation', Date.now() - start, true)
  return result
} catch (error) {
  logExternalAPICall('ProviderName', 'operation', Date.now() - start, false, {
    error: error.message,
  })
  throw error
}
```

### Adding Cache Metrics

```typescript
import { logCacheOperation } from '@/lib/observability/telemetry'

const start = Date.now()
const cached = await cache.get(key)
logCacheOperation('get', !!cached, Date.now() - start, {
  key,
  hit: !!cached,
})
```

### Adding Database Metrics

```typescript
import { logDatabaseOperation } from '@/lib/observability/telemetry'

const start = Date.now()
try {
  const user = await db.user.findUnique({ where: { id } })
  logDatabaseOperation('findUser', Date.now() - start, true, { userId: id })
  return user
} catch (error) {
  logDatabaseOperation('findUser', Date.now() - start, false, {
    userId: id,
    error: error.message,
  })
  throw error
}
```

## Future Enhancements

### Phase 1: Export to Observability Platforms

- **Sentry**: Error tracking and performance monitoring
- **LogDNA/Datadog**: Log aggregation and analysis
- **Prometheus**: Metrics collection and alerting

### Phase 2: Full OpenTelemetry Integration

- **Traces**: Distributed tracing across services
- **Metrics**: Counter, gauge, histogram instruments
- **Exporters**: Jaeger, Prometheus, CloudWatch

### Phase 3: Dashboards & Alerts

- **Grafana**: Real-time monitoring dashboards
- **PagerDuty**: On-call alerting
- **Custom dashboards**: Business metrics visualization

### Phase 4: Advanced Features

- **Distributed tracing**: End-to-end request flows
- **APM**: Application performance monitoring
- **RUM**: Real user monitoring (frontend)
- **Synthetic monitoring**: Uptime checks

## Configuration

### Environment Variables

```bash
# Enable detailed logging
LOG_LEVEL=debug

# Sentry DSN (when integrated)
SENTRY_DSN=https://...

# OpenTelemetry endpoint (when integrated)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

## Monitoring Best Practices

1. **Always log with context**: Include requestId, userId, etc.
2. **Use appropriate log levels**: Don't use ERROR for expected failures
3. **Track performance**: Log duration for expensive operations
4. **Correlate logs**: Use requestId to trace requests
5. **Monitor business metrics**: Track what matters to users
6. **Alert on anomalies**: Set up alerts for slow operations
7. **Review logs regularly**: Identify patterns and issues

## References

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Structured Logging Best Practices](https://www.datadoghq.com/blog/structured-logging/)
- [Observability Engineering Book](https://www.oreilly.com/library/view/observability-engineering/9781492076438/)
- [The Three Pillars of Observability](https://www.oreilly.com/library/view/distributed-systems-observability/9781492033431/ch04.html)

## Related Documents

- `src/lib/observability/telemetry.ts` - Core telemetry utilities
- `src/lib/observability/request-logger.ts` - Request logging middleware
- `src/lib/utils/logger.ts` - Logger implementation
- `docs/CIRCUIT_BREAKER.md` - Circuit breaker monitoring
