import type { GitHubRepository, GitHubUser, UploadResult } from './github'

export type PreferredUrlMode = 'github' | 'jsdelivr' | 'custom'

export interface RepositoryConfig {
  fullName: string
}

export interface AppPreferences {
  markdownAlt: string
  namingMode: 'random' | 'original'
  overwriteExisting: boolean
  rememberToken: boolean
  theme: 'light' | 'dark' | 'system'
  preferredUrl: PreferredUrlMode
  customUrlTemplate: string
  immediateUpload: boolean
  uploadDirectory: string
  compressImages: boolean
  compressQuality: number
  convertToWebp: boolean
}

export interface AppState {
  token: string
  user: GitHubUser | null
  repositories: GitHubRepository[]
  config: RepositoryConfig
  preferences: AppPreferences
  sessionStatus: 'idle' | 'loading' | 'ready' | 'error'
  sessionError: string
  uploadResults: UploadResult[]
}
