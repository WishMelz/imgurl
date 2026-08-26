import { defineStore } from 'pinia'
import axios from 'axios'
import { getCurrentUser, getRepositories } from '@/api/github'
import { getErrorMessage } from '@/lib/errors'
import type { AppState, RepositoryConfig } from '@/types/app'

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

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    token: '',
    user: null,
    repositories: [],
    config: defaultConfig(),
    sessionStatus: 'idle',
    sessionError: '',
    preferences: {
      markdownAlt: 'image',
      namingMode: 'random',
      overwriteExisting: false,
      rememberToken: false,
      theme: 'system',
      preferredUrl: 'jsdelivr',
      immediateUpload: false,
      uploadDirectory: '',
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
        !repository.private,
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
        preferredUrl: preferences.preferredUrl === 'github' ? 'github' : 'jsdelivr',
        immediateUpload:
          typeof preferences.immediateUpload === 'boolean' ? preferences.immediateUpload : false,
        uploadDirectory:
          typeof preferences.uploadDirectory === 'string' ? preferences.uploadDirectory : '',
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
      const previousLogin = this.user?.login
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
        if (previousLogin && previousLogin !== user.login) this.config = defaultConfig()
        this.user = user
        this.repositories = repositories
        if (this.config.fullName) {
          const repository = repositories.find((item) => item.full_name === this.config.fullName)
          if (!repository || repository.private) {
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
    async authenticate(token: string) {
      const normalizedToken = token.trim()
      const previousLogin = this.user?.login
      const previousRepository = this.config.fullName
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
          (item) => item.full_name === previousRepository && !item.private,
        )
        this.config =
          previousLogin === user.login && repository
            ? { fullName: repository.full_name }
            : defaultConfig()
        this.sessionStatus = 'ready'
        if (!this.persistToken(normalizedToken)) {
          this.sessionError = 'Token 无法写入浏览器存储，本次连接仅在当前页面有效'
        }
      } catch (error) {
        if (activeRequest === sessionRequestId) this.sessionStatus = this.token ? 'ready' : 'error'
        throw error
      } finally {
        if (sessionController === controller) sessionController = null
      }
    },
    setRememberToken(remember: boolean) {
      this.preferences.rememberToken = remember
      this.persistToken(this.token)
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
          (item) => item.full_name === this.config.fullName && !item.private,
        )
        if (!repository) this.config = defaultConfig()
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
      this.sessionStatus = 'ready'
      this.sessionError = ''
      safeStorageRemove(localStorage)
      safeStorageRemove(sessionStorage)
    },
  },
  persist: {
    pick: ['user', 'config', 'preferences'],
  },
})
