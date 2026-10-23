import { afterEach, describe, expect, it } from 'vitest'
import { applyAdminBranding, getAdminBranding } from './branding'

const originalRuntimeConfig = window.__VDOC_ADMIN_CONFIG__
afterEach(() => {
  window.__VDOC_ADMIN_CONFIG__ = originalRuntimeConfig
  document.head.innerHTML = ''
})

describe('channel branding', () => {
  it('uses the supplied beta art for the app and browser tab', () => {
    window.__VDOC_ADMIN_CONFIG__ = { releaseChannel: 'beta' }
    document.head.innerHTML =
      '<link rel="icon" href="/images/favicon.png"><meta property="og:image"><meta name="title">'
    applyAdminBranding()
    expect(getAdminBranding().logo).toBe('/images/vdoc-logo-beta.png')
    expect(document.title).toBe('Vdoc Admin Beta')
    expect(document.querySelector('link')?.getAttribute('href')).toBe(
      '/images/favicon-beta.png'
    )
    expect(
      document
        .querySelector('meta[property="og:image"]')
        ?.getAttribute('content')
    ).toBe('/images/vdoc-logo-beta.png')
  })

  it('restores stable art and title for release deployments', () => {
    window.__VDOC_ADMIN_CONFIG__ = { releaseChannel: 'release' }
    applyAdminBranding()
    expect(getAdminBranding().logo).toBe('/images/vdoc-logo.png')
    expect(document.title).toBe('Vdoc Admin')
  })
})
