import { defineStore } from 'pinia'
import axios from 'axios'
import { getCurrentUser, getRepositories } from '@/api/github'
import { getErrorMessage } from '@/lib/errors'
import type { AppState, PreferredUrlMode, RepositoryConfig } from '@/types/app'

const TOKEN_KEY = 'imgurl.github-token'
let sessionRequestId = 0
let sessionController: AbortController | null = null

const defaultConfig = (): RepositoryConfig => ({
  fullName: '',
})

function safeStorageGet(storage: Storage): string {
  try {
    return storage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

function safeStorageRemove(storage: Storage) {
  try {
    storage.removeItem(TOKEN_KEY)
  } catch {
    // Storage may be unavailable in private or sandboxed browsing contexts.
  }
}

function persistTokenSafely(token: string, remember: boolean): boolean {
  if (!token) {
    safeStorageRemove(localStorage)
    safeStorageRemove(sessionStorage)
    return true
  }

  const target = remember ? localStorage : sessionStorage
  const fallback = remember ? sessionStorage : localStorage
  try {
    target.setItem(TOKEN_KEY, token)
  } catch {
    return false
  }
  safeStorageRemove(fallback)
  return true
}

function isUsableRepository(repository: {
  private: boolean
  archived?: boolean
  disabled?: boolean
}): boolean {
  return !repository.private && !repository.archived && !repository.disabled
}

function normalizePreferredUrl(value: unknown): PreferredUrlMode {
  if (value === 'github' || value === 'custom') return value
  return 'jsdelivr'
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    token: '',
    user: null,
    repositories: [],
    config: defaultConfig(),
    sessionStatus: 'idle',
    sessionError: '',
    uploadResults: [],
    preferences: {
      markdownAlt: 'image',
      namingMode: 'random',
      overwriteExisting: false,
      rememberToken: false,
      theme: 'system',
      preferredUrl: 'jsdelivr',
      customUrlTemplate: '',
      immediateUpload: false,
      uploadDirectory: '',
      compressImages: false,
      compressQuality: 0.85,
      convertToWebp: false,
    },
  }),
  getters: {
    isAuthenticated: (state) =>
      Boolean(state.sessionStatus === 'ready' && state.token && state.user?.login),
    activeRepository: (state) =>
      state.repositories.find((repository) => repository.full_name === state.config.fullName) ||
      null,
    isConfigured: (state) => {
      const repository = state.repositories.find(
        (candidate) => candidate.full_name === state.config.fullName,
      )
      return Boolean(
        state.sessionStatus === 'ready' &&
        state.token &&
        state.user?.login &&
        repository &&
        isUsableRepository(repository),
      )
    },
  },
  actions: {
    migratePersistedState() {
      const legacyConfig = (this.config || defaultConfig()) as RepositoryConfig & {
        directory?: unknown
      }
      const preferences = (this.preferences || {}) as Partial<AppState['preferences']>
      const legacyDirectory = legacyConfig.directory
      if (
        !preferences.uploadDirectory &&
        typeof legacyDirectory === 'string' &&
        legacyDirectory.trim()
      ) {
        preferences.uploadDirectory = legacyDirectory.trim()
      }
      const rawQuality =
        typeof preferences.compressQuality === 'number' &&
        Number.isFinite(preferences.compressQuality)
          ? preferences.compressQuality
          : 0.85
      this.preferences = {
        markdownAlt:
          typeof preferences.markdownAlt === 'string' ? preferences.markdownAlt : 'image',
        namingMode: preferences.namingMode === 'original' ? 'original' : 'random',
        overwriteExisting:
          typeof preferences.overwriteExisting === 'boolean'
            ? preferences.overwriteExisting
            : false,
        rememberToken:
          typeof preferences.rememberToken === 'boolean' ? preferences.rememberToken : false,
        theme:
          preferences.theme === 'light' || preferences.theme === 'dark'
            ? preferences.theme
            : 'system',
        preferredUrl: normalizePreferredUrl(preferences.preferredUrl),
        customUrlTemplate:
          typeof preferences.customUrlTemplate === 'string' ? preferences.customUrlTemplate : '',
        immediateUpload:
          typeof preferences.immediateUpload === 'boolean' ? preferences.immediateUpload : false,
        uploadDirectory:
          typeof preferences.uploadDirectory === 'string' ? preferences.uploadDirectory : '',
        compressImages:
          typeof preferences.compressImages === 'boolean' ? preferences.compressImages : false,
        compressQuality: Math.min(0.95, Math.max(0.5, rawQuality)),
        convertToWebp:
          typeof preferences.convertToWebp === 'boolean' ? preferences.convertToWebp : false,
      }
      this.config = {
        fullName: typeof legacyConfig.fullName === 'string' ? legacyConfig.fullName : '',
      }
    },
    restoreToken() {
      this.token = safeStorageGet(localStorage) || safeStorageGet(sessionStorage)
      if (!this.token) {
        this.user = null
        this.repositories = []
        this.config = defaultConfig()
      }
    },
    async restoreSession() {
      this.migratePersistedState()
      this.restoreToken()
      if (!this.token) {
        this.sessionStatus = 'ready'
        this.sessionError = ''
        return
      }

      sessionController?.abort()
      const controller = new AbortController()
      sessionController = controller
      const activeRequest = ++sessionRequestId
      const restoredToken = this.token
      this.sessionStatus = 'loading'
      this.sessionError = ''
      this.user = null
      this.repositories = []
      try {
        const [user, repositories] = await Promise.all([
          getCurrentUser(restoredToken, controller.signal),
          getRepositories(restoredToken, controller.signal),
        ])
        if (activeRequest !== sessionRequestId || this.token !== restoredToken) return
        this.user = user
        this.repositories = repositories
        if (this.config.fullName) {
          const repository = repositories.find((item) => item.full_name === this.config.fullName)
          if (!repository || !isUsableRepository(repository)) {
            this.config = defaultConfig()
          } else {
            this.config = { fullName: repository.full_name }
          }
        }
        this.sessionStatus = 'ready'
      } catch (error) {
        if (activeRequest !== sessionRequestId || this.token !== restoredToken) return
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          this.signOut()
          return
        }
        this.user = null
        this.repositories = []
        this.sessionStatus = 'error'
        this.sessionError = getErrorMessage(error)
      } finally {
        if (sessionController === controller) sessionController = null
      }
    },
    persistToken(token: string) {
      return persistTokenSafely(token, this.preferences.rememberToken)
    },
    async authenticate(token: string): Promise<{ persisted: boolean }> {
      const normalizedToken = token.trim()
      const previousLogin = this.user?.login
      const previousRepository = this.config.fullName
      const previousSessionError = this.sessionError
      sessionController?.abort()
      const controller = new AbortController()
      sessionController = controller
      const activeRequest = ++sessionRequestId
      this.sessionStatus = 'loading'
      this.sessionError = ''
      try {
        const [user, repositories] = await Promise.all([
          getCurrentUser(normalizedToken, controller.signal),
          getRepositories(normalizedToken, controller.signal),
        ])
        if (activeRequest !== sessionRequestId) throw new Error('身份验证已取消')
        this.token = normalizedToken
        this.user = user
        this.repositories = repositories
        const repository = repositories.find(
          (item) => item.full_name === previousRepository && isUsableRepository(item),
        )
        this.config =
          previousLogin === user.login && repository
            ? { fullName: repository.full_name }
            : defaultConfig()
        this.sessionStatus = 'ready'
        this.sessionError = ''
        const persisted = this.persistToken(normalizedToken)
        return { persisted }
      } catch (error) {
        if (activeRequest === sessionRequestId) {
          if (this.token && !this.user) {
            this.sessionStatus = 'error'
            this.sessionError = previousSessionError || getErrorMessage(error)
          } else {
            this.sessionStatus = 'ready'
          }
        }
        throw error
      } finally {
        if (sessionController === controller) sessionController = null
      }
    },
    setRememberToken(remember: boolean): boolean {
      const previous = this.preferences.rememberToken
      this.preferences.rememberToken = remember
      if (!this.token) return true
      const persisted = this.persistToken(this.token)
      if (!persisted) {
        this.preferences.rememberToken = previous
      }
      return persisted
    },
    setConfig(config: RepositoryConfig) {
      this.config = { ...config }
    },
    async refreshRepositories() {
      if (!this.token) return
      const activeToken = this.token
      sessionController?.abort()
      const controller = new AbortController()
      sessionController = controller
      const activeRequest = ++sessionRequestId
      try {
        const repositories = await getRepositories(activeToken, controller.signal)
        if (activeRequest !== sessionRequestId) return
        if (this.token !== activeToken) return
        this.repositories = repositories
        const repository = repositories.find(
          (item) => item.full_name === this.config.fullName && isUsableRepository(item),
        )
        if (!repository) this.config = defaultConfig()
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          this.signOut()
        }
        throw error
      } finally {
        if (sessionController === controller) sessionController = null
      }
    },
    signOut() {
      sessionController?.abort()
      sessionController = null
      sessionRequestId += 1
      this.token = ''
      this.user = null
      this.repositories = []
      this.config = defaultConfig()
      this.uploadResults = []
      this.sessionStatus = 'ready'
      this.sessionError = ''
      safeStorageRemove(localStorage)
      safeStorageRemove(sessionStorage)
    },
  },
  persist: {
    pick: ['config', 'preferences'],
  },
})
