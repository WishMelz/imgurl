import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { githubClient } from '@/api/client'
import { getRepositories, getRepositoryContent, getRepositoryContents } from '@/api/github'

describe('api/github', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('passes fetch no-store cache options on GET contents endpoints', async () => {
    const getSpy = vi.spyOn(githubClient, 'get').mockResolvedValueOnce({
      data: [],
      headers: {},
    } as never)

    await getRepositoryContents('tok', 'alice', 'img', 'photos', 'main')

    expect(getSpy).toHaveBeenCalledWith(
      '/repos/alice/img/contents/photos',
      expect.objectContaining({
        adapter: ['fetch', 'xhr'],
        fetchOptions: { cache: 'no-store' },
        params: { ref: 'main' },
      }),
    )
  })

  it('returns null on 404 and throws when target path is an existing directory', async () => {
    vi.spyOn(githubClient, 'get').mockRejectedValueOnce(
      new AxiosError('Not Found', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 404,
        statusText: 'Not Found',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { message: 'Not Found' },
      }),
    )
    expect(await getRepositoryContent('tok', 'alice', 'img', 'missing.png', 'main')).toBeNull()

    vi.spyOn(githubClient, 'get').mockResolvedValueOnce({
      data: [{ type: 'file', name: 'nested.png', path: 'dir/nested.png', sha: '1', size: 10 }],
      headers: {},
    } as never)
    await expect(getRepositoryContent('tok', 'alice', 'img', 'dir', 'main')).rejects.toThrow(
      '已存在的目录',
    )
  })

  it('caps repository pagination at 20 pages', async () => {
    const getSpy = vi.spyOn(githubClient, 'get').mockResolvedValue({
      data: [
        {
          id: 1,
          name: 'img',
          full_name: 'alice/img',
          owner: { login: 'alice' },
          private: false,
          default_branch: 'main',
          html_url: 'https://github.com/alice/img',
          updated_at: '2026-01-01T00:00:00Z',
          permissions: { push: true },
        },
      ],
      headers: {
        link: '<https://api.github.com/user/repos?page=2>; rel="next"',
      },
    } as never)

    const repos = await getRepositories('tok')
    expect(getSpy).toHaveBeenCalledTimes(20)
    expect(repos).toHaveLength(20)
  })
})
