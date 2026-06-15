import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { clearCookies } from '@/test-utils/cookies'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import {
  getIdentity,
  listUsers,
  resolveApiBaseUrl,
  unwrapEnvelope,
  unwrapListEnvelope,
  vdocApi,
  type VdocApiError,
  type VdocEnvelope,
} from './vdoc-api'

const originalAdapter = vdocApi.defaults.adapter
const originalRuntimeConfig = window.__VDOC_ADMIN_CONFIG__

const sampleUser = {
  id: 'user-1',
  email: 'admin@example.com',
  name: 'Vdoc Admin',
  is_super_admin: true,
  status: 1,
}

describe('vdoc-api', () => {
  beforeEach(() => {
    clearCookies()
    useAuthStore.getState().auth.reset()
    vdocApi.defaults.adapter = originalAdapter
    window.__VDOC_ADMIN_CONFIG__ = undefined
  })

  afterEach(() => {
    window.__VDOC_ADMIN_CONFIG__ = originalRuntimeConfig
    vi.unstubAllEnvs()
  })

  it('prefers runtime config over Vite env and normalizes trailing slash', () => {
    vi.stubEnv('VITE_VDOC_API_BASE_URL', 'https://vite-api.example.test')
    window.__VDOC_ADMIN_CONFIG__ = {
      apiBaseUrl: 'https://runtime-api.example.test///',
    }

    expect(resolveApiBaseUrl()).toBe('https://runtime-api.example.test')
  })

  it('uses Vite env when runtime config is absent and normalizes trailing slash', () => {
    vi.stubEnv('VITE_VDOC_API_BASE_URL', 'https://vite-api.example.test/')

    expect(resolveApiBaseUrl()).toBe('https://vite-api.example.test')
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

  it('unwraps ReturnOkWithTotal envelopes into items and total', async () => {
    await expect(
      unwrapListEnvelope(
        Promise.resolve({
          data: {
            code: 200,
            status: 'OK',
            timestamp: 1,
            total: 12,
            detail: [sampleUser],
          },
        })
      )
    ).resolves.toEqual({ items: [sampleUser], total: 12 })
  })

  it('uses the real system users endpoint through the list helper', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    vdocApi.defaults.adapter = jsonEnvelopeAdapter(requests, {
      code: 200,
      status: 'OK',
      timestamp: 1,
      total: 1,
      detail: [sampleUser],
    })
    useAuthStore.getState().auth.setAccessToken('admin.jwt')

    await expect(listUsers()).resolves.toEqual({
      items: [sampleUser],
      total: 1,
    })

    expect(requests[0]?.url).toBe('/api/v1/private/system/users')
    expect(headerValue(requests[0]?.headers, 'Authorization')).toBe('admin.jwt')
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
