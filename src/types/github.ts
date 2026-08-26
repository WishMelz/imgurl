export interface GitHubUser {
  login: string
  name: string | null
  avatar_url: string
  html_url: string
  location: string | null
}

export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  owner: {
    login: string
  }
  private: boolean
  default_branch: string
  html_url: string
  updated_at: string
  permissions?: {
    push?: boolean
  }
}

export interface GitHubContent {
  type: 'file' | 'dir' | 'symlink' | 'submodule'
  name: string
  path: string
  sha: string
  size: number
  download_url: string | null
  html_url: string
}

export interface GitHubUploadResponse {
  content: GitHubContent | null
  commit: {
    sha: string
    html_url: string
  }
}

export interface UploadResult {
  id: string
  sourceName: string
  fileName: string
  path: string
  status: 'queued' | 'uploading' | 'success' | 'error'
  progress: number
  githubUrl?: string
  cdnUrl?: string
  selectedUrl?: string
  markdown?: string
  bbcode?: string
  html?: string
  error?: string
}
