import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PublicShareConfigError,
  parsePublicShareOrigin,
  resolvePublicShareApiBaseUrl,
  resolvePublicShareBaseUrl,
} from './public-share-config'

const originalRuntimeConfig = window.__VDOC_ADMIN_CONFIG__

afterEach(() => {
  window.__VDOC_ADMIN_CONFIG__ = originalRuntimeConfig
  vi.unstubAllEnvs()
})

describe('public share origin config', () => {
  it('prefers runtime config over build-time config and current origin', () => {
    window.__VDOC_ADMIN_CONFIG__ = {
      publicShareBaseUrl: 'https://runtime-share.example.test/',
    }
    vi.stubEnv(
      'VITE_VDOC_PUBLIC_SHARE_BASE_URL',
      'https://build-share.example.test/'
    )

    expect(resolvePublicShareBaseUrl()).toBe(
      'https://runtime-share.example.test'
    )
  })

  it('uses build-time config before current origin', () => {
    window.__VDOC_ADMIN_CONFIG__ = undefined
    vi.stubEnv(
      'VITE_VDOC_PUBLIC_SHARE_BASE_URL',
      'https://build-share.example.test:8081/'
    )

    expect(resolvePublicShareBaseUrl()).toBe(
      'https://build-share.example.test:8081'
    )
  })

  it('uses the current origin when no configured origin exists', () => {
    window.__VDOC_ADMIN_CONFIG__ = undefined
    vi.stubEnv('VITE_VDOC_PUBLIC_SHARE_BASE_URL', '')

    expect(resolvePublicShareBaseUrl()).toBe(window.location.origin)
  })

  it('keeps the public page origin separate from the backend API origin', () => {
    window.__VDOC_ADMIN_CONFIG__ = {
      apiBaseUrl: 'https://api.example.test/',
      publicShareBaseUrl: 'https://share.example.test/',
    }

    expect(resolvePublicShareBaseUrl()).toBe('https://share.example.test')
    expect(resolvePublicShareApiBaseUrl()).toBe('https://api.example.test')
  })

  it('fails closed instead of falling back when the selected runtime value is invalid', () => {
    window.__VDOC_ADMIN_CONFIG__ = {
      publicShareBaseUrl: 'https://runtime-share.example.test/subpath',
    }
    vi.stubEnv(
      'VITE_VDOC_PUBLIC_SHARE_BASE_URL',
      'https://build-share.example.test/'
    )

    expect(() => resolvePublicShareBaseUrl()).toThrow(PublicShareConfigError)
  })

  it.each([
    'https://user:pass@example.test/',
    'https://example.test/share',
    'https://example.test/?query=1',
    'https://example.test/#fragment',
    'https://example.test:invalid/',
    'javascript:alert(1)',
    'file:///tmp/share',
    '//example.test/',
    'http://public-share.example.test/',
    ' https://example.test/',
  ])('rejects non-root or non-HTTP origins: %s', (value) => {
    expect(() => parsePublicShareOrigin(value)).toThrow(PublicShareConfigError)
  })

  it('normalizes a valid root HTTP(S) URL to its origin', () => {
    expect(parsePublicShareOrigin('https://example.test:8443/')).toBe(
      'https://example.test:8443'
    )
  })

  it.each([
    'http://localhost:5173/',
    'http://preview.localhost:4173/',
    'http://127.0.0.1:8080/',
    'http://[::1]:8080/',
  ])('allows plaintext only for loopback development origins: %s', (value) => {
    expect(parsePublicShareOrigin(value)).toBe(new URL(value).origin)
  })
})
