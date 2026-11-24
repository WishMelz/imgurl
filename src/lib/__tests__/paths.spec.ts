import { describe, expect, it } from 'vitest'
import {
  buildContentsEndpoint,
  buildCustomUrl,
  buildGitHubRawUrl,
  buildJsDelivrUrl,
  encodeRepositoryPath,
  joinRepositoryPath,
  normalizeRepositoryPath,
  resolvePreferredUrl,
  validateCustomUrlTemplate,
  validateRepositoryDirectory,
} from '@/lib/paths'

describe('lib/paths', () => {
  it('normalizes and validates repository directories', () => {
    expect(normalizeRepositoryPath(' /images\\2026//sub/ ')).toBe('images/2026/sub')
    expect(joinRepositoryPath('images/', '/2026', 'a.png')).toBe('images/2026/a.png')
    expect(validateRepositoryDirectory('images/2026')).toBeNull()
    expect(validateRepositoryDirectory('images/../secret')).toBeTruthy()
    expect(validateRepositoryDirectory('images/\u0000bad')).toBeTruthy()
  })

  it('encodes RFC3986 path segments and builds URLs', () => {
    expect(encodeRepositoryPath("dir/a (1)'s!.png")).toBe('dir/a%20%281%29%27s%21.png')
    expect(buildJsDelivrUrl('alice', 'img', 'main', 'a/b.png')).toBe(
      'https://cdn.jsdelivr.net/gh/alice/img@main/a/b.png',
    )
    expect(buildGitHubRawUrl('alice', 'img', 'main', 'a/b.png')).toBe(
      'https://raw.githubusercontent.com/alice/img/main/a/b.png',
    )
    expect(buildJsDelivrUrl('alice', 'img', 'feat/images', 'a/b.png')).toBe(
      'https://cdn.jsdelivr.net/gh/alice/img@feat/images/a/b.png',
    )
    expect(buildGitHubRawUrl('alice', 'img', 'feat/images', 'a/b.png')).toBe(
      'https://raw.githubusercontent.com/alice/img/feat/images/a/b.png',
    )
    expect(buildContentsEndpoint('alice', 'img', 'a/b.png')).toBe(
      '/repos/alice/img/contents/a/b.png',
    )
  })

  it('validates and resolves custom CDN templates', () => {
    expect(validateCustomUrlTemplate('')).toBeTruthy()
    expect(validateCustomUrlTemplate('ftp://cdn.test/{path}')).toBeTruthy()
    expect(validateCustomUrlTemplate('https://cdn.test/no-placeholder')).toBeTruthy()
    expect(validateCustomUrlTemplate('https://cdn.test/{owner}/{repo}/{branch}/{path}')).toBeNull()

    expect(
      buildCustomUrl(
        'https://cdn.test/{owner}/{repo}/{branch}/{path}',
        'alice',
        'img',
        'main',
        'x/y.png',
      ),
    ).toBe('https://cdn.test/alice/img/main/x/y.png')

    expect(
      resolvePreferredUrl({
        mode: 'custom',
        customTemplate: 'https://img.example.com/{path}',
        owner: 'alice',
        repository: 'img',
        branch: 'main',
        path: '2026/pic.webp',
      }),
    ).toBe('https://img.example.com/2026/pic.webp')
  })
})
