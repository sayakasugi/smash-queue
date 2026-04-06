// In-memory cache with TTL
// Vercel Functions share memory within the same instance,
// so multiple requests hitting the same instance will benefit from cache

const cache = new Map<string, { data: unknown; expiresAt: number }>()

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

export function setCache(key: string, data: unknown, ttlMs: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs })
}

export function invalidateCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

export function invalidateAll(): void {
  cache.clear()
}

// Cache TTLs
export const CACHE_TTL = {
  SETUP_STATUS: 5000,    // 台一覧: 5秒
  SETUP_DETAIL: 3000,    // 台詳細: 3秒
  RECRUITMENTS: 3000,    // 募集一覧: 3秒
  TEMPLATES: 30000,      // テンプレート: 30秒
  TOURNAMENT: 10000,     // 大会情報: 10秒
  MY_STATUS: 3000,       // 自分のステータス: 3秒
} as const
