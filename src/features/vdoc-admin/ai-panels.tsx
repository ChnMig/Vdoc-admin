import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, MessageSquare } from 'lucide-react'
import {
  createAIChatSession,
  getAIChatSession,
  getAISummary,
  regenerateAISummary,
  sendAIChatMessage,
  type AIChatMessageDTO,
  type AISummaryDTO,
  type AISummaryTarget,
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type AIContextPanelProps = {
  readonly target?: AISummaryTarget
}

export function AIContextPanel({ target }: AIContextPanelProps) {
  const targetKey = targetIdentityKey(target)

  return (
    <AIContextPanelContent
      key={targetKey}
      target={target}
      targetKey={targetKey}
    />
  )
}

function AIContextPanelContent({
  target,
  targetKey,
}: AIContextPanelProps & { readonly targetKey: string }) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [sessionId, setSessionId] = useState('')
  const [messages, setMessages] = useState<readonly AIChatMessageDTO[]>([])

  const summaryQuery = useQuery({
    queryKey: ['ai-summary', target],
    queryFn: () => getAISummary(target ?? emptyTarget),
    enabled: target !== undefined,
  })
  const chatQuery = useQuery({
    queryKey: ['ai-chat-session', targetKey, target?.projectId, sessionId],
    queryFn: () => getAIChatSession(target?.projectId ?? '', sessionId),
    enabled: target !== undefined && sessionId.length > 0,
  })
  const regenerateMutation = useMutation({
    mutationFn: () => regenerateAISummary(target ?? emptyTarget),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['ai-summary', target] }),
  })
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (target === undefined) return undefined
      const activeSessionId = await ensureSession(
        target,
        sessionId,
        setSessionId
      )
      return sendAIChatMessage(target.projectId, activeSessionId, content)
    },
    onSuccess: (message) => {
      if (message) setMessages((current) => [...current, message])
      return queryClient.invalidateQueries({
        queryKey: ['ai-chat-session', targetKey, target?.projectId, sessionId],
      })
    },
  })
  const visibleMessages = chatQuery.data?.messages ?? messages

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
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div className='flex items-center gap-2 font-medium'>
              <Bot className='size-4 text-muted-foreground' />
              {t('admin.ai.summaryTitle')}
            </div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={!target || regenerateMutation.isPending}
              onClick={() => regenerateMutation.mutate()}
            >
              {t('admin.ai.regenerateSummary')}
            </Button>
          </div>
          <div className='min-h-32 rounded-md border bg-[var(--surface-control)] p-4 text-sm leading-6 text-muted-foreground'>
            {summaryContent(summaryQuery.data, summaryQuery.isLoading, t)}
          </div>
        </section>
        <section className='grid content-start gap-3'>
          <div className='flex items-center gap-2 font-medium'>
            <MessageSquare className='size-4 text-muted-foreground' />
            {t('admin.ai.chatTitle')}
          </div>
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
              const formData = new FormData(event.currentTarget)
              const content = String(formData.get('message') ?? '').trim()
              if (content.length === 0) return
              sendMutation.mutate(content)
              event.currentTarget.reset()
            }}
          >
            <Label htmlFor='ai-chat-message'>{t('admin.ai.chatMessage')}</Label>
            <Textarea
              id='ai-chat-message'
              name='message'
              className='min-h-20'
              disabled={!target || sendMutation.isPending}
            />
            <Button type='submit' disabled={!target || sendMutation.isPending}>
              {t('admin.ai.sendMessage')}
            </Button>
          </form>
        </section>
      </CardContent>
    </Card>
  )
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
  summary: AISummaryDTO | undefined,
  loading: boolean,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (loading) return t('admin.common.loading')

  if (summary === undefined) return t('admin.ai.noSummary')

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
  if (status === 'succeeded') return t('admin.ai.summaryStatusSucceeded')
  if (status === 'failed') return t('admin.ai.summaryStatusFailed')
  if (status === 'skipped') return t('admin.ai.summaryStatusSkipped')
  return `${t('admin.common.unknown')} ${status}`
}

async function ensureSession(
  target: AISummaryTarget,
  sessionId: string,
  setSessionId: (sessionId: string) => void
) {
  if (sessionId.length > 0) return sessionId
  const session = await createAIChatSession(target.projectId, {
    document_id: target.documentId,
    context_type: target.ownerType,
    context_id: target.ownerId,
    title: `AI chat for ${target.ownerType} ${target.ownerId}`,
  })
  setSessionId(session.id)
  return session.id
}
