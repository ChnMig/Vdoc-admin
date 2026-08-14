import { z } from 'zod'
import { parsePublicShareOrigin } from './public-share-config'

const documentShareIdSchema = z
  .string()
  .regex(/^[0-9a-f]{32}$/)
  .brand('DocumentShareId')
const documentShareSecretSchema = z
  .string()
  .regex(/^vdoc_share_[0-9a-f]{48}$/)
  .brand('DocumentShareSecret')
const publicVersionIdSchema = z
  .string()
  .regex(/^[0-9a-f]{32}$/)
  .brand('PublicVersionId')
const publicShareSessionIdSchema = z
  .string()
  .regex(/^[0-9a-f]{32}$/)
  .brand('PublicShareSessionId')

export type DocumentShareId = z.infer<typeof documentShareIdSchema>
export type DocumentShareSecret = z.infer<typeof documentShareSecretSchema>
export type PublicVersionId = z.infer<typeof publicVersionIdSchema>
type PublicShareSessionId = z.infer<typeof publicShareSessionIdSchema>

export type PublicShareSession = {
  readonly sessionId: PublicShareSessionId
  readonly shareId: DocumentShareId
  readonly secret: DocumentShareSecret
  readonly controller: AbortController
}

type CapabilityUrl = {
  readonly baseUrl: string
  readonly shareId: DocumentShareId
  readonly secret: DocumentShareSecret
}

type FragmentLocation = Pick<Location, 'hash' | 'pathname' | 'search'>
type FragmentHistory = Pick<History, 'replaceState'>

export function parseDocumentShareId(value: string): DocumentShareId {
  return documentShareIdSchema.parse(value)
}

export function parseDocumentShareSecret(value: string): DocumentShareSecret {
  return documentShareSecretSchema.parse(value)
}

export function parsePublicVersionId(value: string): PublicVersionId {
  return publicVersionIdSchema.parse(value)
}

export function buildDocumentShareUrl({
  baseUrl,
  shareId,
  secret,
}: CapabilityUrl): string {
  return `${parsePublicShareOrigin(baseUrl)}/share/${shareId}#${secret}`
}

export function parseAndEraseDocumentShareFragment(
  locationValue: FragmentLocation,
  historyValue: FragmentHistory
): DocumentShareSecret | undefined {
  const parsed = documentShareSecretSchema.safeParse(
    locationValue.hash.startsWith('#') ? locationValue.hash.slice(1) : ''
  )
  if (!parsed.success) return undefined

  historyValue.replaceState(
    null,
    '',
    `${locationValue.pathname}${locationValue.search}`
  )
  return parsed.data
}

export function createPublicShareSession({
  shareId,
  secret,
}: Pick<PublicShareSession, 'shareId' | 'secret'>): PublicShareSession {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const sessionId = publicShareSessionIdSchema.parse(
    Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  )

  return { sessionId, shareId, secret, controller: new AbortController() }
}

export function disposePublicShareSession(session: PublicShareSession): void {
  session.controller.abort()
}
