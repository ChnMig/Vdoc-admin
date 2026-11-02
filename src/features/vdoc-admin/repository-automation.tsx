import { useId, useState } from 'react'
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { Bell, Copy, Pause, Play, RefreshCw, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import {
  repositoryKeys,
  type RepositoryScope,
  repositoryScopeKey,
  analyzeRepositoryChange,
  createRepositorySubscription,
  listRepositoryAnalyses,
  listRepositoryDeliveries,
  listRepositoryEvents,
  listRepositorySubscriptions,
  retryRepositoryDelivery,
  setRepositorySubscriptionPaused,
  type RepositoryBranch,
  type RepositoryAnalysis,
} from '@/lib/repository-api'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownDocumentViewer } from '@/features/public-share/markdown-document-viewer'
import {
  FormDialog,
  LoadingErrorState,
  NativeSelect,
  TextField,
} from './page-shared'
import { useRepositoryCopy } from './repository-copy'

const eventGroups = [
  {
    zh: '版本与分支',
    en: 'Versions and branches',
    events: [
      [
        'commit.created',
        '保存了新版本',
        'Version saved',
        '文档提交成功，产生一个新的版本号。',
        'A document save creates a numbered version.',
      ],
      [
        'branch.created',
        '创建了分支',
        'Branch created',
        '从已有版本创建了一条新分支。',
        'A new branch starts from an existing version.',
      ],
      [
        'branch.updated',
        '分支有更新',
        'Branch updated',
        '分支指向的最新版本发生变化。',
        'The latest version on a branch changes.',
      ],
    ],
  },
  {
    zh: '审核与合并',
    en: 'Review and merge',
    events: [
      [
        'merge_request.created',
        '提交了合并请求',
        'Merge requested',
        '有人申请把一个分支的内容合并到另一个分支。',
        'Someone proposes merging changes into another branch.',
      ],
      [
        'merge_request.approved',
        '合并请求通过审核',
        'Merge approved',
        '审核人已批准本次合并。',
        'A reviewer approves the merge.',
      ],
      [
        'merge_request.resolved',
        '合并冲突已处理',
        'Conflicts resolved',
        '冲突内容已调整，可继续审核或合并。',
        'Conflicts are resolved for review or merging.',
      ],
      [
        'merge_request.merged',
        '分支合并完成',
        'Merge completed',
        '变更已合入目标分支。',
        'Changes are merged into the target branch.',
      ],
    ],
  },
  {
    zh: '发布',
    en: 'Publication',
    events: [
      [
        'release.published',
        '发布了正式内容',
        'Release published',
        '管理员已发布指定版本，供分享和引用。',
        'An administrator publishes a version for sharing and reference.',
      ],
    ],
  },
  {
    zh: 'AI 分析',
    en: 'AI analysis',
    events: [
      [
        'ai.analysis.succeeded',
        '版本分析完成',
        'Analysis completed',
        'AI 版本分析结果已生成。',
        'An AI version analysis is ready.',
      ],
      [
        'ai.analysis.failed',
        '版本分析失败',
        'Analysis failed',
        'AI 版本分析未完成，需要检查后重试。',
        'An AI version analysis failed and may need a retry.',
      ],
    ],
  },
]

function eventLabel(type: string, zh: boolean) {
  const event = eventGroups
    .flatMap((group) => group.events)
    .find((item) => item[0] === type)
  return event ? event[zh ? 1 : 2] : type
}

export function RepositoryAutomation({
  projectId,
  branch,
  commitId,
  documentId,
  fromCommitId,
  view,
  canManage,
  active = true,
  presentation = 'page',
  versionName,
}: {
  projectId: RepositoryScope
  branch?: RepositoryBranch
  commitId: string
  documentId?: string
  fromCommitId?: string
  view: 'ai' | 'events'
  canManage: boolean
  active?: boolean
  presentation?: 'page' | 'sidebar'
  versionName?: string
}) {
  const copy = useRepositoryCopy()
  const { t, language } = useLanguage()
  const zh = language === 'zh-CN'
  const id = useId()
  const queryClient = useQueryClient()
  const session = useAuthStore((state) => state.auth.sessionVersion)
  const [message, setMessage] = useState('')
  const [latestAnalysis, setLatestAnalysis] = useState<RepositoryAnalysis>()
  const [withBase, setWithBase] = useState(true)
  const [secret, setSecret] = useState('')
  const [copied, setCopied] = useState(false)
  const [subscriptionKind, setSubscriptionKind] = useState('in_app')
  const [copyError, setCopyError] = useState('')
  const currentSession = () =>
    useAuthStore.getState().auth.sessionVersion === session
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: repositoryKeys.all(projectId) })
  const analysesQuery = useInfiniteQuery({
    queryKey: [...repositoryKeys.all(projectId), 'analyses'],
    initialPageParam: 0,
    queryFn: ({ signal, pageParam }) =>
      listRepositoryAnalyses(projectId, signal, pageParam),
    getNextPageParam: (last) =>
      last.length < 100 ? undefined : last[last.length - 1]?.sequence,
    enabled: active && view === 'ai',
  })
  const eventsQuery = useInfiniteQuery({
    queryKey: [...repositoryKeys.all(projectId), 'events'],
    initialPageParam: 0,
    queryFn: ({ signal, pageParam }) =>
      listRepositoryEvents(projectId, signal, pageParam),
    getNextPageParam: (last) =>
      last.length < 100 ? undefined : last[last.length - 1]?.sequence,
    enabled: active && view === 'events',
  })
  const subscriptionsQuery = useQuery({
    queryKey: [...repositoryKeys.all(projectId), 'subscriptions'],
    queryFn: ({ signal }) => listRepositorySubscriptions(projectId, signal),
    enabled: active && view === 'events' && canManage,
  })
  const deliveriesQuery = useInfiniteQuery({
    queryKey: [...repositoryKeys.all(projectId), 'deliveries'],
    initialPageParam: 0,
    queryFn: ({ signal, pageParam }) =>
      listRepositoryDeliveries(projectId, signal, pageParam),
    getNextPageParam: (last) =>
      last.length < 100 ? undefined : last[last.length - 1]?.sequence,
    enabled: active && view === 'events' && canManage,
  })
  const analysisMutation = useMutation({
    mutationFn: async (
      input: Parameters<typeof analyzeRepositoryChange>[1]
    ) => {
      if (!currentSession()) return
      return analyzeRepositoryChange(projectId, input)
    },
    onSuccess: async (result) => {
      if (currentSession()) {
        if (result) setLatestAnalysis(result)
        await refresh()
      }
    },
  })
  const subscriptionMutation = useMutation({
    mutationFn: async (
      input: Parameters<typeof createRepositorySubscription>[1]
    ) => {
      if (!currentSession()) return
      return createRepositorySubscription(projectId, input)
    },
    onSuccess: async (result) => {
      if (!currentSession()) return
      setSecret(result?.secret ?? '')
      setCopied(false)
      await refresh()
    },
  })
  const pauseMutation = useMutation({
    mutationFn: ({
      subscriptionId,
      paused,
    }: {
      subscriptionId: string
      paused: boolean
    }) => setRepositorySubscriptionPaused(projectId, subscriptionId, paused),
    onSuccess: refresh,
  })
  const retryMutation = useMutation({
    mutationFn: (deliveryId: string) =>
      retryRepositoryDelivery(projectId, deliveryId),
    onSuccess: refresh,
  })
  const allAnalyses = [
    ...new Map(
      [
        ...(analysesQuery.data?.pages.flat() ?? []),
        ...(latestAnalysis ? [latestAnalysis] : []),
      ].map((item) => [item.id, item])
    ).values(),
  ]
  const events = eventsQuery.data?.pages.flat() ?? []
  const deliveries = deliveriesQuery.data?.pages.flat() ?? []
  const analyses = allAnalyses.filter(
    (item) => item.to_commit_id === commitId && item.document_id === documentId
  )
  const date = (value: string) => new Date(value).toLocaleString(language)
  const status = (value: string) =>
    ({
      succeeded: zh ? '已完成' : 'Succeeded',
      failed: zh ? '失败' : 'Failed',
      processing: zh ? '处理中' : 'Processing',
      pending: zh ? '等待处理' : 'Pending',
    })[value] ?? value

  if (view === 'ai')
    return (
      <div className='grid min-w-0 gap-5'>
        <div>
          {presentation === 'page' && (
            <h1 className='text-xl font-semibold'>{copy.ai}</h1>
          )}
          <p className='mt-2 max-w-prose text-sm leading-6 text-muted-foreground'>
            {copy.aiDescription}
          </p>
        </div>
        <dl className='grid gap-2 border-y py-3 text-xs sm:grid-cols-2'>
          <div>
            <dt className='text-muted-foreground'>
              {zh ? '目标提交' : 'Target commit'}
            </dt>
            <dd className='mt-1 font-mono break-all' title={commitId}>
              {versionName || commitId.slice(0, 12)}
            </dd>
          </div>
          {fromCommitId && (
            <div>
              <dt className='text-muted-foreground'>
                {zh ? '基线提交' : 'Base commit'}
              </dt>
              <dd className='mt-1 font-mono break-all' title={fromCommitId}>
                {fromCommitId.slice(0, 12)}
              </dd>
            </div>
          )}
        </dl>
        <form
          className='grid gap-3'
          onSubmit={(event) => {
            event.preventDefault()
            if (analysisMutation.isPending) return
            analysisMutation.mutate({
              to_commit_id: commitId,
              from_commit_id: withBase ? fromCommitId : undefined,
              document_id: documentId,
              message: message || undefined,
              language,
            })
          }}
        >
          {fromCommitId && (
            <label className='flex w-fit items-center gap-2 text-sm'>
              <input
                type='checkbox'
                checked={withBase}
                onChange={(event) => setWithBase(event.target.checked)}
                className='size-4 accent-primary'
              />
              {zh
                ? '分析这两次提交之间的改动'
                : 'Analyze changes between these commits'}
            </label>
          )}
          <Label htmlFor={`${id}-question`}>{copy.question}</Label>
          <Textarea
            id={`${id}-question`}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={analysisMutation.isPending}
            rows={3}
          />
          <Button
            type='submit'
            className='w-fit'
            disabled={analysisMutation.isPending}
          >
            <Sparkles aria-hidden className='size-4' />
            {analysisMutation.isPending ? copy.analyzing : copy.analyze}
          </Button>
        </form>
        <LoadingErrorState
          state={{
            isLoading: false,
            isError: analysisMutation.isError,
            error: analysisMutation.error,
          }}
        />
        <LoadingErrorState state={analysesQuery} />
        <div className='grid gap-6'>
          {analyses.map((item) => (
            <section key={item.id} className='grid min-w-0 gap-3 border-t pt-5'>
              <div className='flex flex-wrap items-center gap-2 text-xs'>
                <Badge variant='outline'>{status(item.status)}</Badge>
                <time dateTime={item.created_at}>{date(item.created_at)}</time>
                <span className='font-mono' title={item.id}>
                  {item.id.slice(0, 12)}
                </span>
              </div>
              <p className='font-mono text-xs break-all text-muted-foreground'>
                {item.from_commit_id
                  ? `${item.from_commit_id.slice(0, 12)} → `
                  : ''}
                {item.to_commit_id.slice(0, 12)}
              </p>
              {item.error_message && (
                <p role='alert' className='text-sm text-destructive'>
                  {item.error_message}
                </p>
              )}
              {item.content && (
                <MarkdownDocumentViewer
                  content={item.content}
                  variant='article'
                />
              )}
            </section>
          ))}
        </div>
        {analysesQuery.hasNextPage && (
          <Button
            size='sm'
            variant='outline'
            className='w-fit'
            disabled={analysesQuery.isFetchingNextPage}
            onClick={() => void analysesQuery.fetchNextPage()}
          >
            {zh ? '加载更多分析' : 'Load more analyses'}
          </Button>
        )}
        {analysesQuery.isSuccess && analyses.length === 0 && (
          <p className='text-sm text-muted-foreground'>
            {zh
              ? '此提交还没有 AI 分析。'
              : 'No AI analysis for this commit yet.'}
          </p>
        )}
      </div>
    )

  return (
    <div className='grid min-w-0 gap-7'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <h3 className='text-sm font-semibold'>
          {zh ? '最近活动' : 'Recent activity'}
        </h3>
        <Button variant='outline' size='sm' onClick={() => void refresh()}>
          <RefreshCw aria-hidden className='size-4' />
          {copy.refresh}
        </Button>
      </div>
      <LoadingErrorState state={eventsQuery} />
      <ol className='divide-y'>
        {events.map((event) => (
          <li key={event.id} className='grid gap-1 py-3 text-sm'>
            <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
              <span className='font-medium'>
                {eventLabel(event.event_type, zh)}
              </span>
              <span className='font-mono text-xs text-muted-foreground'>
                #{event.sequence}
              </span>
              <time
                dateTime={event.created_at}
                className='text-xs text-muted-foreground'
              >
                {date(event.created_at)}
              </time>
            </div>
            <div className='flex flex-wrap gap-2 font-mono text-xs text-muted-foreground'>
              {event.before_commit_id && (
                <span title={event.before_commit_id}>
                  {event.before_commit_id.slice(0, 12)} →
                </span>
              )}
              {event.after_commit_id && (
                <span title={event.after_commit_id}>
                  {event.after_commit_id.slice(0, 12)}
                </span>
              )}
              {event.resource_id && (
                <span title={event.resource_id}>
                  {event.resource_id.slice(0, 12)}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
      {eventsQuery.hasNextPage && (
        <Button
          size='sm'
          variant='outline'
          className='w-fit'
          disabled={eventsQuery.isFetchingNextPage}
          onClick={() => void eventsQuery.fetchNextPage()}
        >
          {zh ? '加载更多活动' : 'Load more activity'}
        </Button>
      )}
      {eventsQuery.isSuccess && !events.length && (
        <p className='text-sm text-muted-foreground'>{copy.noEvents}</p>
      )}
      {canManage && (
        <>
          <section className='grid gap-4 border-t pt-5'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <h2 className='text-sm font-semibold'>
                {zh ? '事件订阅' : 'Event subscriptions'}
              </h2>
              <FormDialog
                title={zh ? '创建订阅' : 'Create subscription'}
                description={
                  zh
                    ? '选择哪些变化需要通知，以及通知发送到哪里。'
                    : 'Choose which changes to follow and where notifications are delivered.'
                }
                triggerLabel={zh ? '创建订阅' : 'Create subscription'}
                pending={subscriptionMutation.isPending}
                submitLabel={t('admin.common.create')}
                submissionScope={`${repositoryScopeKey(projectId)}:${branch?.id}:${documentId ?? ''}`}
                onSubmit={async (data) => {
                  await subscriptionMutation.mutateAsync({
                    name: String(data.get('name') ?? '').trim(),
                    kind: subscriptionKind as 'in_app' | 'webhook',
                    event_types: data.getAll('event_types').map(String),
                    branch_id: data.get('branch_only') ? branch?.id : undefined,
                    document_id: data.get('document_only')
                      ? documentId
                      : undefined,
                    url:
                      subscriptionKind === 'webhook'
                        ? String(data.get('url') ?? '').trim()
                        : undefined,
                  })
                }}
              >
                <TextField
                  label={t('admin.fields.name')}
                  name='name'
                  required
                />
                <NativeSelect
                  label={zh ? '推送方式' : 'Delivery'}
                  placeholder={zh ? '站内' : 'In-app'}
                  value={subscriptionKind}
                  onChange={setSubscriptionKind}
                  options={[
                    { value: 'in_app', label: zh ? '站内' : 'In-app' },
                    { value: 'webhook', label: 'Webhook' },
                  ]}
                />
                {subscriptionKind === 'webhook' && (
                  <TextField
                    label='Webhook URL'
                    name='url'
                    type='url'
                    required
                    description={
                      zh
                        ? '使用公开可访问的 HTTPS 地址。'
                        : 'Use a publicly reachable HTTPS endpoint.'
                    }
                  />
                )}
                <div className='grid gap-5 border-t pt-4'>
                  <p className='text-sm font-medium'>
                    {zh ? '关注哪些变化' : 'Changes to follow'}
                  </p>
                  {eventGroups.map((group) => (
                    <fieldset key={group.en} className='grid gap-2'>
                      <legend className='mb-2 text-xs font-semibold text-muted-foreground'>
                        {zh ? group.zh : group.en}
                      </legend>
                      {group.events.map(
                        ([
                          type,
                          labelZh,
                          labelEn,
                          descriptionZh,
                          descriptionEn,
                        ]) => (
                          <label
                            key={type}
                            className='flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50'
                          >
                            <input
                              type='checkbox'
                              name='event_types'
                              value={type}
                              defaultChecked={type === 'release.published'}
                              className='mt-0.5 size-4 shrink-0 accent-primary'
                            />
                            <span className='grid gap-1'>
                              <span className='text-sm font-medium'>
                                {zh ? labelZh : labelEn}
                              </span>
                              <span className='text-xs leading-5 text-muted-foreground'>
                                {zh ? descriptionZh : descriptionEn}
                              </span>
                            </span>
                          </label>
                        )
                      )}
                    </fieldset>
                  ))}
                </div>
                <div className='grid gap-2 border-t pt-4'>
                  <p className='text-sm font-medium'>
                    {zh ? '接收范围' : 'Notification scope'}
                  </p>
                  <p className='text-xs leading-5 text-muted-foreground'>
                    {documentId
                      ? zh
                        ? '当前文档的事件。勾选分支后，仅接收该分支的变化。'
                        : 'Events for this document. Select a branch to narrow the notifications.'
                      : zh
                        ? '默认接收整个项目的事件，可进一步限定范围。'
                        : 'Follow the project, or narrow the scope below.'}
                  </p>
                </div>
                {branch && (
                  <label className='flex items-center gap-2 text-sm'>
                    <input
                      type='checkbox'
                      name='branch_only'
                      className='size-4 accent-primary'
                    />
                    {zh ? '仅当前分支' : 'Current branch only'} ({branch.name})
                  </label>
                )}
                {documentId && typeof projectId === 'string' && (
                  <label className='flex items-center gap-2 text-sm'>
                    <input
                      type='checkbox'
                      name='document_only'
                      className='size-4 accent-primary'
                    />
                    {zh ? '仅当前文档' : 'Current document only'}
                  </label>
                )}
              </FormDialog>
            </div>
            {secret && (
              <Alert>
                <AlertDescription className='grid gap-3'>
                  <p>
                    {zh
                      ? 'Webhook 签名密钥只显示这一次，请保存。'
                      : 'Save this webhook signing secret. It is shown only once.'}
                  </p>
                  <code className='break-all select-all'>{secret}</code>
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => {
                        void navigator.clipboard.writeText(secret).then(
                          () => setCopied(true),
                          () =>
                            setCopyError(
                              zh
                                ? '复制失败，请手动保存密钥。'
                                : 'Copy failed. Save the secret manually.'
                            )
                        )
                      }}
                    >
                      <Copy aria-hidden className='size-4' />
                      {copied
                        ? zh
                          ? '已复制'
                          : 'Copied'
                        : zh
                          ? '复制密钥'
                          : 'Copy secret'}
                    </Button>
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => setSecret('')}
                    >
                      {zh ? '关闭' : 'Dismiss'}
                    </Button>
                  </div>
                  {copyError && <p role='alert'>{copyError}</p>}
                </AlertDescription>
              </Alert>
            )}
            <LoadingErrorState state={subscriptionsQuery} />
            <LoadingErrorState
              state={{
                isLoading: false,
                isError: pauseMutation.isError,
                error: pauseMutation.error,
              }}
            />
            <ul className='divide-y'>
              {subscriptionsQuery.data?.map((subscription) => (
                <li
                  key={subscription.id}
                  className='flex flex-wrap items-start justify-between gap-3 py-3'
                >
                  <div className='grid min-w-0 gap-1'>
                    <p className='flex items-center gap-2 text-sm font-medium'>
                      <Bell aria-hidden className='size-4' />
                      {subscription.name}
                      <Badge variant='outline'>
                        {subscription.paused
                          ? zh
                            ? '已暂停'
                            : 'Paused'
                          : zh
                            ? '启用中'
                            : 'Active'}
                      </Badge>
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {subscription.kind === 'in_app'
                        ? zh
                          ? '站内通知'
                          : 'In-app'
                        : 'Webhook'}{' '}
                      ·{' '}
                      {subscription.event_types
                        .map((type) => eventLabel(type, zh))
                        .join(' · ')}
                    </p>
                    {subscription.url && (
                      <p className='max-w-xl truncate text-xs text-muted-foreground'>
                        {subscription.url}
                      </p>
                    )}
                  </div>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={pauseMutation.isPending}
                    onClick={() =>
                      pauseMutation.mutate({
                        subscriptionId: subscription.id,
                        paused: !subscription.paused,
                      })
                    }
                  >
                    {subscription.paused ? (
                      <Play aria-hidden className='size-4' />
                    ) : (
                      <Pause aria-hidden className='size-4' />
                    )}
                    {subscription.paused
                      ? zh
                        ? '恢复'
                        : 'Resume'
                      : zh
                        ? '暂停'
                        : 'Pause'}
                  </Button>
                </li>
              ))}
            </ul>
            {subscriptionsQuery.isSuccess &&
              !subscriptionsQuery.data.length && (
                <p className='text-sm text-muted-foreground'>
                  {zh ? '暂无订阅。' : 'No subscriptions yet.'}
                </p>
              )}
          </section>
          <section className='grid gap-4 border-t pt-5'>
            <h2 className='text-sm font-semibold'>
              {zh ? '推送记录' : 'Delivery history'}
            </h2>
            <LoadingErrorState state={deliveriesQuery} />
            <LoadingErrorState
              state={{
                isLoading: false,
                isError: retryMutation.isError,
                error: retryMutation.error,
              }}
            />
            <ul className='divide-y'>
              {deliveries.map((delivery) => (
                <li
                  key={delivery.id}
                  className='flex flex-wrap items-start justify-between gap-3 py-3'
                >
                  <div className='grid min-w-0 gap-1'>
                    <p className='text-sm'>
                      {eventLabel(delivery.event_type, zh)}{' '}
                      <Badge variant='outline'>{status(delivery.status)}</Badge>
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      #{delivery.event_sequence} ·{' '}
                      {zh ? '尝试次数' : 'Attempts'}: {delivery.attempt_count}
                      {delivery.http_status
                        ? ` · HTTP ${delivery.http_status}`
                        : ''}{' '}
                      · {date(delivery.created_at)}
                    </p>
                    {delivery.last_error && (
                      <p className='max-w-prose text-xs break-words text-destructive'>
                        {delivery.last_error}
                      </p>
                    )}
                  </div>
                  {delivery.status === 'failed' && (
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={retryMutation.isPending}
                      onClick={() => retryMutation.mutate(delivery.id)}
                    >
                      <RefreshCw aria-hidden className='size-4' />
                      {zh ? '重试' : 'Retry'}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {deliveriesQuery.hasNextPage && (
              <Button
                size='sm'
                variant='outline'
                className='w-fit'
                disabled={deliveriesQuery.isFetchingNextPage}
                onClick={() => void deliveriesQuery.fetchNextPage()}
              >
                {zh ? '加载更多推送记录' : 'Load more deliveries'}
              </Button>
            )}
            {deliveriesQuery.isSuccess && !deliveries.length && (
              <p className='text-sm text-muted-foreground'>
                {zh ? '暂无推送记录。' : 'No deliveries yet.'}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
