/**
 * Prisma Database Client
 * ARCH-003: Database layer for persistence (Neon Serverless Postgres)
 *
 * Singleton pattern with connection pooling for serverless environments
 */

import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/utils/logger'

// Prevent multiple instances in development (hot reload)
const globalForPrisma = global as unknown as { prisma: PrismaClient }

/**
 * Create Prisma client with logging and connection pooling
 */
function createPrismaClient() {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    // Neon connection pooling configuration
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

  // Log connection events
  client.$on('query' as never, (e: { query: string; duration: number }) => {
    if (e.duration > 500) {
      logger.warn('Slow database query', {
        module: 'Prisma',
        duration: e.duration,
        query: e.query.substring(0, 200), // Truncate for logs
      })
    }
  })

  return client
}

/**
 * Singleton Prisma client instance
 */
export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

/**
 * Disconnect Prisma client (for graceful shutdown)
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect()
  logger.info('Database disconnected', { module: 'Prisma' })
}

/**
 * Check database connectivity
 * @returns true if connected, false otherwise
 */
export async function isDatabaseConnected(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    logger.error('Database connectivity check failed', error, {
      module: 'Prisma',
    })
    return false
  }
}

/**
 * Get database connection status for health checks
 */
export async function getDatabaseHealth(): Promise<{
  connected: boolean
  responseTime?: number
  error?: string
}> {
  const start = Date.now()

  try {
    await prisma.$queryRaw`SELECT 1`
    return {
      connected: true,
      responseTime: Date.now() - start,
    }
  } catch (error) {
    return {
      connected: false,
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
