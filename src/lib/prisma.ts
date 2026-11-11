import { PrismaClient } from '@prisma/client'
import { ensureSchema } from './schema-guard'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createClient() {
  const client = new PrismaClient()
  // Before the first query: add the columns a deploy brought (see schema-guard).
  // Raw queries have no model - the check itself passes straight through.
  client.$use(async (params, next) => {
    if (params.model) await ensureSchema(client)
    return next(params)
  })
  return client
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
