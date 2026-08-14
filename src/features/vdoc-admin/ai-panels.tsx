import { useRef, useState, type MutableRefObject } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Bot, MessageSquare } from 'lucide-react'
import {
  createAIChatSession,
  getAIChatSession,
  getAISummary,
  listAIChatSessions,
  regenerateAISummary,
  sendAIChatMessage,
  type AIChatMessageDTO,
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type AIContextPanelProps = {
  readonly target?: AISummaryTarget
  readonly interactive?: boolean
  readonly canRegenerate?: boolean
}

export function AIContextPanel({
  target,
  interactive = true,
  canRegenerate = interactive,
}: AIContextPanelProps) {
  const targetKey = targetIdentityKey(target)

  return (
    <AIContextPanelContent
      key={targetKey}
      target={target}
      targetKey={targetKey}
      interactive={interactive}
      canRegenerate={canRegenerate}
    />
  )
}

function AIContextPanelContent({
  target,
  targetKey,
  interactive = true,
  canRegenerate = interactive,
}: AIContextPanelProps & { readonly targetKey: string }) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [sessionId, setSessionId] = useState('')
  const [messages, setMessages] = useState<readonly AIChatMessageDTO[]>([])
  const sessionCreationRef = useRef<Promise<string> | null>(null)
  const sendLockedRef = useRef(false)

  const summaryQuery = useQuery({
    queryKey: ['ai-summary', target],
    queryFn: () => getAISummary(target ?? emptyTarget),
    enabled: target !== undefined,
  })
  const chatSessionsQuery = useQuery({
    queryKey: ['ai-chat-sessions', targetKey, target],
    queryFn: () => listAIChatSessions(target ?? emptyTarget),
    enabled: target !== undefined,
  })
  const chatSessions = chatSessionsQuery.data?.items ?? []
  const activeSessionId = sessionId || chatSessions[0]?.id || ''
  const chatQuery = useQuery({
    queryKey: [
      'ai-chat-session',
      targetKey,
      target?.projectId,
      activeSessionId,
    ],
    queryFn: () => getAIChatSession(target?.projectId ?? '', activeSessionId),
    enabled: target !== undefined && activeSessionId.length > 0,
  })
  const regenerateMutation = useMutation({
    mutationFn: () => {
      if (!target || !canRegenerate) throw new Error('AI summary is read-only.')
      return regenerateAISummary(target)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['ai-summary', target] }),
  })
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!target || !interactive) throw new Error('AI chat is read-only.')
      const targetSessionId = await ensureSession(
        target,
        activeSessionId,
        setSessionId,
        sessionCreationRef
      )
      const message = await sendAIChatMessage(
        target.projectId,
        targetSessionId,
        content
      )
      return { message, sessionId: targetSessionId }
    },
    onSuccess: ({ message, sessionId: targetSessionId }) => {
      setMessages((current) => [...current, message])
      void queryClient.invalidateQueries({
        queryKey: [
          'ai-chat-session',
          targetKey,
          target?.projectId,
          targetSessionId,
        ],
      })
      return queryClient.invalidateQueries({
        queryKey: ['ai-chat-sessions', targetKey, target],
      })
    },
  })
  const visibleMessages = mergeChatMessages(
    chatQuery.data?.messages ?? [],
    messages.filter((message) => message.session_id === activeSessionId)
  )

  return (
    <Card className='overflow-hidden'>
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
      <CardContent className='grid gap-5 p-5 lg:grid-cols-2'>
        <section className='grid content-start gap-3'>
          {!interactive && target && (
            <Alert>
              <AlertCircle />
              <AlertTitle>{t('admin.ai.readOnlyTitle')}</AlertTitle>
              <AlertDescription>
                {t('admin.ai.readOnlyDescription')}
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
              disabled={
                !target || !canRegenerate || regenerateMutation.isPending
              }
              onClick={() => regenerateMutation.mutate()}
            >
              {t('admin.ai.regenerateSummary')}
            </Button>
          </div>
          <div className='min-h-32 rounded-md border bg-[var(--surface-control)] p-4 text-sm leading-6 text-muted-foreground'>
            {summaryContent(summaryQuery.data, summaryQuery.isLoading, t)}
          </div>
          <AIRequestError
            error={regenerateMutation.error ?? summaryQuery.error ?? undefined}
          />
        </section>
        <section className='grid content-start gap-3'>
          <div className='flex items-center gap-2 font-medium'>
            <MessageSquare className='size-4 text-muted-foreground' />
            {t('admin.ai.chatTitle')}
          </div>
          {chatSessions.length > 0 && (
            <div className='grid gap-2'>
              <Label htmlFor='ai-chat-session'>
                {t('admin.ai.chatSession')}
              </Label>
              <select
                id='ai-chat-session'
                className='h-10 rounded-md border border-input bg-background px-3 text-sm'
                value={activeSessionId}
                onChange={(event) => setSessionId(event.currentTarget.value)}
              >
                {chatSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title || session.id}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className='grid max-h-56 gap-2 overflow-auto rounded-md border bg-[var(--surface-control)] p-3 text-sm'>
            {visibleMessages.length ? (
              visibleMessages.map((message) => (
                <p key={message.id}>
                  <span className='font-medium'>{message.role}: </span>
                  {message.content}
                </p>
              ))
            ) : (
              <p className='text-muted-foreground'>
                {t('admin.ai.noMessages')}
              </p>
            )}
          </div>
          <form
            key={targetKey}
            className='grid gap-2'
            onSubmit={(event) => {
              event.preventDefault()
              const form = event.currentTarget
              const formData = new FormData(form)
              const content = String(formData.get('message') ?? '').trim()
              if (content.length === 0 || sendLockedRef.current) return
              sendLockedRef.current = true
              sendMutation.mutate(content, {
                onSuccess: () => form.reset(),
                onSettled: () => {
                  sendLockedRef.current = false
                },
              })
            }}
          >
            <Label htmlFor='ai-chat-message'>{t('admin.ai.chatMessage')}</Label>
            <Textarea
              id='ai-chat-message'
              name='message'
              className='min-h-20'
              disabled={!target || !interactive || sendMutation.isPending}
            />
            <Button
              type='submit'
              disabled={!target || !interactive || sendMutation.isPending}
            >
              {t('admin.ai.sendMessage')}
            </Button>
          </form>
          <AIRequestError
            error={
              sendMutation.error ??
              chatSessionsQuery.error ??
              chatQuery.error ??
              undefined
            }
          />
        </section>
      </CardContent>
    </Card>
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

function mergeChatMessages(
  persisted: readonly AIChatMessageDTO[],
  local: readonly AIChatMessageDTO[]
) {
  const messages = new Map(persisted.map((message) => [message.id, message]))
  for (const message of local) messages.set(message.id, message)
  return [...messages.values()]
}

const emptyTarget: AISummaryTarget = {
  projectId: '',
  documentId: '',
  ownerType: 'draft',
  ownerId: '',
}

function targetIdentityKey(target: AISummaryTarget | undefined) {
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
      <p>{content ?? summary.error_message ?? t('admin.ai.noSummary')}</p>
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

async function ensureSession(
  target: AISummaryTarget,
  sessionId: string,
  setSessionId: (sessionId: string) => void,
  sessionCreationRef: MutableRefObject<Promise<string> | null>
) {
  if (sessionId.length > 0) return sessionId
  if (sessionCreationRef.current) return sessionCreationRef.current

  const creation = createAIChatSession(target.projectId, {
    document_id: target.documentId,
    context_type: target.ownerType,
    context_id: target.ownerId,
    title: `AI chat for ${target.ownerType} ${target.ownerId}`,
  })
    .then((session) => {
      setSessionId(session.id)
      return session.id
    })
    .finally(() => {
      if (sessionCreationRef.current === creation) {
        sessionCreationRef.current = null
      }
    })
  sessionCreationRef.current = creation
  return creation
}
