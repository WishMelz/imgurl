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

export function buildJsDelivrUrl(
  owner: string,
  repository: string,
  branch: string,
  path: string,
): string {
  const ref = encodeURIComponent(branch || 'main')
  return `https://cdn.jsdelivr.net/gh/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}@${ref}/${encodeRepositoryPath(path)}`
}

export function buildGitHubRawUrl(
  owner: string,
  repository: string,
  branch: string,
  path: string,
): string {
  return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${encodeURIComponent(branch || 'main')}/${encodeRepositoryPath(path)}`
}

export function buildContentsEndpoint(owner: string, repository: string, path = ''): string {
  const suffix = encodeRepositoryPath(path)
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents${suffix ? `/${suffix}` : ''}`
}
