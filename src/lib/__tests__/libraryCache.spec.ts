import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getCachedDirectory,
  invalidateDirectoryCache,
  makeDirectoryCacheKey,
  setCachedDirectory,
} from '@/lib/libraryCache'
import type { GitHubContent } from '@/types/github'

const sampleItem: GitHubContent = {
  type: 'file',
  name: 'demo.png',
  path: 'images/demo.png',
  sha: 'abc123',
  size: 1024,
  download_url: 'https://raw.githubusercontent.com/alice/img/main/images/demo.png',
  html_url: 'https://github.com/alice/img/blob/main/images/demo.png',
}

describe('lib/libraryCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    invalidateDirectoryCache()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stores, expires after TTL, and invalidates entries cleanly', () => {
    const key = makeDirectoryCacheKey('alice', 'img', 'main', 'images')
    setCachedDirectory(key, [sampleItem])
    expect(getCachedDirectory(key)).toEqual([sampleItem])

    vi.advanceTimersByTime(61_000)
    expect(getCachedDirectory(key)).toBeNull()

    setCachedDirectory(key, [sampleItem])
    invalidateDirectoryCache(key)
    expect(getCachedDirectory(key)).toBeNull()
  })
})
