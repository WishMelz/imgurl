import { authHeaders, githubClient } from './client'
import { buildContentsEndpoint } from '@/lib/paths'
import type {
  GitHubContent,
  GitHubRepository,
  GitHubUploadResponse,
  GitHubUser,
} from '@/types/github'

export async function getCurrentUser(token: string, signal?: AbortSignal): Promise<GitHubUser> {
  const { data } = await githubClient.get<GitHubUser>('/user', {
    headers: authHeaders(token),
    signal,
  })
  return data
}

export async function getRepositories(
  token: string,
  signal?: AbortSignal,
): Promise<GitHubRepository[]> {
  const repositories: GitHubRepository[] = []
  let page = 1

  while (true) {
    const response = await githubClient.get<GitHubRepository[]>('/user/repos', {
      headers: authHeaders(token),
      params: {
        affiliation: 'owner,collaborator,organization_member',
        page,
        per_page: 100,
        sort: 'updated',
      },
      signal,
    })
    repositories.push(...response.data)
    if (!hasNextPage(response.headers.link)) break
    page += 1
  }

  return repositories.filter((repository) => repository.permissions?.push === true)
}

function hasNextPage(linkHeader: unknown): boolean {
  return typeof linkHeader === 'string' && /<[^>]+>;\s*rel="next"/.test(linkHeader)
}

export async function getRepositoryContents(
  token: string,
  owner: string,
  repository: string,
  path = '',
  ref?: string,
  signal?: AbortSignal,
): Promise<GitHubContent[]> {
  const { data } = await githubClient.get<GitHubContent | GitHubContent[]>(
    buildContentsEndpoint(owner, repository, path),
    {
      headers: authHeaders(token),
      params: ref ? { ref } : undefined,
      signal,
    },
  )
  return Array.isArray(data) ? data : [data]
}

export async function getRepositoryContent(
  token: string,
  owner: string,
  repository: string,
  path: string,
  ref?: string,
  signal?: AbortSignal,
): Promise<GitHubContent | null> {
  try {
    const { data } = await githubClient.get<GitHubContent>(
      buildContentsEndpoint(owner, repository, path),
      {
        headers: authHeaders(token),
        params: ref ? { ref } : undefined,
        signal,
      },
    )
    return data
  } catch (error: unknown) {
    if (axiosStatus(error) === 404) return null
    throw error
  }
}

export async function uploadRepositoryFile(
  token: string,
  owner: string,
  repository: string,
  path: string,
  content: string,
  branch: string,
  sha?: string,
  signal?: AbortSignal,
): Promise<GitHubUploadResponse> {
  const { data } = await githubClient.put<GitHubUploadResponse>(
    buildContentsEndpoint(owner, repository, path),
    {
      message: `Upload ${path} via ImgURL`,
      content,
      branch,
      ...(sha ? { sha } : {}),
    },
    { headers: authHeaders(token), signal },
  )
  return data
}

export async function deleteRepositoryFile(
  token: string,
  owner: string,
  repository: string,
  path: string,
  sha: string,
  branch: string,
  signal?: AbortSignal,
): Promise<void> {
  await githubClient.delete(buildContentsEndpoint(owner, repository, path), {
    headers: authHeaders(token),
    data: {
      message: `Delete ${path} via ImgURL`,
      sha,
      branch,
    },
    signal,
  })
}

function axiosStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) return undefined
  const response = (error as { response?: { status?: number } }).response
  return response?.status
}
