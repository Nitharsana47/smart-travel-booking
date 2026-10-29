import { app } from './app'
import { config } from './config'
import { prisma } from './lib/db'
import { holdBackend, holds } from './lib/holds'

const server = app.listen(config.PORT, () => {
  console.log(`SkyVoyage API on http://localhost:${config.PORT} (seat holds: ${holdBackend})`)
})

// Finish in-flight requests, then close database connections.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(async () => {
      await Promise.all([prisma.$disconnect(), holds.close()])
      process.exit(0)
    })
  })
}
