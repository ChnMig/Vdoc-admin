import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowDown,
  History,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  Square,
  SquarePen,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import {
  createAIChatSession,
  getAIChatSession,
  generateAIChatTitle,
  updateAIChatReasoning,
  type AIChatSessionDTO,
  type AIChatSessionDetailDTO,
  type AIReasoningEffort,
  listAIChatSessions,
  sendAIChatMessage,
  type AIChatAttachmentDTO,
  type AIChatMessageDTO,
  type AIChatTarget,
} from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { OptionsSelect } from '@/components/options-select'
import {
  ChatAttachmentError,
  chatAttachmentAccept,
  readChatAttachments,
} from './ai-chat-attachments'
import { AIChatMessage, ChatAttachmentList } from './ai-chat-message'

type ChatDraft = {
  content: string
  attachments: readonly AIChatAttachmentDTO[]
}
const emptyDraft: ChatDraft = { content: '', attachments: [] }
type CompletedTurn = { user: AIChatMessageDTO; assistant: AIChatMessageDTO }
const shortcutKey = 'vdoc-ai-send-shortcut'
const reasoningEfforts = [
  '',
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const
function readReasoningDefault(accountId: string): AIReasoningEffort {
  try {
    const stored = accountId
      ? localStorage.getItem(`vdoc-ai-reasoning:${accountId}`)
      : ''
    return reasoningEfforts.find((effort) => effort === stored) ?? ''
  } catch {
    return ''
  }
}

export function AIChatPanel({
  target,
  targetKey,
  interactive,
  fill = false,
}: {
  target?: AIChatTarget
  targetKey: string
  interactive: boolean
  fill?: boolean
}) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const accountId = useAuthStore((state) => state.auth.user?.id ?? '')
  const [reasoningDefault, setReasoningDefault] = useState(() =>
    readReasoningDefault(accountId)
  )
  const reasoningHelpId = useId()
  const titleControllerRef = useRef<AbortController | null>(null)
  const settingsControllerRef = useRef<AbortController | null>(null)
  const titleAttemptsRef = useRef(new Set<string>())
  const settingsLockedRef = useRef(false)
  const rememberReasoning = (effort: AIReasoningEffort) => {
    setReasoningDefault(effort)
    try {
      if (accountId)
        localStorage.setItem(`vdoc-ai-reasoning:${accountId}`, effort)
    } catch {
      /* Use the in-memory choice when storage is unavailable. */
    }
  }
  const inputId = useId()
  const helpId = useId()
  const uploadId = useId()
  const attachmentHelpId = useId()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, ChatDraft>>({})
  const [turns, setTurns] = useState<CompletedTurn[]>([])
  const [pendingReply, setPendingReply] = useState<{
    sessionId: string
    question: string
    attachments: readonly AIChatAttachmentDTO[]
    answer: string
    startedAt: string
  } | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [attachmentError, setAttachmentError] = useState('')
  const [readingFiles, setReadingFiles] = useState(false)
  const [stopped, setStopped] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const [sendShortcut, setSendShortcut] = useState(() => {
    try {
      return localStorage.getItem(shortcutKey) === 'modifier'
        ? 'modifier'
        : 'enter'
    } catch {
      return 'enter'
    }
  })
  const sendControllerRef = useRef<AbortController | null>(null)
  const sendLockedRef = useRef(false)
  const readingRef = useRef(false)
  const mountedRef = useRef(false)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const transcriptContentRef = useRef<HTMLDivElement>(null)
  const followReplyRef = useRef(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const composingRef = useRef(false)
  const compositionEndedRef = useRef(0)
  const restoreInputRef = useRef(false)
  useLayoutEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      sendControllerRef.current?.abort()
      titleControllerRef.current?.abort()
      settingsControllerRef.current?.abort()
    }
  }, [])

  const sessionsQuery = useQuery({
    queryKey: ['ai-chat-sessions', targetKey, target],
    queryFn: ({ signal }) => listAIChatSessions(target!, { signal }),
    enabled: target !== undefined,
  })
  const sessions = sessionsQuery.data?.items ?? []
  const activeSessionId =
    sessionId === 'new' ? '' : sessionId || sessions[0]?.id || ''
  // 首次加载后固定当前会话，后台刷新列表时不跟随排序跳转。
  if (sessionId === null && sessionsQuery.isSuccess)
    setSessionId(sessions[0]?.id || 'new')
  const draftKey = activeSessionId || 'new'
  const draft = drafts[draftKey] ?? emptyDraft
  const chatQuery = useQuery({
    queryKey: [
      'ai-chat-session',
      targetKey,
      target?.projectId,
      activeSessionId,
    ],
    queryFn: ({ signal }) =>
      getAIChatSession(target?.projectId ?? '', activeSessionId, { signal }),
    enabled: target !== undefined && activeSessionId.length > 0,
  })
  const activeSession =
    chatQuery.data?.session ??
    sessions.find((session) => session.id === activeSessionId)
  const reasoningEffort = activeSessionId
    ? (activeSession?.reasoning_effort ?? '')
    : reasoningDefault
  const cacheSession = useCallback(
    (session: AIChatSessionDTO, field: 'title' | 'reasoning') => {
      const merge = (current: AIChatSessionDTO): AIChatSessionDTO => ({
        ...current,
        ...(field === 'title'
          ? { title: session.title, title_generated: session.title_generated }
          : { reasoning_effort: session.reasoning_effort }),
        updated_at:
          current.updated_at > session.updated_at
            ? current.updated_at
            : session.updated_at,
      })
      queryClient.setQueryData<AIChatSessionDetailDTO>(
        ['ai-chat-session', targetKey, target?.projectId, session.id],
        (current) =>
          current ? { ...current, session: merge(current.session) } : current
      )
      queryClient.setQueryData<Awaited<ReturnType<typeof listAIChatSessions>>>(
        ['ai-chat-sessions', targetKey, target],
        (current) =>
          current
            ? {
                ...current,
                items: current.items.map((item) =>
                  item.id === session.id ? merge(item) : item
                ),
              }
            : current
      )
    },
    [queryClient, targetKey, target]
  )
  const settingsMutation = useMutation({
    mutationFn: async (effort: AIReasoningEffort) => {
      if (!target || !interactive) throw new Error('AI chat is read-only.')
      const version = useAuthStore.getState().auth.sessionVersion
      const controller = new AbortController()
      settingsControllerRef.current = controller
      try {
        const session = await updateAIChatReasoning(
          target.projectId,
          activeSessionId,
          effort,
          { signal: controller.signal }
        )
        if (
          mountedRef.current &&
          !controller.signal.aborted &&
          useAuthStore.getState().auth.sessionVersion === version
        )
          return { session, effort }
      } finally {
        if (settingsControllerRef.current === controller)
          settingsControllerRef.current = null
      }
    },
    onSuccess: (result) => {
      if (result) {
        cacheSession(result.session, 'reasoning')
        rememberReasoning(result.effort)
      }
    },
    onSettled: () => {
      settingsLockedRef.current = false
    },
  })
  const activeDraftKeyRef = useRef(draftKey)
  useLayoutEffect(() => {
    activeDraftKeyRef.current = draftKey
  }, [draftKey])
  const updateDraft = (patch: Partial<ChatDraft>) =>
    setDrafts((current) => ({
      ...current,
      [draftKey]: { ...(current[draftKey] ?? emptyDraft), ...patch },
    }))

  const sendMutation = useMutation({
    mutationFn: async ({
      content,
      attachments,
      sessionVersion,
    }: ChatDraft & { sessionVersion: number }) => {
      if (!target || !interactive) throw new Error('AI chat is read-only.')
      const ownsSubmission = () =>
        mountedRef.current &&
        useAuthStore.getState().auth.sessionVersion === sessionVersion
      if (!ownsSubmission()) return
      const controller = new AbortController()
      sendControllerRef.current = controller
      try {
        let targetSessionId = activeSessionId
        if (!targetSessionId) {
          const session = await createAIChatSession(
            target.projectId,
            {
              document_id: target.documentId,
              context_type: target.ownerType,
              context_id: target.ownerId,
              ...(reasoningDefault
                ? { reasoning_effort: reasoningDefault }
                : {}),
              title: (
                content ||
                attachments[0]?.name ||
                t('admin.ai.newConversation')
              ).slice(0, 80),
            },
            { signal: controller.signal }
          )
          if (!ownsSubmission()) return
          targetSessionId = session.id
          setDrafts((current) => ({
            ...current,
            new: emptyDraft,
            [session.id]: { content, attachments },
          }))
          setSessionId(session.id)
          void queryClient.invalidateQueries({
            queryKey: ['ai-chat-sessions', targetKey, target],
          })
        }
        if (!ownsSubmission()) return
        controller.signal.throwIfAborted()
        setPendingReply({
          sessionId: targetSessionId,
          question: content,
          attachments,
          answer: '',
          startedAt: new Date().toISOString(),
        })
        const message = await sendAIChatMessage(
          target.projectId,
          targetSessionId,
          content,
          {
            signal: controller.signal,
            ...(attachments.length ? { attachments } : {}),
            onDelta: (delta) => {
              if (ownsSubmission() && !controller.signal.aborted)
                setPendingReply((current) =>
                  current?.sessionId === targetSessionId
                    ? { ...current, answer: current.answer + delta }
                    : current
                )
            },
          }
        )
        if (!ownsSubmission() || controller.signal.aborted) return
        return {
          message,
          sessionId: targetSessionId,
          sessionVersion,
          content,
          attachments,
        }
      } catch (error) {
        if (ownsSubmission()) {
          if (controller.signal.aborted)
            throw new DOMException('Stopped', 'AbortError')
          throw error
        }
      } finally {
        if (sendControllerRef.current === controller)
          sendControllerRef.current = null
        if (ownsSubmission()) setPendingReply(null)
      }
    },
    onSuccess: (result) => {
      if (
        !result ||
        !mountedRef.current ||
        useAuthStore.getState().auth.sessionVersion !== result.sessionVersion
      )
        return
      const {
        message,
        sessionId: targetSessionId,
        content,
        attachments,
      } = result
      setTurns((current) => [
        ...current,
        {
          user: {
            id: `local-user:${message.id}`,
            session_id: targetSessionId,
            role: 'user',
            content,
            attachments,
            created_at: message.created_at,
          },
          assistant: message,
        },
      ])
      setDrafts((current) => ({ ...current, [targetSessionId]: emptyDraft }))
      restoreInputRef.current = true
      void queryClient.invalidateQueries({
        queryKey: [
          'ai-chat-session',
          targetKey,
          target?.projectId,
          targetSessionId,
        ],
      })
      void queryClient.invalidateQueries({
        queryKey: ['ai-chat-sessions', targetKey, target],
      })
    },
    onSettled: () => {
      sendLockedRef.current = false
    },
  })
  useEffect(() => {
    if (
      !target ||
      !interactive ||
      activeSession?.title_generated !== false ||
      !chatQuery.data?.messages.some(
        (message) => message.role === 'assistant'
      ) ||
      sendMutation.isPending
    )
      return
    const attemptKey = `${activeSessionId}:${chatQuery.data.messages.length}`
    const attempts = titleAttemptsRef.current
    if (attempts.has(attemptKey)) return
    attempts.add(attemptKey)
    const controller = new AbortController()
    let finished = false
    const version = useAuthStore.getState().auth.sessionVersion
    titleControllerRef.current = controller
    void generateAIChatTitle(target.projectId, activeSessionId, {
      signal: controller.signal,
    })
      .then((session) => {
        finished = true
        if (
          mountedRef.current &&
          !controller.signal.aborted &&
          useAuthStore.getState().auth.sessionVersion === version
        )
          cacheSession(session, 'title')
      })
      .catch(() => {
        finished = !controller.signal.aborted
        /* A readable provisional title remains available after failure. */
      })
    return () => {
      if (!finished) attempts.delete(attemptKey)
      controller.abort()
      if (titleControllerRef.current === controller)
        titleControllerRef.current = null
    }
  }, [
    activeSessionId,
    activeSession?.title_generated,
    chatQuery.data?.messages,
    cacheSession,
    target,
    interactive,
    targetKey,
    sendMutation.isPending,
  ])
  const persisted = chatQuery.data?.messages ?? []
  const persistedIds = new Set(persisted.map((message) => message.id))
  const visibleMessages = [
    ...persisted,
    ...turns
      .filter(
        (turn) =>
          turn.assistant.session_id === activeSessionId &&
          !persistedIds.has(turn.assistant.id)
      )
      .flatMap((turn) => [turn.user, turn.assistant]),
  ]
  const busy =
    sendMutation.isPending || settingsMutation.isPending || readingFiles
  useLayoutEffect(() => {
    if (!sendMutation.isPending && restoreInputRef.current && !historyOpen) {
      restoreInputRef.current = false
      if (!inputRef.current?.closest('[hidden], [inert]'))
        inputRef.current?.focus({ preventScroll: true })
    }
  }, [sendMutation.isPending, historyOpen, activeSessionId])
  const loading =
    sessionsQuery.isLoading || Boolean(activeSessionId && chatQuery.isLoading)
  const error =
    sendMutation.error?.name === 'AbortError'
      ? null
      : (settingsMutation.error ??
        sendMutation.error ??
        sessionsQuery.error ??
        chatQuery.error)
  const canSend =
    target &&
    interactive &&
    !busy &&
    !loading &&
    !chatQuery.isError &&
    !sessionsQuery.isError &&
    (draft.content.trim() || draft.attachments.length)
  const scrollToBottom = () => {
    const node = transcriptRef.current
    if (node) node.scrollTop = node.scrollHeight
  }
  useLayoutEffect(() => {
    if (followReplyRef.current) scrollToBottom()
  }, [
    activeSessionId,
    visibleMessages.length,
    pendingReply?.answer,
    historyOpen,
  ])
  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (followReplyRef.current) scrollToBottom()
    })
    if (transcriptRef.current) observer.observe(transcriptRef.current)
    if (transcriptContentRef.current)
      observer.observe(transcriptContentRef.current)
    return () => observer.disconnect()
  }, [])

  const attachFiles = async (files: readonly File[]) => {
    if (
      !files.length ||
      !target ||
      !interactive ||
      !sessionsQuery.isSuccess ||
      sendLockedRef.current ||
      readingRef.current
    )
      return
    readingRef.current = true
    setReadingFiles(true)
    setAttachmentError('')
    const originalKey = draftKey
    try {
      const attachments = await readChatAttachments(files, draft.attachments)
      if (mountedRef.current && activeDraftKeyRef.current === originalKey)
        updateDraft({ attachments: [...draft.attachments, ...attachments] })
    } catch (error) {
      if (mountedRef.current)
        setAttachmentError(
          t(
            `admin.ai.${error instanceof ChatAttachmentError ? error.key : 'attachmentReadError'}`
          )
        )
    } finally {
      readingRef.current = false
      if (mountedRef.current) setReadingFiles(false)
    }
  }
  const switchSession = (id: string) => {
    if (busy) return
    setSessionId(id)
    setHistoryOpen(false)
    setAttachmentError('')
    setStopped(false)
    sendMutation.reset()
    settingsMutation.reset()
    followReplyRef.current = true
    setAtBottom(true)
    restoreInputRef.current = true
    inputRef.current?.focus({ preventScroll: true })
  }

  return (
    <section
      className={cn('flex min-h-0 min-w-0 flex-col gap-3', fill && 'h-full')}
      aria-label={t('admin.ai.chatTitle')}
    >
      <div className='flex w-full shrink-0 items-center justify-between gap-2'>
        <div className='flex min-w-0 items-center gap-2 text-sm font-medium'>
          <MessageSquare
            aria-hidden
            className='size-4 shrink-0 text-muted-foreground'
          />
          <span
            data-chat-title
            className='truncate'
            title={
              sessions.find((session) => session.id === activeSessionId)?.title
            }
          >
            {sessions.find((session) => session.id === activeSessionId)
              ?.title || t('admin.ai.newConversation')}
          </span>
        </div>
        <div className='flex shrink-0 gap-1'>
          <Button
            type='button'
            variant={historyOpen ? 'secondary' : 'ghost'}
            size='icon'
            className='size-8 @min-[56rem]/ai:hidden'
            aria-label={t('admin.ai.chatSession')}
            title={t('admin.ai.chatSession')}
            aria-pressed={historyOpen}
            disabled={busy}
            onClick={() => {
              setHistoryOpen(!historyOpen)
              setSearch('')
            }}
          >
            <History className='size-4' aria-hidden />
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='size-8'
            aria-label={t('admin.ai.newConversation')}
            title={t('admin.ai.newConversation')}
            disabled={
              !target || !interactive || busy || sessionsQuery.isLoading
            }
            onClick={() => switchSession('new')}
          >
            <SquarePen className='size-4' aria-hidden />
          </Button>
        </div>
      </div>
      <div
        className={cn(
          'grid min-h-0 min-w-0 flex-1 gap-4',
          !historyOpen && '@min-[56rem]/ai:grid-cols-[13rem_minmax(0,1fr)]'
        )}
      >
        {!historyOpen && (
          <aside
            className='hidden min-h-0 flex-col gap-3 border-e pe-4 @min-[56rem]/ai:flex'
            aria-label={t('admin.ai.chatSession')}
          >
            <p className='text-xs font-medium text-muted-foreground'>
              {t('admin.ai.chatSession')}
            </p>
            <Input
              aria-label={t('admin.ai.searchConversations')}
              placeholder={t('admin.ai.searchConversations')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className='min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain'>
              <ConversationHistoryList
                sessions={sessions}
                activeSessionId={activeSessionId}
                busy={busy}
                search={search}
                onSelect={switchSession}
              />
            </div>
          </aside>
        )}
        <div className='flex min-h-0 min-w-0 flex-col gap-3'>
          {!interactive && target && (
            <Alert>
              <AlertCircle />
              <AlertTitle>{t('admin.ai.readOnlyTitle')}</AlertTitle>
              <AlertDescription>
                {t('admin.ai.readOnlyDescription')}
              </AlertDescription>
            </Alert>
          )}
          <div
            hidden={!historyOpen}
            className={cn(
              'min-h-0 w-full flex-1 flex-col gap-3',
              historyOpen && 'flex'
            )}
          >
            <Input
              aria-label={t('admin.ai.searchConversations')}
              placeholder={t('admin.ai.searchConversations')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div
              className='min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain'
              aria-label={t('admin.ai.chatSession')}
            >
              {historyOpen && (
                <ConversationHistoryList
                  sessions={sessions}
                  activeSessionId={activeSessionId}
                  busy={busy}
                  search={search}
                  onSelect={switchSession}
                />
              )}
            </div>
            <Button
              type='button'
              variant='outline'
              onClick={() => setHistoryOpen(false)}
            >
              {t('admin.ai.backToConversation')}
            </Button>
          </div>
          <div
            hidden={historyOpen}
            className={cn(
              'relative min-h-0 min-w-0 flex-1',
              !historyOpen && 'flex flex-col'
            )}
          >
            <div
              ref={transcriptRef}
              tabIndex={0}
              role='log'
              aria-live='off'
              aria-label={t('admin.ai.conversation')}
              className={cn(
                'min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pe-1 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring',
                !fill && 'max-h-[32rem] min-h-56'
              )}
              onScroll={(event) => {
                const node = event.currentTarget
                const near =
                  node.scrollHeight - node.scrollTop - node.clientHeight < 80
                followReplyRef.current = near
                setAtBottom(near)
              }}
            >
              <div
                ref={transcriptContentRef}
                className='grid w-full min-w-0 content-start gap-4 px-1 pb-3 @min-[36rem]/ai:px-3'
              >
                {loading ? (
                  <div
                    role='status'
                    className='flex items-center gap-2 py-4 text-sm text-muted-foreground'
                  >
                    <Loader2
                      aria-hidden
                      className='size-4 motion-safe:animate-spin'
                    />
                    {t('admin.common.loading')}
                  </div>
                ) : (
                  visibleMessages.map((message) => (
                    <AIChatMessage key={message.id} message={message} />
                  ))
                )}
                {!loading && !visibleMessages.length && !pendingReply && (
                  <div className='mx-auto grid w-full max-w-xl gap-3 py-6 text-sm text-muted-foreground @min-[36rem]/ai:py-12'>
                    <p className='font-medium text-foreground'>
                      {t('admin.ai.emptyChatTitle')}
                    </p>
                    <p className='text-xs leading-5'>
                      {t('admin.ai.emptyChatDescription')}
                    </p>
                    {interactive &&
                      [
                        t('admin.ai.suggestSummary'),
                        t('admin.ai.suggestChanges'),
                      ].map((question) => (
                        <button
                          type='button'
                          key={question}
                          className='rounded-md border px-3 py-2 text-start text-xs hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring'
                          onClick={() => {
                            updateDraft({ content: question })
                            inputRef.current?.focus()
                          }}
                        >
                          {question}
                        </button>
                      ))}
                  </div>
                )}
                {pendingReply?.sessionId === activeSessionId && (
                  <>
                    <AIChatMessage
                      message={{
                        role: 'user',
                        content: pendingReply.question,
                        attachments: pendingReply.attachments,
                        created_at: pendingReply.startedAt,
                      }}
                    />
                    <AIChatMessage
                      message={{
                        role: 'assistant',
                        content: pendingReply.answer,
                        created_at: pendingReply.startedAt,
                      }}
                      pending
                    />
                  </>
                )}
              </div>
            </div>
            {!atBottom && (
              <Button
                type='button'
                size='sm'
                variant='secondary'
                className='absolute start-1/2 bottom-2 -translate-x-1/2 gap-1 shadow-sm'
                onClick={() => {
                  followReplyRef.current = true
                  setAtBottom(true)
                  scrollToBottom()
                }}
              >
                <ArrowDown className='size-3.5' aria-hidden />
                {t('admin.ai.latestMessage')}
              </Button>
            )}
          </div>
          {!historyOpen && (
            <form
              className='grid w-full shrink-0 gap-2 rounded-xl border bg-background p-2.5'
              onSubmit={(event) => {
                event.preventDefault()
                if (
                  !canSend ||
                  sendLockedRef.current ||
                  settingsLockedRef.current ||
                  readingRef.current
                )
                  return
                sendLockedRef.current = true
                followReplyRef.current = true
                setAtBottom(true)
                setStopped(false)
                setAttachmentError('')
                sendMutation.mutate({
                  content: draft.content.trim(),
                  attachments: draft.attachments,
                  sessionVersion: useAuthStore.getState().auth.sessionVersion,
                })
              }}
              onPaste={(event) => {
                const files = Array.from(event.clipboardData.files)
                if (files.length) {
                  event.preventDefault()
                  void attachFiles(files)
                }
              }}
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes('Files'))
                  event.preventDefault()
              }}
              onDrop={(event) => {
                if (event.dataTransfer.files.length) {
                  event.preventDefault()
                  void attachFiles(Array.from(event.dataTransfer.files))
                }
              }}
            >
              {!!draft.attachments.length && !sendMutation.isPending && (
                <div className='max-h-32 overflow-y-auto'>
                  <ChatAttachmentList
                    attachments={draft.attachments}
                    onRemove={
                      busy
                        ? undefined
                        : (index) =>
                            updateDraft({
                              attachments: draft.attachments.filter(
                                (_, position) => position !== index
                              ),
                            })
                    }
                  />
                </div>
              )}
              <Label htmlFor={inputId} className='sr-only'>
                {t('admin.ai.chatMessage')}
              </Label>
              <Textarea
                ref={inputRef}
                id={inputId}
                name='message'
                rows={2}
                enterKeyHint={sendShortcut === 'enter' ? 'send' : 'enter'}
                maxLength={4000}
                value={draft.content}
                placeholder={t('admin.ai.messagePlaceholder')}
                aria-describedby={helpId}
                className='field-sizing-content max-h-[min(9rem,24dvh)] min-h-16 resize-none border-0 bg-transparent px-1 py-1 shadow-none focus-visible:ring-0'
                disabled={
                  !target ||
                  !interactive ||
                  sendMutation.isPending ||
                  sessionsQuery.isLoading ||
                  sessionsQuery.isError
                }
                onChange={(event) =>
                  updateDraft({ content: event.target.value })
                }
                onCompositionStart={() => {
                  composingRef.current = true
                }}
                onCompositionEnd={() => {
                  composingRef.current = false
                  compositionEndedRef.current = Date.now()
                }}
                onKeyDown={(event) => {
                  if (
                    event.key !== 'Enter' ||
                    event.nativeEvent.isComposing ||
                    composingRef.current ||
                    event.keyCode === 229 ||
                    Date.now() - compositionEndedRef.current < 50
                  )
                    return
                  const modifier = event.ctrlKey || event.metaKey
                  const send =
                    !event.shiftKey &&
                    !event.altKey &&
                    (sendShortcut === 'enter' ? !modifier : modifier)
                  if (send) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
              />
              <input
                ref={uploadRef}
                id={uploadId}
                type='file'
                multiple
                accept={chatAttachmentAccept}
                className='sr-only'
                tabIndex={-1}
                aria-label={t('admin.ai.attachFiles')}
                disabled={
                  !target || !interactive || busy || !sessionsQuery.isSuccess
                }
                onChange={(event) => {
                  void attachFiles(Array.from(event.target.files ?? []))
                  event.target.value = ''
                }}
              />
              <div className='flex min-w-0 flex-wrap items-center justify-between gap-1'>
                <div className='flex min-w-0 flex-1 flex-wrap items-center gap-1'>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='size-8 shrink-0'
                    aria-label={t('admin.ai.attachFiles')}
                    title={t('admin.ai.attachmentLimits')}
                    aria-describedby={attachmentHelpId}
                    disabled={
                      !target ||
                      !interactive ||
                      busy ||
                      !sessionsQuery.isSuccess
                    }
                    onClick={() => uploadRef.current?.click()}
                  >
                    {readingFiles ? (
                      <Loader2
                        aria-hidden
                        className='size-4 motion-safe:animate-spin'
                      />
                    ) : (
                      <Paperclip className='size-4' aria-hidden />
                    )}
                  </Button>
                  <div
                    className='max-w-40 min-w-0'
                    title={t('admin.ai.reasoningHint')}
                  >
                    <OptionsSelect
                      aria-label={t('admin.ai.reasoning')}
                      aria-describedby={reasoningHelpId}
                      side='top'
                      className='h-8 border-transparent bg-transparent px-2 text-xs shadow-none'
                      value={reasoningEffort || 'default'}
                      disabled={
                        !target ||
                        !interactive ||
                        busy ||
                        loading ||
                        chatQuery.isError ||
                        sessionsQuery.isError
                      }
                      options={reasoningEfforts.map((effort, index) => ({
                        value: effort || 'default',
                        label: t(
                          `admin.ai.${(['reasoningDefault', 'reasoningNone', 'reasoningMinimal', 'reasoningLow', 'reasoningMedium', 'reasoningHigh', 'reasoningXhigh', 'reasoningMax'] as const)[index]}`
                        ),
                      }))}
                      onChange={(value) => {
                        const effort =
                          value === 'default'
                            ? ''
                            : (value as AIReasoningEffort)
                        if (settingsLockedRef.current || sendLockedRef.current)
                          return
                        if (activeSessionId) {
                          settingsLockedRef.current = true
                          settingsMutation.mutate(effort)
                        } else rememberReasoning(effort)
                      }}
                    />
                  </div>
                  <div className='max-w-40 min-w-0'>
                    <OptionsSelect
                      aria-label={t('admin.ai.sendShortcut')}
                      className='h-8 border-transparent bg-transparent px-2 text-xs shadow-none'
                      side='top'
                      value={sendShortcut}
                      options={[
                        { value: 'enter', label: t('admin.ai.enterSend') },
                        {
                          value: 'modifier',
                          label: t('admin.ai.modifierSend'),
                        },
                      ]}
                      onChange={(value) => {
                        setSendShortcut(value)
                        try {
                          localStorage.setItem(shortcutKey, value)
                        } catch {
                          /* Preference remains usable without storage. */
                        }
                      }}
                    />
                  </div>
                </div>
                {sendMutation.isPending ? (
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    aria-label={t('admin.ai.stopGenerating')}
                    onClick={() => {
                      setStopped(true)
                      sendControllerRef.current?.abort()
                    }}
                  >
                    <Square className='size-3.5' aria-hidden />
                    {t('admin.ai.stop')}
                  </Button>
                ) : (
                  <Button
                    type='submit'
                    size='sm'
                    disabled={!canSend}
                    aria-label={t('admin.ai.sendMessage')}
                  >
                    <Send className='size-3.5' aria-hidden />
                    {t('admin.ai.send')}
                  </Button>
                )}
              </div>
              <span id={reasoningHelpId} className='sr-only'>
                {t('admin.ai.reasoningHint')}
              </span>
              <p
                id={helpId}
                className='px-1 text-[0.6875rem] leading-4 text-muted-foreground'
              >
                {t('admin.ai.composerHint')}
              </p>
              <span id={attachmentHelpId} className='sr-only'>
                {t('admin.ai.attachmentLimits')}
              </span>
            </form>
          )}
          {attachmentError && (
            <p role='alert' className='shrink-0 text-xs text-destructive'>
              {attachmentError}
            </p>
          )}
          {stopped && !sendMutation.isPending && (
            <p role='status' className='text-xs text-muted-foreground'>
              {t('admin.ai.stopped')}
            </p>
          )}
          {error && (
            <Alert
              variant='destructive'
              className='max-h-36 shrink-0 overflow-y-auto'
              aria-live='polite'
            >
              <AlertCircle />
              <AlertTitle>{t('admin.common.error')}</AlertTitle>
              <AlertDescription>
                <p>{error.message}</p>
                <p>{t('admin.ai.retryHint')}</p>
                {reasoningEffort && <p>{t('admin.ai.reasoningErrorHint')}</p>}
                {draft.attachments.some(
                  (attachment) => attachment.media_type !== 'text/plain'
                ) && <p>{t('admin.ai.attachmentModelHint')}</p>}
                {(sessionsQuery.isError || chatQuery.isError) && (
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      if (sessionsQuery.isError) void sessionsQuery.refetch()
                      if (chatQuery.isError) void chatQuery.refetch()
                    }}
                  >
                    {t('admin.ai.retry')}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </section>
  )
}

function ConversationHistoryList({
  sessions,
  activeSessionId,
  busy,
  search,
  onSelect,
}: {
  sessions: readonly AIChatSessionDTO[]
  activeSessionId: string
  busy: boolean
  search: string
  onSelect: (id: string) => void
}) {
  const { t, language } = useLanguage()
  const matches = sessions.filter((session) =>
    session.title.toLowerCase().includes(search.trim().toLowerCase())
  )
  return (
    <>
      {matches.map((session) => (
        <button
          type='button'
          key={session.id}
          disabled={busy}
          aria-current={session.id === activeSessionId ? 'true' : undefined}
          className='grid w-full min-w-0 gap-1 rounded-md px-3 py-2.5 text-start text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring aria-current:bg-muted'
          onClick={() => onSelect(session.id)}
        >
          <span className='truncate font-medium' title={session.title}>
            {session.title || t('admin.ai.newConversation')}
          </span>
          <span className='text-[0.6875rem] text-muted-foreground'>
            {Number.isNaN(Date.parse(session.updated_at))
              ? ''
              : new Date(session.updated_at).toLocaleString(language, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
          </span>
        </button>
      ))}
      {!matches.length && (
        <p className='p-3 text-xs leading-5 text-muted-foreground'>
          {t(
            sessions.length
              ? 'admin.ai.noMatchingConversations'
              : 'admin.ai.noConversations'
          )}
        </p>
      )}
    </>
  )
}
