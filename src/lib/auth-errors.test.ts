import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import { VdocApiError } from '@/lib/vdoc-api'
import {
  isServiceUnavailableError,
  isUnauthenticatedError,
} from './auth-errors'

describe('isUnauthenticatedError', () => {
  it('recognizes semantic and transport 401 responses', () => {
    expect(
      isUnauthenticatedError(
        new VdocApiError({
          code: 401,
          status: 'UNAUTHENTICATED',
          timestamp: 1,
        })
      )
    ).toBe(true)

    expect(
      isUnauthenticatedError(
        new AxiosError(
          'Unauthorized',
          'ERR_BAD_REQUEST',
          undefined,
          undefined,
          {
            data: undefined,
            status: 401,
            statusText: 'Unauthorized',
            headers: new AxiosHeaders(),
            config: { headers: new AxiosHeaders() },
          }
        )
      )
    ).toBe(true)
  })

  it('does not turn network or server failures into authentication failures', () => {
    expect(isUnauthenticatedError(new AxiosError('Network Error'))).toBe(false)
    expect(
      isUnauthenticatedError(
        new VdocApiError({
          code: 500,
          status: 'INTERNAL_ERROR',
          timestamp: 1,
        })
      )
    ).toBe(false)
  })
})

describe('isServiceUnavailableError', () => {
  it('recognizes network and server failures', () => {
    expect(isServiceUnavailableError(new AxiosError('Network Error'))).toBe(
      true
    )
    expect(
      isServiceUnavailableError(
        new VdocApiError({
          code: 503,
          status: 'UNAVAILABLE',
          timestamp: 1,
        })
      )
    ).toBe(true)
  })

  it('does not misclassify auth or programming failures as outages', () => {
    expect(
      isServiceUnavailableError(
        new VdocApiError({
          code: 401,
          status: 'UNAUTHENTICATED',
          timestamp: 1,
        })
      )
    ).toBe(false)
    expect(isServiceUnavailableError(new Error('render failed'))).toBe(false)
  })
})
