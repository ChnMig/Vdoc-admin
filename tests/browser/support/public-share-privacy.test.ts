// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('public share production privacy policy', () => {
  it('ships page-level noindex and no-referrer fallbacks without third-party fonts', async () => {
    const html = await readFile('index.html', 'utf8')

    expect(html).toContain(
      '<meta name="robots" content="noindex, nofollow, noarchive" />'
    )
    expect(html).toContain('<meta name="referrer" content="no-referrer" />')
    expect(html).not.toContain('fonts.googleapis.com')
    expect(html).not.toContain('fonts.gstatic.com')
  })

  it('sets global CSP plus route-specific cache and indexing headers', async () => {
    const caddyfile = await readFile('Caddyfile', 'utf8')

    expect(caddyfile).toContain(':8080 {')
    expect(caddyfile).toContain('@public_share path /share/*')
    expect(caddyfile).toContain('Cache-Control "no-store, max-age=0"')
    expect(caddyfile).toContain('Referrer-Policy "no-referrer"')
    expect(caddyfile).toContain('X-Robots-Tag "noindex, nofollow, noarchive"')
    expect(caddyfile).toContain('Content-Security-Policy "default-src')
    expect(caddyfile).toContain(
      "connect-src 'self' {$VDOC_PUBLIC_SHARE_CONNECT_SRC}"
    )
    expect(caddyfile).not.toContain("connect-src 'self' http: https:")
    expect(caddyfile).toContain("frame-ancestors 'none'")
    expect(caddyfile.indexOf('Content-Security-Policy')).toBeLessThan(
      caddyfile.indexOf('@public_share')
    )
  })

  it('does not persist the account JWT in a cookie attached to share requests', async () => {
    const authStore = await readFile('src/stores/auth-store.ts', 'utf8')

    expect(authStore).toContain('window.sessionStorage.setItem')
    expect(authStore).not.toContain('setCookie(VDOC_ACCESS_TOKEN')
  })
})
