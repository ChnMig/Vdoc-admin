import { AxiosError, type AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import { shouldRetryQuery } from './query-retry'
import { VdocApiError, type VdocEnvelope } from './vdoc-api'

function vdocError(code: number) {
  return new VdocApiError({
    code,
    status: code === 429 ? 'RATE_LIMITED' : 'ERROR',
    description: 'request failed',
    timestamp: 1,
  } satisfies VdocEnvelope<unknown>)
}

function axiosError(status?: number) {
  return new AxiosError(
    'request failed',
    undefined,
    undefined,
    undefined,
    status === undefined ? undefined : ({ status } as AxiosResponse)
  )
}

describe('query retry policy', () => {
  it('does not retry deterministic client failures from either API path', () => {
    expect(shouldRetryQuery(0, vdocError(400))).toBe(false)
    expect(shouldRetryQuery(0, vdocError(401))).toBe(false)
    expect(shouldRetryQuery(0, vdocError(404))).toBe(false)
    expect(shouldRetryQuery(0, axiosError(422))).toBe(false)
  })

  it('retries transport, rate-limit, and server failures', () => {
    expect(shouldRetryQuery(0, axiosError())).toBe(true)
    expect(shouldRetryQuery(0, vdocError(429))).toBe(true)
    expect(shouldRetryQuery(0, axiosError(500))).toBe(true)
  })

  it('stops after three retries regardless of error type', () => {
    expect(shouldRetryQuery(2, axiosError())).toBe(true)
    expect(shouldRetryQuery(3, axiosError())).toBe(false)
    expect(shouldRetryQuery(3, vdocError(500))).toBe(false)
  })
})
