import { AxiosError } from 'axios'
import { VdocApiError } from './vdoc-api'

const MAX_QUERY_RETRIES = 3

export function shouldRetryQuery(
  failureCount: number,
  error: unknown
): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false

  const code =
    error instanceof VdocApiError
      ? error.code
      : error instanceof AxiosError
        ? error.response?.status
        : undefined

  if (code === 429 || (code !== undefined && code >= 500)) return true
  if (code !== undefined && code >= 400 && code < 500) return false
  return true
}
