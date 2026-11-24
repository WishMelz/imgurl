import type { GitHubContent } from '@/types/github'

const CACHE_TTL_MS = 60_000

interface CacheEntry {
  items: GitHubContent[]
  cachedAt: number
}

const directoryCache = new Map<string, CacheEntry>()

export function makeDirectoryCacheKey(
  owner: string,
  repository: string,
  branch: string,
  path: string,
): string {
  return `${owner}/${repository}@${branch}:${path}`
}

export function getCachedDirectory(key: string): GitHubContent[] | null {
  const entry = directoryCache.get(key)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    directoryCache.delete(key)
    return null
  }
  return entry.items
}

export function setCachedDirectory(key: string, items: GitHubContent[]): void {
  directoryCache.set(key, { items, cachedAt: Date.now() })
}

export function invalidateDirectoryCache(key?: string): void {
  if (key) {
    directoryCache.delete(key)
  } else {
    directoryCache.clear()
  }
}
