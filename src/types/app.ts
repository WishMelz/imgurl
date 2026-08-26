import type { GitHubRepository, GitHubUser } from './github'

export interface RepositoryConfig {
  fullName: string
}

export interface AppPreferences {
  markdownAlt: string
  namingMode: 'random' | 'original'
  overwriteExisting: boolean
  rememberToken: boolean
  theme: 'light' | 'dark' | 'system'
  preferredUrl: 'github' | 'jsdelivr'
  immediateUpload: boolean
  uploadDirectory: string
}

export interface AppState {
  token: string
  user: GitHubUser | null
  repositories: GitHubRepository[]
  config: RepositoryConfig
  preferences: AppPreferences
  sessionStatus: 'idle' | 'loading' | 'ready' | 'error'
  sessionError: string
}
