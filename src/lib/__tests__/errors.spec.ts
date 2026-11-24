import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { getErrorMessage } from '@/lib/errors'

function makeAxiosError(status: number, message?: string) {
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    statusText: 'Error',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: message ? { message } : {},
  })
}

describe('lib/errors', () => {
  it('maps GitHub HTTP status codes to friendly Chinese messages', () => {
    expect(getErrorMessage(makeAxiosError(401))).toContain('Token 无效')
    expect(getErrorMessage(makeAxiosError(403))).toContain('访问被拒绝')
    expect(getErrorMessage(makeAxiosError(404))).toContain('不存在')
    expect(getErrorMessage(makeAxiosError(404, 'This repository is empty.'))).toContain('仓库为空')
    expect(getErrorMessage(makeAxiosError(409))).toContain('稍后重试')
    expect(getErrorMessage(makeAxiosError(422))).toContain('已存在')
    expect(getErrorMessage(makeAxiosError(500, 'Server boom'))).toBe('Server boom')
  })

  it('handles native errors and unknown inputs', () => {
    expect(getErrorMessage(new Error('network down'))).toBe('network down')
    expect(getErrorMessage('unexpected')).toBe('发生未知错误')
  })
})
