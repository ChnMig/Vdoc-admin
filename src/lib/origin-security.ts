class UnsafeHttpOriginError extends Error {
  readonly name = 'UnsafeHttpOriginError'

  constructor() {
    super('HTTP origin configuration is invalid or insecure')
  }
}

export function parseSecureHttpOrigin(value: string): string {
  if (value.trim() !== value || containsAsciiControl(value)) {
    throw new UnsafeHttpOriginError()
  }

  let url: URL
  try {
    url = new URL(value)
  } catch (error) {
    if (error instanceof TypeError) throw new UnsafeHttpOriginError()
    throw error
  }

  const isHttp = url.protocol === 'http:' || url.protocol === 'https:'
  const isRootOrigin =
    url.username === '' &&
    url.password === '' &&
    /^\/+$/u.test(url.pathname) &&
    url.search === '' &&
    url.hash === ''
  const isSecureTransport =
    url.protocol === 'https:' || isLocalDevelopmentHost(url.hostname)

  if (!isHttp || !isRootOrigin || !isSecureTransport) {
    throw new UnsafeHttpOriginError()
  }
  return url.origin
}

function containsAsciiControl(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index)
    if (codePoint <= 0x1f || codePoint === 0x7f) return true
  }
  return false
}

function isLocalDevelopmentHost(hostname: string): boolean {
  const normalized = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '')
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '127.0.0.1' ||
    normalized === '::1'
  )
}
