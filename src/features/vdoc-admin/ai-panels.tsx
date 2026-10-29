import { useLayoutEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Bot } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import {
  getAISummary,
  regenerateAISummary,
  type AIChatTarget,
  type AISummaryDTO,
  type AISummaryTarget,
} from '@/lib/vdoc-api'
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
import { AIChatMarkdown } from './ai-chat-message'
import { AIChatPanel } from './ai-chat-panel'

type AIContextPanelProps = {
  readonly target?: AIChatTarget
  readonly interactive?: boolean
  readonly canRegenerate?: boolean
  readonly presentation?: 'panel' | 'sidebar'
  readonly mode?: 'both' | 'summary' | 'chat'
}

export function AIContextPanel({
  target,
  interactive = true,
  canRegenerate = interactive,
  presentation = 'panel',
  mode = 'both',
}: AIContextPanelProps) {
  const targetKey = targetIdentityKey(target)
  const sessionVersion = useAuthStore((state) => state.auth.sessionVersion)

  return (
    <AIContextPanelContent
      key={`${sessionVersion}:${targetKey}`}
      target={target}
      targetKey={targetKey}
      interactive={interactive}
      canRegenerate={canRegenerate}
      presentation={presentation}
      mode={mode}
    />
  )
}

function AIContextPanelContent({
  target,
  targetKey,
  interactive = true,
  canRegenerate = interactive,
  presentation = 'panel',
  mode = 'both',
}: AIContextPanelProps & { readonly targetKey: string }) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const mountedRef = useRef(false)
  useLayoutEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const summaryTarget: AISummaryTarget | undefined =
    target && target.ownerType !== 'document'
      ? { ...target, ownerType: target.ownerType }
      : undefined
  const summaryQuery = useQuery<AISummaryDTO | null>({
    queryKey: ['ai-summary', summaryTarget],
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' && !query.state.error
        ? 2000
        : false,
    queryFn: ({ signal }) =>
      getAISummary(summaryTarget ?? emptyTarget, { signal }),
    enabled: summaryTarget !== undefined && mode !== 'chat',
  })
  const regenerateMutation = useMutation({
    mutationFn: async (sessionVersion: number) => {
      if (!summaryTarget || !canRegenerate)
        throw new Error('AI summary is read-only.')
      const ownsSession = () =>
        useAuthStore.getState().auth.sessionVersion === sessionVersion
      if (!mountedRef.current || !ownsSession()) return
      try {
        const summary = await regenerateAISummary(summaryTarget)
        if (ownsSession()) return { summary, sessionVersion }
      } catch (error) {
        if (ownsSession()) throw error
      }
    },
    onSuccess: (result) => {
      if (
        !result ||
        useAuthStore.getState().auth.sessionVersion !== result.sessionVersion
      )
        return
      const { summary } = result
      queryClient.setQueryData(['ai-summary', summaryTarget], summary)
      return queryClient.invalidateQueries({
        queryKey: ['ai-summary', summaryTarget],
      })
    },
  })
  const sidebar = presentation === 'sidebar'
  const Container = sidebar ? 'div' : Card
  return (
    <Container
      className={cn(
        '@container/ai min-w-0 overflow-hidden',
        sidebar && mode === 'chat' && 'flex h-full min-h-0 flex-col'
      )}
    >
      {!sidebar && (
        <CardHeader className='border-b pb-5'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div className='grid gap-2'>
              <Badge className='w-fit' variant='secondary'>
                {t('admin.ai.badge')}
              </Badge>
              <CardTitle>{t('admin.ai.panelTitle')}</CardTitle>
              <CardDescription>
                {target
                  ? t('admin.ai.panelDescription', {
                      ownerType: target.ownerType,
                      ownerId: target.ownerId,
                    })
                  : t('admin.ai.noTarget')}
              </CardDescription>
            </div>
            <Badge variant='outline'>
              {target?.ownerType ?? t('admin.common.none')}
            </Badge>
          </div>
        </CardHeader>
      )}
      <CardContent
        className={cn(
          'grid min-w-0 gap-6',
          sidebar && mode === 'chat' && 'flex min-h-0 flex-1 flex-col',
          sidebar
            ? 'p-0'
            : mode === 'both'
              ? 'p-5 @min-[42rem]/ai:grid-cols-2'
              : 'p-5'
        )}
      >
        {mode !== 'chat' && (
          <section className='grid content-start gap-3'>
            {!interactive && target && (
              <Alert>
                <AlertCircle />
                <AlertTitle>{t('admin.ai.readOnlyTitle')}</AlertTitle>
                <AlertDescription>
                  {t(
                    mode === 'summary'
                      ? 'admin.ai.summaryReadOnlyDescription'
                      : 'admin.ai.readOnlyDescription'
                  )}
                </AlertDescription>
              </Alert>
            )}
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div className='flex items-center gap-2 font-medium'>
                <Bot className='size-4 text-muted-foreground' />
                {t('admin.ai.summaryTitle')}
              </div>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className={sidebar ? 'h-7 px-2 text-xs' : undefined}
                disabled={
                  !target ||
                  !canRegenerate ||
                  regenerateMutation.isPending ||
                  summaryQuery.data?.status === 'pending'
                }
                onClick={() =>
                  regenerateMutation.mutate(
                    useAuthStore.getState().auth.sessionVersion
                  )
                }
              >
                {t('admin.ai.regenerateSummary')}
              </Button>
            </div>
            <div
              role='status'
              aria-live='polite'
              className='min-h-32 rounded-md border bg-[var(--surface-control)] p-4 text-sm leading-6 text-muted-foreground'
            >
              {summaryContent(summaryQuery.data, summaryQuery.isLoading, t)}
            </div>
            <AIRequestError
              error={
                regenerateMutation.error ?? summaryQuery.error ?? undefined
              }
            />
          </section>
        )}
        {mode !== 'summary' && (
          <AIChatPanel
            target={target}
            targetKey={targetKey}
            interactive={interactive}
            fill={sidebar && mode === 'chat'}
          />
        )}
      </CardContent>
    </Container>
  )
}

function AIRequestError({ error }: { readonly error?: Error | null }) {
  const { t } = useLanguage()
  if (!error) return null

  return (
    <Alert variant='destructive' aria-live='polite'>
      <AlertCircle />
      <AlertTitle>{t('admin.common.error')}</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  )
}

const emptyTarget: AISummaryTarget = {
  projectId: '',
  documentId: '',
  ownerType: 'draft',
  ownerId: '',
}

function targetIdentityKey(target: AIChatTarget | undefined) {
  if (target === undefined) return ''
  return JSON.stringify([
    target.projectId,
    target.documentId,
    target.ownerType,
    target.ownerId,
  ])
}

function summaryContent(
  summary: AISummaryDTO | null | undefined,
  loading: boolean,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (loading) return t('admin.common.loading')

  if (summary == null) return t('admin.ai.noSummary')

  const content = usableSummaryContent(summary)

  return (
    <div className='grid gap-2'>
      <p className='font-medium text-foreground'>
        {t('admin.ai.summaryStatus', {
          status: summaryStatusLabel(summary.status, t),
        })}
      </p>
      {content ? (
        <AIChatMarkdown content={content} />
      ) : (
        <p>{summary.error_message ?? t('admin.ai.noSummary')}</p>
      )}
    </div>
  )
}

function usableSummaryContent(summary: AISummaryDTO) {
  const content = summary.content?.trim()
  return content && content.length > 0 ? content : undefined
}

function summaryStatusLabel(
  status: string,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (status === 'ready') return t('admin.ai.summaryStatusReady')
  if (status === 'pending') return t('admin.ai.summaryStatusPending')
  if (status === 'succeeded') return t('admin.ai.summaryStatusSucceeded')
  if (status === 'failed') return t('admin.ai.summaryStatusFailed')
  if (status === 'skipped') return t('admin.ai.summaryStatusSkipped')
  return `${t('admin.common.unknown')} ${status}`
}
