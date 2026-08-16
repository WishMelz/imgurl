import axios from 'axios'

interface GitHubErrorPayload {
  message?: string
  documentation_url?: string
}

export function getErrorMessage(error: unknown): string {
  if (!axios.isAxiosError<GitHubErrorPayload>(error)) {
    return error instanceof Error ? error.message : '发生未知错误'
  }

  const status = error.response?.status
  const apiMessage = error.response?.data?.message
  const messages: Record<number, string> = {
    401: 'Token 无效或已过期，请重新验证',
    403: '访问被拒绝，请检查权限、组织 SSO 或 API 限额',
    404: '仓库或目录不存在，或者 Token 没有访问权限',
    409: '仓库当前状态不允许此操作，请稍后重试',
    422: '文件已存在或请求内容不符合 GitHub 要求',
  }

  if (status && messages[status]) return messages[status]
  return apiMessage || error.message || 'GitHub 请求失败'
}
