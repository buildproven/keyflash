// Prisma configuration for connection URLs
// Prisma v7+ requires connection URLs in config file instead of schema

export default {
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
      directUrl: process.env.DIRECT_DATABASE_URL,
    },
  },
}
