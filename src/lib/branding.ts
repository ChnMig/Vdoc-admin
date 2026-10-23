import { resolveAdminReleaseChannel } from './release-channel'

export function getAdminBranding() {
  const beta = resolveAdminReleaseChannel() === 'beta'
  return {
    beta,
    logo: beta ? '/images/vdoc-logo-beta.png' : '/images/vdoc-logo.png',
    favicon: beta ? '/images/favicon-beta.png' : '/images/favicon.png',
    title: beta ? 'Vdoc Admin Beta' : 'Vdoc Admin',
  }
}

export function applyAdminBranding() {
  const { logo, favicon, title } = getAdminBranding()
  document.title = title
  document
    .querySelector<HTMLLinkElement>('link[rel="icon"]')
    ?.setAttribute('href', favicon)
  for (const selector of [
    'meta[name="title"]',
    'meta[property="og:title"]',
    'meta[property="twitter:title"]',
  ]) {
    document.querySelector(selector)?.setAttribute('content', title)
  }
  for (const selector of [
    'meta[property="og:image"]',
    'meta[property="twitter:image"]',
  ]) {
    document.querySelector(selector)?.setAttribute('content', logo)
  }
}
