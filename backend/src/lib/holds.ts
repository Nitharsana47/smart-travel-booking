// Temporary seat holds. While a traveller fills in details and pays, their
// seats are reserved with a 5-minute expiry, so nobody else can pick them.
//
// Redis is the real store: one key per seat, `hold:<tripId>:<seatId>` = holdId,
// written with a Lua script so a multi-seat hold is all-or-nothing and atomic
// even with many servers. Keys expire on their own (PX), so abandoned
// checkouts free their seats without any cleanup job.
//
// Without REDIS_URL an in-memory store with the same behaviour is used, which
// is fine for a single dev server and for tests.
import { Redis } from 'ioredis'
import { config } from '../config'

export interface HoldStore {
  /** Reserve every key for `owner`, or none of them. Returns the keys held by someone else. */
  acquire(keys: string[], owner: string, ttlMs: number): Promise<{ ok: true } | { ok: false; conflicts: string[] }>
  /** Release keys, but only those still owned by `owner`. */
  release(keys: string[], owner: string): Promise<void>
  /** Current owner of each key (null when free). */
  owners(keys: string[]): Promise<(string | null)[]>
  setMeta(holdId: string, meta: HoldMeta, ttlMs: number): Promise<void>
  getMeta(holdId: string): Promise<HoldMeta | null>
  close(): Promise<void>
}

export interface HoldMeta {
  userId: string
  keys: string[]
  expiresAt: number
}

export const seatKey = (tripId: string, seatId: string) => `hold:${tripId}:${seatId}`

// KEYS = seat keys, ARGV[1] = owner, ARGV[2] = ttl ms.
// First pass: collect keys owned by someone else. Only if there are none, set them all.
const ACQUIRE = `
local conflicts = {}
for i, k in ipairs(KEYS) do
  local v = redis.call('GET', k)
  if v and v ~= ARGV[1] then table.insert(conflicts, k) end
end
if #conflicts > 0 then return conflicts end
for i, k in ipairs(KEYS) do redis.call('SET', k, ARGV[1], 'PX', ARGV[2]) end
return {}
`
const RELEASE = `
for i, k in ipairs(KEYS) do
  if redis.call('GET', k) == ARGV[1] then redis.call('DEL', k) end
end
return 1
`

class RedisHoldStore implements HoldStore {
  constructor(private redis: Redis) {}
  async acquire(keys: string[], owner: string, ttlMs: number) {
    if (!keys.length) return { ok: true as const }
    const conflicts = (await this.redis.eval(ACQUIRE, keys.length, ...keys, owner, String(ttlMs))) as string[]
    return conflicts.length ? { ok: false as const, conflicts } : { ok: true as const }
  }
  async release(keys: string[], owner: string) {
    if (keys.length) await this.redis.eval(RELEASE, keys.length, ...keys, owner)
  }
  async owners(keys: string[]) {
    return keys.length ? this.redis.mget(...keys) : []
  }
  async setMeta(holdId: string, meta: HoldMeta, ttlMs: number) {
    await this.redis.set(`holdmeta:${holdId}`, JSON.stringify(meta), 'PX', ttlMs)
  }
  async getMeta(holdId: string) {
    const raw = await this.redis.get(`holdmeta:${holdId}`)
    return raw ? (JSON.parse(raw) as HoldMeta) : null
  }
  async close() {
    await this.redis.quit()
  }
}

class MemoryHoldStore implements HoldStore {
  private keys = new Map<string, { owner: string; exp: number }>()
  private meta = new Map<string, { meta: HoldMeta; exp: number }>()
  private live(k: string) {
    const v = this.keys.get(k)
    if (v && v.exp <= Date.now()) this.keys.delete(k)
    return this.keys.get(k) ?? null
  }
  async acquire(keys: string[], owner: string, ttlMs: number) {
    // JavaScript is single-threaded and there is no await between check and set, so this is atomic.
    const conflicts = keys.filter((k) => {
      const v = this.live(k)
      return v && v.owner !== owner
    })
    if (conflicts.length) return { ok: false as const, conflicts }
    for (const k of keys) this.keys.set(k, { owner, exp: Date.now() + ttlMs })
    return { ok: true as const }
  }
  async release(keys: string[], owner: string) {
    for (const k of keys) if (this.live(k)?.owner === owner) this.keys.delete(k)
  }
  async owners(keys: string[]) {
    return keys.map((k) => this.live(k)?.owner ?? null)
  }
  async setMeta(holdId: string, meta: HoldMeta, ttlMs: number) {
    this.meta.set(holdId, { meta, exp: Date.now() + ttlMs })
  }
  async getMeta(holdId: string) {
    const v = this.meta.get(holdId)
    return v && v.exp > Date.now() ? v.meta : null
  }
  async close() {}
}

export const holds: HoldStore = config.REDIS_URL ? new RedisHoldStore(new Redis(config.REDIS_URL, { maxRetriesPerRequest: 2 })) : new MemoryHoldStore()
export const holdBackend = config.REDIS_URL ? 'redis' : 'memory'
