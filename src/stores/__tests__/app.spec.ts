import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAppStore } from '@/stores/app'

vi.mock('@/api/github', () => ({
  getCurrentUser: vi.fn(),
  getRepositories: vi.fn(),
}))

import { getCurrentUser, getRepositories } from '@/api/github'

function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => {
      map.delete(key)
    },
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  }
}

describe('stores/app', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', createMemoryStorage())
    vi.stubGlobal('sessionStorage', createMemoryStorage())
    setActivePinia(createPinia())
  })

  it('migrates legacy persisted directory and clamps quality', () => {
    const store = useAppStore()
    store.$patch({
      config: { fullName: 'alice/images', directory: 'legacy/dir' } as never,
      preferences: { compressQuality: 2.5 } as never,
    })
    store.migratePersistedState()
    expect(store.preferences.uploadDirectory).toBe('legacy/dir')
    expect(store.preferences.compressQuality).toBe(0.95)
    expect(store.config.fullName).toBe('alice/images')
  })

  it('keeps sessionStatus ready when authenticating with invalid token while logged out', async () => {
    vi.mocked(getCurrentUser).mockRejectedValueOnce(new Error('Bad credentials'))
    vi.mocked(getRepositories).mockResolvedValueOnce([])

    const store = useAppStore()
    store.sessionStatus = 'ready'

    await expect(store.authenticate('bad_token')).rejects.toThrow('Bad credentials')
    expect(store.sessionStatus).toBe('ready')
    expect(store.isAuthenticated).toBe(false)
  })

  it('preserves sessionError when re-authentication fails after a failed session restore', async () => {
    vi.mocked(getCurrentUser).mockRejectedValueOnce(new Error('Network timeout'))
    vi.mocked(getRepositories).mockResolvedValueOnce([])

    const store = useAppStore()
    store.token = 'saved_token'
    store.sessionStatus = 'error'
    store.sessionError = '网络超时'

    await expect(store.authenticate('another_bad_token')).rejects.toThrow('Network timeout')
    expect(store.sessionStatus).toBe('error')
    expect(store.sessionError).toBe('网络超时')
  })

  it('rejects private and archived repos in isConfigured', async () => {
    vi.mocked(getCurrentUser).mockResolvedValueOnce({
      login: 'alice',
      name: 'Alice',
      avatar_url: 'https://example.com/a.png',
      html_url: 'https://github.com/alice',
      location: null,
    })
    vi.mocked(getRepositories).mockResolvedValueOnce([
      {
        id: 1,
        name: 'pub',
        full_name: 'alice/pub',
        owner: { login: 'alice' },
        private: false,
        archived: false,
        default_branch: 'main',
        html_url: 'https://github.com/alice/pub',
        updated_at: '2026-01-01T00:00:00Z',
        permissions: { push: true },
      },
      {
        id: 2,
        name: 'arch',
        full_name: 'alice/arch',
        owner: { login: 'alice' },
        private: false,
        archived: true,
        default_branch: 'main',
        html_url: 'https://github.com/alice/arch',
        updated_at: '2026-01-01T00:00:00Z',
        permissions: { push: true },
      },
    ])

    const store = useAppStore()
    const { persisted } = await store.authenticate('valid_token')
    expect(persisted).toBe(true)
    expect(store.isAuthenticated).toBe(true)

    store.setConfig({ fullName: 'alice/arch' })
    expect(store.isConfigured).toBe(false)

    store.setConfig({ fullName: 'alice/pub' })
    expect(store.isConfigured).toBe(true)

    store.signOut()
    expect(store.isAuthenticated).toBe(false)
    expect(store.token).toBe('')
  })
})
