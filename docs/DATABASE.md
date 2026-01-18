# Database Layer

**Status**: Implemented (ARCH-003)
**Provider**: Neon Serverless Postgres
**ORM**: Prisma
**Last Updated**: 2026-01-16

## Overview

KeyFlash uses Neon Serverless Postgres with Prisma ORM for persistent data storage. This complements the existing Redis cache layer for session data and rate limiting.

## Architecture

```
┌──────────────┐
│   API Routes │
└──────┬───────┘
       │
┌──────▼─────────────┐
│  User Repository   │ ◄─── ARCH-003: New database layer
└──────┬─────────────┘
       │
┌──────▼────────┐
│  Prisma ORM   │
└──────┬────────┘
       │
┌──────▼─────────────┐
│  Neon Postgres     │ ◄─── Serverless, autoscaling
└────────────────────┘
```

## Data Models

### User

- **Purpose**: Extends Clerk authentication with app-specific data
- **Key Fields**: tier, usage tracking, subscription details
- **Relations**: SavedSearch, SearchHistory

### SavedSearch

- **Purpose**: User's saved keyword research (migrating from Redis)
- **Key Fields**: keywords array, location, language, metadata
- **Relations**: User

### SearchHistory

- **Purpose**: Analytics, trends, usage patterns
- **Key Fields**: keywords, provider, performance metrics
- **Relations**: User (optional for anonymous searches)

### APIUsage

- **Purpose**: Rate limiting analytics, billing data
- **Key Fields**: endpoint, duration, status code

### WebhookEvent

- **Purpose**: Stripe webhook idempotency and audit trail
- **Key Fields**: event ID, type, processing status

### FeatureFlag

- **Purpose**: Gradual rollouts, A/B testing
- **Key Fields**: key, enabled, rollout percentage

### SystemMetric

- **Purpose**: Infrastructure monitoring
- **Key Fields**: metric name, value, timestamp

## Setup Instructions

### 1. Install Dependencies

```bash
npm install prisma @prisma/client
npm install -D prisma
```

### 2. Configure Environment

Add to `.env.local`:

```bash
# Neon Postgres connection string
DATABASE_URL="postgres://user:pass@hostname/dbname?sslmode=require"

# Direct connection (for migrations)
DIRECT_DATABASE_URL="postgres://user:pass@hostname/dbname?sslmode=require"
```

### 3. Generate Prisma Client

```bash
npx prisma generate
```

### 4. Run Migrations

```bash
# Development
npx prisma migrate dev

# Production
npx prisma migrate deploy
```

### 5. Seed Database (Optional)

```bash
npx prisma db seed
```

## Usage Examples

### User Operations

```typescript
import { userRepository } from '@/lib/database/user-repository'

// Create user
const user = await userRepository.create({
  id: 'clerk_user_123',
  email: 'user@example.com',
  tier: 'FREE',
})

// Find user
const user = await userRepository.findById('clerk_user_123')

// Update user
await userRepository.update('clerk_user_123', {
  tier: 'PRO',
  stripeCustomerId: 'cus_123',
})

// Increment usage
await userRepository.incrementKeywordSearches('clerk_user_123', 5)

// Reset monthly usage
await userRepository.resetMonthlyUsage('clerk_user_123')
```

### Direct Prisma Queries

```typescript
import { prisma } from '@/lib/database/prisma'

// Complex queries
const searches = await prisma.savedSearch.findMany({
  where: {
    userId: 'clerk_user_123',
    createdAt: {
      gte: new Date('2026-01-01'),
    },
  },
  orderBy: {
    lastAccessedAt: 'desc',
  },
  take: 10,
})

// Aggregations
const stats = await prisma.searchHistory.aggregate({
  _count: true,
  _avg: {
    responseTime: true,
  },
  where: {
    searchedAt: {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  },
})
```

### Transactions

```typescript
import { prisma } from '@/lib/database/prisma'

await prisma.$transaction(async tx => {
  // Decrement saved search count
  await tx.user.update({
    where: { id: userId },
    data: {
      // ... updates
    },
  })

  // Delete saved search
  await tx.savedSearch.delete({
    where: { id: searchId },
  })
})
```

## Migration from Redis

### Phase 1: Dual Write (Current)

- Keep Redis for backward compatibility
- Write to both Redis and Postgres
- Read from Redis (fast)

### Phase 2: Read from Database

- Implement fallback: Try Redis → Database
- Monitor performance
- Add database caching layer if needed

### Phase 3: Redis for Cache Only

- Move primary storage to Postgres
- Use Redis only for:
  - Rate limiting
  - Session data
  - Short-term caching

## Performance Optimization

### Connection Pooling

Neon provides built-in connection pooling. Prisma client uses singleton pattern:

```typescript
// Good: Singleton (src/lib/database/prisma.ts)
export const prisma = globalForPrisma.prisma || createPrismaClient()

// Bad: Multiple instances
const prisma = new PrismaClient() // Don't do this in routes!
```

### Query Optimization

```typescript
// Use select to fetch only needed fields
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    tier: true,
    keywordSearchesThisMonth: true,
  },
})

// Use include for relations
const user = await prisma.user.findUnique({
  where: { id },
  include: {
    savedSearches: {
      take: 5,
      orderBy: { createdAt: 'desc' },
    },
  },
})

// Avoid N+1 queries
const searches = await prisma.savedSearch.findMany({
  include: {
    user: true, // Single query with join
  },
})
```

### Indexes

Already defined in schema:

- `users`: email, stripeCustomerId, createdAt
- `saved_searches`: userId + createdAt, userId + lastAccessedAt
- `search_history`: userId + searchedAt, searchedAt, provider
- `api_usage`: userId + timestamp, endpoint + timestamp

## Monitoring

### Database Health Check

```typescript
import { getDatabaseHealth } from '@/lib/database/prisma'

const health = await getDatabaseHealth()
console.log(health)
// { connected: true, responseTime: 45 }
```

### Slow Query Logging

Automatically logs queries > 500ms:

```typescript
// Configured in prisma.ts
client.$on('query', e => {
  if (e.duration > 500) {
    logger.warn('Slow database query', {
      duration: e.duration,
      query: e.query,
    })
  }
})
```

### Performance Metrics

```typescript
import { logDatabaseOperation } from '@/lib/observability/telemetry'

const start = Date.now()
const user = await prisma.user.findUnique({ where: { id } })
logDatabaseOperation('findUser', Date.now() - start, true, { userId: id })
```

## Backup & Recovery

### Neon Automatic Backups

- Point-in-time recovery
- Daily snapshots
- 7-day retention (Free tier)
- 30-day retention (Pro tier)

### Manual Backup

```bash
# Export database
pg_dump $DATABASE_URL > backup.sql

# Restore database
psql $DATABASE_URL < backup.sql
```

### Prisma Schema Backup

```bash
# Export schema
npx prisma db pull

# Creates/updates prisma/schema.prisma
```

## Testing

### Test Database Setup

```bash
# Use separate test database
DATABASE_URL="postgres://...test-db" npx prisma migrate deploy
```

### Reset Database (Dev Only)

```bash
npx prisma migrate reset
```

### Seed Test Data

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.user.create({
    data: {
      id: 'test_user_1',
      email: 'test@example.com',
      tier: 'FREE',
    },
  })
}

main()
```

## Security

### Connection Security

- SSL required for all connections
- Connection strings in environment variables
- Never commit `.env` files

### Data Protection

- User data encrypted at rest (Neon default)
- PII fields: email, IP addresses
- GDPR compliance: user deletion cascades

### Access Control

- Database credentials in env vars only
- Separate read-only user for analytics (future)
- No direct database access from frontend

## Future Enhancements

### Phase 1: Full Migration from Redis

- Move SavedSearch to database
- Move SearchHistory to database
- Keep Redis for cache/rate limiting

### Phase 2: Advanced Analytics

- Aggregate tables for dashboards
- Materialized views for reports
- Time-series data for trends

### Phase 3: Multi-tenancy

- Organization model
- Team collaboration
- Role-based access control

### Phase 4: Performance

- Read replicas for scaling
- Caching layer (Redis/Memcached)
- Query optimization and indexes

## Troubleshooting

### Connection Issues

```typescript
// Check connectivity
import { isDatabaseConnected } from '@/lib/database/prisma'

if (!(await isDatabaseConnected())) {
  console.error('Database not connected')
}
```

### Migration Conflicts

```bash
# Reset migrations (dev only)
npx prisma migrate reset

# Force deploy (production)
npx prisma migrate resolve --applied "migration_name"
```

### Prisma Client Out of Sync

```bash
# Regenerate client
npx prisma generate
```

## References

- [Prisma Documentation](https://www.prisma.io/docs)
- [Neon Documentation](https://neon.tech/docs)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Don't_Do_This)
- [Database Indexing Guide](https://use-the-index-luke.com/)

## Related Documents

- `prisma/schema.prisma` - Database schema
- `src/lib/database/prisma.ts` - Client setup
- `src/lib/database/user-repository.ts` - User operations
- `docs/ARCHITECTURE.md` - System architecture
