import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { clearCookies } from '@/test-utils/cookies'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import {
  getIdentity,
  unwrapEnvelope,
  vdocApi,
  type VdocApiError,
  type VdocEnvelope,
} from './vdoc-api'

const originalAdapter = vdocApi.defaults.adapter

const sampleUser = {
  id: 'user-1',
  email: 'admin@vdoc.local',
  name: 'Vdoc Admin',
  is_super_admin: true,
  status: 1,
}

describe('vdoc-api', () => {
  beforeEach(() => {
    clearCookies()
    useAuthStore.getState().auth.reset()
    vdocApi.defaults.adapter = originalAdapter
  })

  it('sends the raw Vdoc JWT in the Authorization header', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    vdocApi.defaults.adapter = jsonEnvelopeAdapter(requests, {
      code: 200,
      status: 'OK',
      timestamp: 1,
      detail: sampleUser,
    })
    useAuthStore.getState().auth.setAccessToken('raw.jwt.token')

    await expect(getIdentity()).resolves.toEqual(sampleUser)

    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('/api/v1/private/identity/me')
    expect(headerValue(requests[0]?.headers, 'Authorization')).toBe(
      'raw.jwt.token'
    )
  })

  it('does not send Authorization when no token is present', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    vdocApi.defaults.adapter = jsonEnvelopeAdapter(requests, {
      code: 200,
      status: 'OK',
      timestamp: 1,
      detail: sampleUser,
    })

    await expect(getIdentity()).resolves.toEqual(sampleUser)

    expect(headerValue(requests[0]?.headers, 'Authorization')).toBeUndefined()
  })

  it('throws VdocApiError for non-OK envelopes', async () => {
    await expect(
      unwrapEnvelope(
        Promise.resolve({
          data: {
            code: 401,
            status: 'UNAUTHENTICATED',
            message: 'session expired',
            timestamp: 1,
          },
        })
      )
    ).rejects.toMatchObject({
      name: 'VdocApiError',
      code: 401,
      status: 'UNAUTHENTICATED',
      message: 'session expired',
    } satisfies Partial<VdocApiError>)
  })
})

function jsonEnvelopeAdapter<T>(
  requests: InternalAxiosRequestConfig[],
  envelope: VdocEnvelope<T>
): AxiosAdapter {
  return async (config) => {
    requests.push(config)
    return {
      data: envelope,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    } satisfies AxiosResponse<VdocEnvelope<T>>
  }
}

function headerValue(
  headers: InternalAxiosRequestConfig['headers'] | undefined,
  name: string
) {
  return headers?.get?.(name)
}
