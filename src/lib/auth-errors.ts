import { AxiosError } from 'axios'
import { VdocApiError } from '@/lib/vdoc-api'

export function isUnauthenticatedError(error: unknown): boolean {
  if (error instanceof VdocApiError) return error.code === 401
  return error instanceof AxiosError && error.response?.status === 401
}

export function isServiceUnavailableError(error: unknown): boolean {
  if (error instanceof VdocApiError) return error.code >= 500
  return (
    error instanceof AxiosError &&
    (!error.response || error.response.status >= 500)
  )
}
