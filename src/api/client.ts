import axios from 'axios'

export const githubClient = axios.create({
  baseURL: 'https://api.github.com',
  timeout: 45_000,
  headers: {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  },
})

export function authHeaders(token: string) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}
