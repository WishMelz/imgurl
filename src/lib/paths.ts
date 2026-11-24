import type { PreferredUrlMode } from '@/types/app'

const trimSlashes = (value: string) => value.trim().replace(/^\/+|\/+$/g, '')

export function normalizeRepositoryPath(value: string): string {
  return trimSlashes(value.replace(/\\/g, '/').replace(/\/{2,}/g, '/'))
}

export function validateRepositoryDirectory(value: string): string | null {
  const segments = normalizeRepositoryPath(value).split('/').filter(Boolean)
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return '目录不能包含 . 或 .. 相对路径'
  }
  if (
    segments.some((segment) =>
      Array.from(segment).some((character) => {
        const code = character.charCodeAt(0)
        return code < 32 || code === 127
      }),
    )
  ) {
    return '目录不能包含控制字符'
  }
  return null
}

export function joinRepositoryPath(...parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .map(normalizeRepositoryPath)
    .filter(Boolean)
    .join('/')
}

export function encodeRepositoryPath(path: string): string {
  return normalizeRepositoryPath(path)
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment).replace(/[!'()*]/g, encodeRfc3986Character))
    .join('/')
}

function encodeRfc3986Character(character: string): string {
  return `%${character.charCodeAt(0).toString(16).toUpperCase()}`
}

function encodeBranchRef(branch?: string): string {
  return encodeRepositoryPath(branch || 'main') || 'main'
}

export function buildJsDelivrUrl(
  owner: string,
  repository: string,
  branch: string,
  path: string,
): string {
  const ref = encodeBranchRef(branch)
  return `https://cdn.jsdelivr.net/gh/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}@${ref}/${encodeRepositoryPath(path)}`
}

export function buildJsDelivrPurgeUrl(
  owner: string,
  repository: string,
  branch: string,
  path: string,
): string {
  const ref = encodeBranchRef(branch)
  return `https://purge.jsdelivr.net/gh/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}@${ref}/${encodeRepositoryPath(path)}`
}

export function buildGitHubRawUrl(
  owner: string,
  repository: string,
  branch: string,
  path: string,
): string {
  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${encodeBranchRef(branch)}/${encodeRepositoryPath(path)}`
}

export function validateCustomUrlTemplate(template: string): string | null {
  const value = template.trim()
  if (!value) return '请输入自定义链接模板'
  if (!/^https?:\/\//i.test(value)) return '自定义链接模板必须以 https:// 或 http:// 开头'
  if (!value.includes('{path}')) return '自定义链接模板必须包含 {path} 占位符'
  return null
}

export function buildCustomUrl(
  template: string,
  owner: string,
  repository: string,
  branch: string,
  path: string,
): string {
  const normalized = template.trim()
  return normalized
    .replaceAll('{owner}', encodeURIComponent(owner))
    .replaceAll('{repo}', encodeURIComponent(repository))
    .replaceAll('{branch}', encodeBranchRef(branch))
    .replaceAll('{path}', encodeRepositoryPath(path))
}

export function resolvePreferredUrl(options: {
  mode: PreferredUrlMode
  customTemplate?: string
  owner: string
  repository: string
  branch: string
  path: string
  downloadUrl?: string | null
}): string {
  const { mode, customTemplate, owner, repository, branch, path, downloadUrl } = options
  if (mode === 'custom' && customTemplate && !validateCustomUrlTemplate(customTemplate)) {
    return buildCustomUrl(customTemplate, owner, repository, branch, path)
  }
  if (mode === 'github') {
    return downloadUrl || buildGitHubRawUrl(owner, repository, branch, path)
  }
  return buildJsDelivrUrl(owner, repository, branch, path)
}

export function buildContentsEndpoint(owner: string, repository: string, path = ''): string {
  const suffix = encodeRepositoryPath(path)
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents${suffix ? `/${suffix}` : ''}`
}
