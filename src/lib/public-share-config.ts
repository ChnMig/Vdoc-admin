import { parseSecureHttpOrigin } from './origin-security'
import { resolveApiBaseUrl } from './vdoc-api'

export class PublicShareConfigError extends Error {
  readonly name = 'PublicShareConfigError'

  constructor() {
    super('Public share origin configuration is invalid')
  }
}

export function parsePublicShareOrigin(value: string): string {
  try {
    return parseSecureHttpOrigin(value)
  } catch {
    throw new PublicShareConfigError()
  }
}

export function resolvePublicShareBaseUrl(): string {
  const configuredOrigin =
    window.__VDOC_ADMIN_CONFIG__?.publicShareBaseUrl ||
    import.meta.env.VITE_VDOC_PUBLIC_SHARE_BASE_URL ||
    window.location.origin

  return parsePublicShareOrigin(configuredOrigin)
}

export function resolvePublicShareApiBaseUrl(): string {
  return parsePublicShareOrigin(resolveApiBaseUrl())
}
