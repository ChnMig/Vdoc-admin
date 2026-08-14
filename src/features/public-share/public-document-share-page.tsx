import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { Download, FileText, LockKeyhole, ShieldCheck } from 'lucide-react'
import { documentSharePasswordError } from '@/lib/document-share-password'
import {
  createPublicShareSession,
  disposePublicShareSession,
  parseDocumentShareId,
  parsePublicVersionId,
  type DocumentShareId,
  type DocumentShareSecret,
  type PublicShareSession,
} from '@/lib/document-share-url'
import type { TranslationKey } from '@/lib/i18n'
import {
  downloadPublicShareVersion,
  getPublicShareContent,
  getPublicShareMetadata,
  listPublicShareVersions,
  PublicShareRequestError,
  savePublicShareDownload,
  unlockPublicShare,
  type PublicShareContentDTO,
  type PublicShareMetadataDTO,
  type PublicVersionDTO,
} from '@/lib/public-share-api'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LanguageSwitch } from '@/components/language-switch'
import { MarkdownDocumentViewer } from './markdown-document-viewer'
import { OpenApiCodeViewer } from './openapi-code-viewer'

type LoadState = 'loading' | 'locked' | 'ready' | 'recoverable' | 'unavailable'

export function PublicDocumentSharePage({
  shareId: rawShareId,
  secret,
}: {
  readonly shareId: string
  readonly secret?: DocumentShareSecret
}) {
  const shareId = useMemo(() => {
    try {
      return parseDocumentShareId(rawShareId)
    } catch {
      return undefined
    }
  }, [rawShareId])

  return (
    <PublicDocumentShareSession
      key={`${shareId ?? 'invalid'}:${secret ?? ''}`}
      shareId={shareId}
      secret={secret}
    />
  )
}

function PublicDocumentShareSession({
  shareId,
  secret,
}: {
  readonly shareId?: DocumentShareId
  readonly secret?: DocumentShareSecret
}) {
  const { t } = useLanguage()
  const sessionRef = useRef<PublicShareSession | null>(null)
  const versionRequestIdRef = useRef(0)
  const unlockLockedRef = useRef(false)
  const downloadLockedRef = useRef(false)
  const [loadState, setLoadState] = useState<LoadState>(() =>
    shareId && secret ? 'loading' : 'unavailable'
  )
  const [unlockProof, setUnlockProof] = useState<string>()
  const [metadata, setMetadata] = useState<PublicShareMetadataDTO>()
  const [versions, setVersions] = useState<readonly PublicVersionDTO[]>([])
  const [versionId, setVersionId] = useState('')
  const [content, setContent] = useState<PublicShareContentDTO>()
  const [password, setPassword] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [message, setMessage] = useState<TranslationKey>()
  const [failedVersionId, setFailedVersionId] = useState('')
  const passwordValidationError = documentSharePasswordError(password)

  const loadShare = useCallback(
    async (session: PublicShareSession, proof?: string) => {
      const requestId = versionRequestIdRef.current + 1
      versionRequestIdRef.current = requestId
      const requestIsCurrent = () =>
        sessionRef.current === session &&
        requestId === versionRequestIdRef.current
      const request = {
        shareId: session.shareId,
        secret: session.secret,
        signal: session.controller.signal,
        unlockProof: proof,
      }
      try {
        const nextMetadata = await getPublicShareMetadata(request)
        if (!requestIsCurrent()) return
        const nextVersions =
          nextMetadata.version_scope === 2
            ? await listPublicShareVersions(request)
            : [nextMetadata.current_version]
        if (!requestIsCurrent()) return
        const selected = nextMetadata.current_version.id
        if (!nextVersions.some((version) => version.id === selected))
          throw new PublicShareRequestError(200, 'INVALID_RESPONSE')
        const nextContent = await getPublicShareContent({
          ...request,
          versionId: parsePublicVersionId(selected),
        })
        if (nextContent.version_id !== selected)
          throw new PublicShareRequestError(200, 'INVALID_RESPONSE')
        if (!requestIsCurrent()) return
        setMetadata(nextMetadata)
        setVersions(nextVersions)
        setVersionId(selected)
        setContent(nextContent)
        setLoadState('ready')
      } catch (error) {
        if (
          !requestIsCurrent() ||
          (error instanceof DOMException && error.name === 'AbortError')
        )
          return
        setLoadState(proof ? 'recoverable' : 'locked')
        setMessage('publicShare.unavailable')
      }
    },
    []
  )

  useEffect(() => {
    if (!shareId || !secret) return
    const session = createPublicShareSession({ shareId, secret })
    sessionRef.current = session
    const loadTimer = window.setTimeout(() => {
      void loadShare(session)
    }, 0)
    return () => {
      window.clearTimeout(loadTimer)
      disposePublicShareSession(session)
      if (sessionRef.current === session) sessionRef.current = null
    }
  }, [loadShare, secret, shareId])

  function handleRetry() {
    const session = sessionRef.current
    if (!session || loadState === 'loading') return
    setLoadState('loading')
    setMessage(undefined)
    setFailedVersionId('')
    void loadShare(session, unlockProof)
  }

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const session = sessionRef.current
    if (!session || unlockLockedRef.current) return
    if (documentSharePasswordError(password) !== undefined) {
      setMessage('publicShare.passwordInvalid')
      return
    }
    unlockLockedRef.current = true
    setUnlocking(true)
    setMessage(undefined)
    try {
      const unlocked = await unlockPublicShare({
        shareId: session.shareId,
        secret: session.secret,
        signal: session.controller.signal,
        password,
      })
      setUnlockProof(unlocked.unlock_proof)
      setPassword('')
      setLoadState('loading')
      setFailedVersionId('')
      await loadShare(session, unlocked.unlock_proof)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setMessage('publicShare.unavailable')
        setLoadState('locked')
      }
    } finally {
      unlockLockedRef.current = false
      setUnlocking(false)
    }
  }

  async function handleVersionChange(nextVersionId: string) {
    const session = sessionRef.current
    if (!session) return
    const requestId = versionRequestIdRef.current + 1
    versionRequestIdRef.current = requestId
    setMessage(undefined)
    setFailedVersionId('')
    try {
      const nextContent = await getPublicShareContent({
        shareId: session.shareId,
        secret: session.secret,
        signal: session.controller.signal,
        unlockProof,
        versionId: parsePublicVersionId(nextVersionId),
      })
      if (
        requestId !== versionRequestIdRef.current ||
        sessionRef.current !== session
      )
        return
      if (nextContent.version_id !== nextVersionId)
        throw new PublicShareRequestError(200, 'INVALID_RESPONSE')
      setVersionId(nextVersionId)
      setContent(nextContent)
    } catch (error) {
      if (
        requestId !== versionRequestIdRef.current ||
        sessionRef.current !== session
      )
        return
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setFailedVersionId(nextVersionId)
        setMessage('publicShare.versionLoadFailed')
      }
    }
  }

  function handleVersionRetry() {
    if (!failedVersionId) return
    void handleVersionChange(failedVersionId)
  }

  function handleReauthenticate() {
    versionRequestIdRef.current += 1
    setUnlockProof(undefined)
    setPassword('')
    setMessage(undefined)
    setFailedVersionId('')
    setLoadState('locked')
  }

  async function handleDownload() {
    const session = sessionRef.current
    if (!session || !versionId || downloadLockedRef.current) return
    downloadLockedRef.current = true
    setDownloading(true)
    setMessage(undefined)
    try {
      const download = await downloadPublicShareVersion({
        shareId: session.shareId,
        secret: session.secret,
        signal: session.controller.signal,
        unlockProof,
        versionId: parsePublicVersionId(versionId),
      })
      if (sessionRef.current !== session) return
      savePublicShareDownload(download)
    } catch (error) {
      if (
        error instanceof PublicShareRequestError ||
        !(error instanceof DOMException && error.name === 'AbortError')
      ) {
        setMessage('publicShare.downloadFailed')
      }
    } finally {
      downloadLockedRef.current = false
      setDownloading(false)
    }
  }

  const selectedVersion =
    versions.find((version) => version.id === versionId) ??
    metadata?.current_version

  return (
    <main className='min-h-svh bg-background text-foreground'>
      <header className='border-b bg-background/95 backdrop-blur'>
        <div className='mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6'>
          <div className='flex items-center gap-3'>
            <span className='flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground'>
              <FileText className='size-4' />
            </span>
            <div>
              <p className='font-semibold'>Vdoc</p>
              <p className='text-xs text-muted-foreground'>
                {t('publicShare.title')}
              </p>
            </div>
          </div>
          <LanguageSwitch />
        </div>
      </header>
      <div className='mx-auto grid max-w-5xl gap-5 px-4 py-6 sm:px-6 sm:py-10'>
        <Alert>
          <ShieldCheck />
          <AlertTitle>{t('publicShare.title')}</AlertTitle>
          <AlertDescription>{t('publicShare.security')}</AlertDescription>
        </Alert>

        {loadState === 'loading' && (
          <Card>
            <CardContent className='py-12 text-center text-sm text-muted-foreground'>
              {t('publicShare.loading')}
            </CardContent>
          </Card>
        )}

        {loadState === 'locked' && (
          <Card className='mx-auto w-full max-w-lg'>
            <CardHeader>
              <div className='mb-2 flex size-10 items-center justify-center rounded-md bg-muted'>
                <LockKeyhole className='size-5' />
              </div>
              <CardTitle>{t('publicShare.passwordPrompt')}</CardTitle>
              <CardDescription>
                {message ? t(message) : t('publicShare.unavailable')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className='grid gap-4' onSubmit={handleUnlock}>
                <div className='grid gap-2'>
                  <Label htmlFor='share-password'>
                    {t('publicShare.password')}
                  </Label>
                  <Input
                    id='share-password'
                    type='password'
                    autoComplete='current-password'
                    value={password}
                    required
                    aria-invalid={
                      password.length > 0 &&
                      passwordValidationError !== undefined
                    }
                    aria-describedby='share-password-hint'
                    onChange={(event) => setPassword(event.currentTarget.value)}
                  />
                  <p
                    id='share-password-hint'
                    className={
                      password.length > 0 &&
                      passwordValidationError !== undefined
                        ? 'text-xs text-destructive'
                        : 'text-xs text-muted-foreground'
                    }
                  >
                    {password.length > 0 &&
                    passwordValidationError !== undefined
                      ? t('publicShare.passwordInvalid')
                      : t('publicShare.passwordHint')}
                  </p>
                </div>
                <Button
                  disabled={
                    !shareId ||
                    !secret ||
                    unlocking ||
                    passwordValidationError !== undefined
                  }
                  type='submit'
                >
                  {t('publicShare.unlock')}
                </Button>
                <Button type='button' variant='outline' onClick={handleRetry}>
                  {t('publicShare.retry')}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {(loadState === 'recoverable' || loadState === 'unavailable') && (
          <Card className='mx-auto w-full max-w-lg'>
            <CardHeader>
              <div className='mb-2 flex size-10 items-center justify-center rounded-md bg-muted'>
                <LockKeyhole className='size-5' />
              </div>
              <CardTitle>{t('publicShare.unavailableTitle')}</CardTitle>
              <CardDescription>{t('publicShare.unavailable')}</CardDescription>
            </CardHeader>
            {loadState === 'recoverable' && (
              <CardContent className='flex flex-wrap gap-2'>
                <Button type='button' onClick={handleRetry}>
                  {t('publicShare.retry')}
                </Button>
                {unlockProof && (
                  <Button
                    type='button'
                    variant='outline'
                    onClick={handleReauthenticate}
                  >
                    {t('publicShare.unlockAgain')}
                  </Button>
                )}
              </CardContent>
            )}
          </Card>
        )}

        {loadState === 'ready' && metadata && (
          <>
            <Card>
              <CardHeader className='gap-4 sm:flex-row sm:items-start sm:justify-between'>
                <div className='grid gap-2'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant='secondary'>
                      {metadata.document_type === 2 ? 'Markdown' : 'OpenAPI'}
                    </Badge>
                    <Badge variant='outline'>
                      {selectedVersion?.version_name}
                    </Badge>
                  </div>
                  <CardTitle className='text-2xl'>
                    {metadata.document_name}
                  </CardTitle>
                  <CardDescription>
                    {metadata.version_scope === 1
                      ? t('publicShare.latestOnly')
                      : t('publicShare.history')}
                    {metadata.expires_at
                      ? ` · ${t('publicShare.expires', {
                          date: new Date(metadata.expires_at).toLocaleString(),
                        })}`
                      : ''}
                  </CardDescription>
                </div>
                <Button
                  variant='outline'
                  disabled={
                    !content || content.version_id !== versionId || downloading
                  }
                  onClick={handleDownload}
                >
                  <Download className='size-4' />
                  {t('publicShare.download')}
                </Button>
              </CardHeader>
              {versions.length > 1 && (
                <CardContent>
                  <div className='grid max-w-sm gap-2'>
                    <Label htmlFor='public-version'>
                      {t('publicShare.version')}
                    </Label>
                    <select
                      id='public-version'
                      className='h-10 rounded-md border border-input bg-background px-3 text-sm'
                      value={versionId}
                      onChange={(event) =>
                        void handleVersionChange(event.currentTarget.value)
                      }
                    >
                      {versions.map((version) => (
                        <option key={version.id} value={version.id}>
                          {version.version_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              )}
            </Card>
            {message && (
              <Alert variant='destructive' aria-live='polite'>
                <AlertTitle>{t(message)}</AlertTitle>
                {(failedVersionId || unlockProof) && (
                  <AlertDescription className='mt-3'>
                    <div className='flex flex-wrap gap-2'>
                      {failedVersionId && (
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={handleVersionRetry}
                        >
                          {t('publicShare.retry')}
                        </Button>
                      )}
                      {unlockProof && (
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={handleReauthenticate}
                        >
                          {t('publicShare.unlockAgain')}
                        </Button>
                      )}
                    </div>
                  </AlertDescription>
                )}
              </Alert>
            )}
            {content ? (
              metadata.document_type === 2 ? (
                <MarkdownDocumentViewer content={content.content} />
              ) : (
                <OpenApiCodeViewer content={content.content} />
              )
            ) : (
              <Card>
                <CardContent className='py-10 text-center text-sm text-muted-foreground'>
                  {t('publicShare.loading')}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </main>
  )
}
