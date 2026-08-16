import { defineStore } from 'pinia'
import axios from 'axios'
import { getCurrentUser, getRepositories } from '@/api/github'
import { getErrorMessage } from '@/lib/errors'
import type { AppState, RepositoryConfig } from '@/types/app'

const TOKEN_KEY = 'imgurl.github-token'
let sessionRequestId = 0

const defaultConfig = (): RepositoryConfig => ({
  owner: '',
  repository: '',
  fullName: '',
  branch: '',
  directory: '',
  isPrivate: false,
})

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
    },
  }),
  getters: {
    isAuthenticated: (state) =>
      Boolean(state.sessionStatus === 'ready' && state.token && state.user?.login),
    isConfigured: (state) =>
      Boolean(
        state.sessionStatus === 'ready' &&
        state.token &&
        state.user?.login &&
        state.config.owner &&
        state.config.repository &&
        state.config.branch &&
        !state.config.isPrivate,
      ),
    activeDirectory: (state) => state.config.directory,
  },
  actions: {
    restoreToken() {
      this.token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''
      if (!this.token) {
        this.user = null
        this.repositories = []
        this.config = defaultConfig()
      }
    },
    async restoreSession() {
      const previousLogin = this.user?.login
      this.restoreToken()
      if (!this.token) {
        this.sessionStatus = 'ready'
        this.sessionError = ''
        return
      }

      const activeRequest = ++sessionRequestId
      const restoredToken = this.token
      this.sessionStatus = 'loading'
      this.sessionError = ''
      this.user = null
      this.repositories = []
      try {
        const [user, repositories] = await Promise.all([
          getCurrentUser(restoredToken),
          getRepositories(restoredToken),
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
            this.config = {
              ...this.config,
              owner: repository.owner.login,
              repository: repository.name,
              fullName: repository.full_name,
              isPrivate: repository.private,
            }
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
      }
    },
    persistToken(token: string) {
      localStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(TOKEN_KEY)
      if (!token) return
      const storage = this.preferences.rememberToken ? localStorage : sessionStorage
      storage.setItem(TOKEN_KEY, token)
    },
    async authenticate(token: string) {
      const normalizedToken = token.trim()
      const activeRequest = ++sessionRequestId
      const user = await getCurrentUser(normalizedToken)
      const repositories = await getRepositories(normalizedToken)
      if (activeRequest !== sessionRequestId) throw new Error('身份验证已取消')
      this.token = normalizedToken
      this.user = user
      this.repositories = repositories
      this.config = defaultConfig()
      this.sessionStatus = 'ready'
      this.sessionError = ''
      this.persistToken(normalizedToken)
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
      const repositories = await getRepositories(activeToken)
      if (this.token === activeToken) this.repositories = repositories
    },
    signOut() {
      sessionRequestId += 1
      this.token = ''
      this.user = null
      this.repositories = []
      this.config = defaultConfig()
      this.sessionStatus = 'ready'
      this.sessionError = ''
      localStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(TOKEN_KEY)
    },
  },
  persist: {
    pick: ['user', 'config', 'preferences'],
  },
})
