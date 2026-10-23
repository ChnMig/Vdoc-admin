import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { adminBuildInfo } from '@/lib/build-info'
import { resolveAdminReleaseChannel } from '@/lib/release-channel'
import {
  checkSystemUpdates,
  getSystemVersion,
  VdocApiError,
  type ReleaseChannel,
  type SystemUpdatesDTO,
  type SystemVersionDTO,
} from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type VersionState =
  { status: 'loading' | 'error' } | { status: 'ready'; data: SystemVersionDTO }

type UpdateState =
  | { status: 'idle' | 'checking' }
  | { status: 'error'; reason: 'failed' | 'unsupported' | 'changed' }
  | { status: 'ready'; data: SystemUpdatesDTO }

function normalizedVersion(version: string) {
  return version.replace(/^v/, '')
}

function releaseNotesUrl(update: SystemUpdatesDTO): string | null {
  if (!update.release_url || !update.latest_version) return null
  const tag = update.latest_version.startsWith('v')
    ? update.latest_version
    : `v${update.latest_version}`
  if (!/^v\d+\.\d+\.\d+(?:-beta\.\d+)?$/.test(tag)) return null
  const expected = `https://github.com/ChnMig/Vdoc-site/releases/tag/${tag}`
  return update.release_url === expected ? expected : null
}

export function ReleaseStatusPanel() {
  const sessionVersion = useAuthStore((state) => state.auth.sessionVersion)
  return <ReleaseStatus key={sessionVersion} sessionVersion={sessionVersion} />
}

function ReleaseStatus({ sessionVersion }: { sessionVersion: number }) {
  const { t } = useLanguage()
  const [version, setVersion] = useState<VersionState>({ status: 'loading' })
  const [update, setUpdate] = useState<UpdateState>({ status: 'idle' })
  const mounted = useRef(false)
  const versionRequest = useRef<AbortController | null>(null)
  const updateRequest = useRef<AbortController | null>(null)
  const frontendChannel: ReleaseChannel =
    adminBuildInfo.version === 'dev'
      ? 'development'
      : resolveAdminReleaseChannel()

  const ownsSession = useCallback(
    (controller: AbortController) =>
      mounted.current &&
      !controller.signal.aborted &&
      useAuthStore.getState().auth.sessionVersion === sessionVersion,
    [sessionVersion]
  )

  const loadVersion = useCallback(() => {
    const auth = useAuthStore.getState().auth
    if (
      !mounted.current ||
      versionRequest.current ||
      !auth.accessToken ||
      auth.sessionVersion !== sessionVersion
    )
      return
    const controller = new AbortController()
    versionRequest.current = controller
    void getSystemVersion({ signal: controller.signal })
      .then((data) => {
        if (ownsSession(controller)) setVersion({ status: 'ready', data })
      })
      .catch(() => {
        if (ownsSession(controller)) setVersion({ status: 'error' })
      })
      .finally(() => {
        if (versionRequest.current === controller) versionRequest.current = null
      })
  }, [ownsSession, sessionVersion])

  useEffect(() => {
    mounted.current = true
    void loadVersion()
    return () => {
      mounted.current = false
      versionRequest.current?.abort()
      updateRequest.current?.abort()
      versionRequest.current = null
      updateRequest.current = null
    }
  }, [loadVersion])

  async function checkUpdates() {
    const auth = useAuthStore.getState().auth
    if (
      !mounted.current ||
      updateRequest.current ||
      version.status !== 'ready' ||
      version.data.channel === 'development' ||
      !auth.accessToken ||
      auth.sessionVersion !== sessionVersion
    )
      return
    const controller = new AbortController()
    updateRequest.current = controller
    setUpdate({ status: 'checking' })
    try {
      // This request is intentionally user-triggered and never cached globally.
      const data = await checkSystemUpdates({ signal: controller.signal })
      if (!ownsSession(controller)) return
      if (
        data.channel !== version.data.channel ||
        normalizedVersion(data.current_version) !==
          normalizedVersion(version.data.version)
      ) {
        setUpdate({ status: 'error', reason: 'changed' })
      } else {
        setUpdate({ status: 'ready', data })
      }
    } catch (error) {
      if (ownsSession(controller)) {
        setUpdate({
          status: 'error',
          reason:
            error instanceof VdocApiError &&
            error.status === 'FAILED_PRECONDITION'
              ? 'unsupported'
              : 'failed',
        })
      }
    } finally {
      if (updateRequest.current === controller) updateRequest.current = null
    }
  }

  const channel =
    version.status === 'ready' ? version.data.channel : frontendChannel
  const channelName = (value: ReleaseChannel) =>
    t(
      value === 'beta'
        ? 'admin.release.beta'
        : value === 'release'
          ? 'admin.release.stable'
          : 'admin.release.development'
    )
  const mismatch =
    version.status === 'ready' &&
    (normalizedVersion(adminBuildInfo.version) !==
      normalizedVersion(version.data.version) ||
      frontendChannel !== version.data.channel)
  const checking = update.status === 'checking'
  const unsupported = version.status === 'ready' && channel === 'development'
  const result = update.status === 'ready' ? update.data : null
  const releaseUrl = result ? releaseNotesUrl(result) : null

  return (
    <Card className='min-w-0'>
      <CardHeader>
        <CardTitle>{t('admin.release.title')}</CardTitle>
        <CardDescription>{t('admin.release.description')}</CardDescription>
      </CardHeader>
      <CardContent className='grid gap-4'>
        <dl className='grid min-w-0 gap-4 text-sm sm:grid-cols-3'>
          <div className='min-w-0 space-y-1'>
            <dt className='text-muted-foreground'>
              {t('admin.release.frontend')}
            </dt>
            <dd className='font-mono font-medium break-all'>
              {adminBuildInfo.version}
            </dd>
          </div>
          <div className='min-w-0 space-y-1' aria-live='polite'>
            <dt className='text-muted-foreground'>
              {t('admin.release.backend')}
            </dt>
            <dd className='font-mono font-medium break-all'>
              {version.status === 'ready'
                ? version.data.version
                : version.status === 'loading'
                  ? t('admin.release.loading')
                  : t('admin.release.versionFailed')}
            </dd>
          </div>
          <div className='min-w-0 space-y-1'>
            <dt className='text-muted-foreground'>
              {t('admin.release.channel')}
            </dt>
            <dd>
              <Badge variant='outline'>{channelName(channel)}</Badge>
            </dd>
          </div>
        </dl>
        {version.status === 'error' && (
          <Button
            variant='outline'
            className='w-fit'
            onClick={() => {
              setVersion({ status: 'loading' })
              void loadVersion()
            }}
          >
            <RefreshCw aria-hidden />
            {t('admin.release.retryVersion')}
          </Button>
        )}
        {mismatch && (
          <p className='text-sm text-muted-foreground'>
            {t('admin.release.mismatch')}
          </p>
        )}
        <div className='flex min-w-0 flex-col items-start gap-3 border-t pt-4 sm:flex-row sm:items-center'>
          <Button
            variant='outline'
            className='shrink-0'
            disabled={version.status !== 'ready' || checking || unsupported}
            onClick={() => void checkUpdates()}
          >
            {checking ? (
              <Loader2 aria-hidden className='animate-spin' />
            ) : (
              <RefreshCw aria-hidden />
            )}
            {t(checking ? 'admin.release.checking' : 'admin.release.check')}
          </Button>
          <p className='text-sm text-muted-foreground'>
            {t('admin.release.manual')}
          </p>
        </div>
        <div
          role='status'
          aria-live='polite'
          aria-atomic='true'
          className='grid min-w-0 gap-2 text-sm'
        >
          {checking && <p className='sr-only'>{t('admin.release.checking')}</p>}
          {unsupported && <p>{t('admin.release.unsupported')}</p>}
          {update.status === 'error' && (
            <p className='text-destructive'>
              {t(
                update.reason === 'unsupported'
                  ? 'admin.release.unsupported'
                  : update.reason === 'changed'
                    ? 'admin.release.deploymentChanged'
                    : 'admin.release.checkFailed'
              )}
            </p>
          )}
          {result && (
            <>
              <p className='break-words'>
                {t(
                  !result.latest_version
                    ? 'admin.release.noRelease'
                    : result.update_available
                      ? 'admin.release.available'
                      : 'admin.release.upToDate',
                  {
                    channel: channelName(result.channel),
                    version: result.latest_version ?? '',
                  }
                )}
              </p>
              {result.latest_version && !result.update_available && (
                <p className='break-all text-muted-foreground'>
                  {t('admin.release.latest', {
                    version: result.latest_version,
                  })}
                </p>
              )}
              {releaseUrl && (
                <a
                  href={releaseUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-flex w-fit items-center gap-1 underline underline-offset-4'
                >
                  {t('admin.release.releaseNotes')}
                  <ExternalLink aria-hidden className='size-3.5' />
                </a>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
