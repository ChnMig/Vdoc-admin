import { adminBuildInfo } from './build-info'

export function resolveAdminReleaseChannel(): 'beta' | 'release' {
  const channel = window.__VDOC_ADMIN_CONFIG__?.releaseChannel
  if (channel === undefined) {
    return /^v?\d+\.\d+\.\d+-beta\.\d+$/.test(adminBuildInfo.version)
      ? 'beta'
      : 'release'
  }
  if (channel === 'beta' || channel === 'release') return channel
  throw new Error('VDOC_ADMIN_RELEASE_CHANNEL must be beta or release')
}
