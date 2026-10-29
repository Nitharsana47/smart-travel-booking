// Small read-through cache for search results (Redis when available, memory otherwise).
// Entries expire after a short TTL, and every booking or cancellation deletes the
// entries for the trips it touched, so cached availability never goes stale.
import { Redis } from 'ioredis'
import { config } from '../config'

interface Cache {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlMs: number): Promise<void>
  del(keys: string[]): Promise<void>
}

const redisCache = (r: Redis): Cache => ({
  get: (k) => r.get(k),
  set: async (k, v, ttl) => void (await r.set(k, v, 'PX', ttl)),
  del: async (keys) => void (keys.length && (await r.del(...keys))),
})

function memoryCache(): Cache {
  const m = new Map<string, { v: string; exp: number }>()
  return {
    get: async (k) => {
      const e = m.get(k)
      return e && e.exp > Date.now() ? e.v : null
    },
    set: async (k, v, ttl) => void m.set(k, { v, exp: Date.now() + ttl }),
    del: async (keys) => keys.forEach((k) => m.delete(k)),
  }
}

export const cache: Cache = config.REDIS_URL ? redisCache(new Redis(config.REDIS_URL, { maxRetriesPerRequest: 2 })) : memoryCache()

export const searchKey = (mode: string, from: string, to: string, date: string) => `search:${mode}:${from}:${to}:${date}`

/** Trip ids look like "mode~FROM~TO~date~n"; drop the cached search that listed them. */
export const invalidateTrips = (tripIds: string[]) =>
  cache.del([...new Set(tripIds.map((id) => searchKey(...(id.split('~').slice(0, 4) as [string, string, string, string]))))]).catch(() => undefined)
