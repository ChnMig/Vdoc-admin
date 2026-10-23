import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveAdminReleaseChannel } from './release-channel'

const { buildInfo } = vi.hoisted(() => ({ buildInfo: { version: 'dev' } }))
vi.mock('./build-info', () => ({ adminBuildInfo: buildInfo }))

const originalRuntimeConfig = window.__VDOC_ADMIN_CONFIG__

beforeEach(() => {
  window.__VDOC_ADMIN_CONFIG__ = undefined
  buildInfo.version = 'dev'
})

afterEach(() => {
  window.__VDOC_ADMIN_CONFIG__ = originalRuntimeConfig
})

describe('Admin release channel', () => {
  it('infers beta from the deployed build without a runtime override', () => {
    buildInfo.version = 'v0.3.17-beta.4'
    expect(resolveAdminReleaseChannel()).toBe('beta')
    window.__VDOC_ADMIN_CONFIG__ = { releaseChannel: 'release' }
    expect(resolveAdminReleaseChannel()).toBe('release')
  })

  it('keeps stable builds on the release channel', () => {
    buildInfo.version = 'v0.3.17'
    expect(resolveAdminReleaseChannel()).toBe('release')
  })

  it('preserves release behavior for existing runtime configurations', () => {
    expect(resolveAdminReleaseChannel()).toBe('release')
    window.__VDOC_ADMIN_CONFIG__ = { apiBaseUrl: 'https://api.example.test' }
    expect(resolveAdminReleaseChannel()).toBe('release')
  })

  it.each(['beta', 'release'] as const)('accepts the %s channel', (channel) => {
    window.__VDOC_ADMIN_CONFIG__ = { releaseChannel: channel }
    expect(resolveAdminReleaseChannel()).toBe(channel)
  })

  it.each(['', 'stable', 'Beta', 'canary', null, 1])(
    'rejects invalid runtime channel %j without a release fallback',
    (releaseChannel) => {
      Object.assign(window, { __VDOC_ADMIN_CONFIG__: { releaseChannel } })
      expect(resolveAdminReleaseChannel).toThrow(
        'VDOC_ADMIN_RELEASE_CHANNEL must be beta or release'
      )
    }
  )
})
