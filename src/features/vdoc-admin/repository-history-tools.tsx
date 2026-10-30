import { lazy, Suspense, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { GitCommitHorizontal, GitMerge, History } from 'lucide-react'
import {
  compareRepositoryCommits,
  createRepositoryMergeRequest,
  listRepositoryCommits,
  listRepositoryMergeRequests,
  listRepositoryReleases,
  publishRepositoryCommit,
  repositoryMergeAction,
  revertRepositoryCommit,
  type RepositoryBranch,
  type RepositoryComparison,
  type RepositoryMergeRequest,
} from '@/lib/repository-api'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ConfirmActionButton,
  LoadingErrorState,
  NativeSelect,
} from './page-shared'
import { useRepositoryCopy } from './repository-copy'
import { RepositoryMergePreview } from './repository-merge-preview'
import { RepositoryMergeResolver } from './repository-merge-resolver'
import { RepositoryShareDialog } from './repository-share-dialog'
import type { RepositoryView } from './repository-workspace'

const SourceDiffViewer = lazy(() => import('./source-diff-viewer'))

export function RepositoryHistoryTools({
  projectId,
  branch,
  branches,
  commitId,
  documentId,
  view,
  canManage,
  canWrite,
  compareSelection,
  onCompareSelection,
  onOpenCommit,
  onChanged,
}: {
  projectId: string
  branch: RepositoryBranch
  branches: RepositoryBranch[]
  commitId: string
  documentId?: string
  view: RepositoryView
  canManage: boolean
  canWrite: boolean
  compareSelection: { from: string; to: string }
  onCompareSelection: (value: { from: string; to: string }) => void
  onOpenCommit: (id: string) => void
  onChanged: () => Promise<unknown>
}) {
  const copy = useRepositoryCopy()
  const { t, language } = useLanguage()
  const [historyFilter, setHistoryFilter] = useState(Boolean(documentId))
  const [cursor, setCursor] = useState('')
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const [sourceBranchId, setSourceBranchId] = useState(branch.id)
  const [targetBranchId, setTargetBranchId] = useState(
    branches.find((item) => item.name === 'main')?.id ?? branch.id
  )
  const [compareFromBranchId, setCompareFromBranchId] = useState(branch.id)
  const [allFiles, setAllFiles] = useState(!documentId)
  const [comparison, setComparison] = useState<RepositoryComparison>()
  const [message, setMessage] = useState('')
  const [mergeTitle, setMergeTitle] = useState('')
  const [resolving, setResolving] = useState<RepositoryMergeRequest>()
  const [resolvedId, setResolvedId] = useState('')
  const [preview, setPreview] = useState<RepositoryMergeRequest>()
  const commitsQuery = useQuery({
    queryKey: [
      'repository',
      projectId,
      'history',
      branch.id,
      historyFilter ? documentId : '',
      cursor,
    ],
    queryFn: ({ signal }) =>
      listRepositoryCommits(
        projectId,
        {
          branch_id: branch.id,
          document_id: historyFilter ? documentId : undefined,
          cursor: cursor || undefined,
        },
        signal
      ),
    enabled: view === 'history' || view === 'compare',
  })
  const fromCommitsQuery = useQuery({
    queryKey: ['repository', projectId, 'history', compareFromBranchId, '', ''],
    queryFn: ({ signal }) =>
      listRepositoryCommits(
        projectId,
        { branch_id: compareFromBranchId },
        signal
      ),
    enabled: view === 'compare',
  })
  const mergesQuery = useQuery({
    queryKey: ['repository', projectId, 'merge-requests'],
    queryFn: ({ signal }) => listRepositoryMergeRequests(projectId, signal),
    enabled: view === 'merges',
  })
  const releasesQuery = useQuery({
    queryKey: ['repository', projectId, 'releases'],
    queryFn: ({ signal }) => listRepositoryReleases(projectId, signal),
    enabled: view === 'releases',
  })
  const comparisonMutation = useMutation({
    mutationFn: (input: {
      from_commit_id: string
      to_commit_id: string
      document_id?: string
    }) => compareRepositoryCommits(projectId, input),
    onSuccess: setComparison,
  })
  const mergeMutation = useMutation({
    mutationFn: () =>
      createRepositoryMergeRequest(projectId, {
        source_branch_id: sourceBranchId,
        target_branch_id: targetBranchId,
        title: mergeTitle || undefined,
      }),
    onSuccess: () => onChanged(),
  })
  const reviewMutation = useMutation({
    mutationFn: ({
      request,
      action,
    }: {
      request: RepositoryMergeRequest
      action: 'approve' | 'merge'
    }) => repositoryMergeAction(projectId, request, action),
    onSuccess: () => onChanged(),
  })
  const label = (id: string) =>
    branches.find((item) => item.id === id)?.name ?? id
  const date = (value: string) => new Date(value).toLocaleString(language)
  const doCompare = (from: string, to: string, scope?: string) => {
    setComparison(undefined)
    comparisonMutation.mutate({
      from_commit_id: from,
      to_commit_id: to,
      document_id: scope,
    })
  }
  const from =
    compareSelection.from ||
    fromCommitsQuery.data?.items[1]?.id ||
    fromCommitsQuery.data?.items[0]?.id ||
    ''
  const to = compareSelection.to || commitId
  return (
    <div className='grid min-w-0 gap-5'>
      {view === 'history' && (
        <>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <h1 className='text-xl font-semibold'>{copy.history}</h1>
            {documentId && (
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setHistoryFilter(!historyFilter)
                  setCursor('')
                  setCursorStack([])
                }}
              >
                {historyFilter ? copy.allFiles : copy.thisFile}
              </Button>
            )}
          </div>
          <LoadingErrorState state={commitsQuery} />
          {commitsQuery.isSuccess && !commitsQuery.data.items.length && (
            <p className='py-8 text-sm text-muted-foreground'>
              {copy.noCommits}
            </p>
          )}
          <ol className='divide-y'>
            {commitsQuery.data?.items.map((item) => (
              <li key={item.id} className='grid gap-3 py-4'>
                <div className='flex items-start gap-3'>
                  <GitCommitHorizontal
                    aria-hidden
                    className='mt-1 size-4 shrink-0 text-muted-foreground'
                  />
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm font-medium break-words'>
                      {item.message || item.id.slice(0, 12)}
                    </p>
                    <p className='mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground'>
                      <code title={item.id}>{item.id.slice(0, 12)}</code>
                      <span>{date(item.created_at)}</span>
                      <span
                        className='max-w-48 truncate'
                        title={item.created_by}
                      >
                        {item.created_by}
                      </span>
                      <span>
                        {copy.files}: {item.files.length}
                      </span>
                    </p>
                    {item.provenance && (
                      <p className='mt-1 text-xs text-muted-foreground'>
                        {item.provenance}
                      </p>
                    )}
                  </div>
                </div>
                <div className='flex flex-wrap gap-2 ps-7'>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => onOpenCommit(item.id)}
                  >
                    {copy.open}
                  </Button>
                  {item.parent_ids[0] && (
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() =>
                        doCompare(
                          item.parent_ids[0],
                          item.id,
                          historyFilter ? documentId : undefined
                        )
                      }
                    >
                      {copy.compareParent}
                    </Button>
                  )}
                  {canWrite &&
                    !branch.is_protected &&
                    item.parent_ids.length > 0 && (
                      <ConfirmActionButton
                        label={copy.revert}
                        title={copy.revert}
                        description={copy.revertConfirm}
                        onConfirm={async () => {
                          await revertRepositoryCommit(
                            projectId,
                            branch,
                            item.id,
                            crypto.randomUUID()
                          )
                          await onChanged()
                        }}
                      />
                    )}
                </div>
              </li>
            ))}
          </ol>
          <div className='flex justify-end gap-2'>
            <Button
              size='sm'
              variant='outline'
              disabled={!cursorStack.length || commitsQuery.isFetching}
              onClick={() => {
                setCursor(cursorStack[cursorStack.length - 1] ?? '')
                setCursorStack((current) => current.slice(0, -1))
              }}
            >
              {copy.previous}
            </Button>
            <Button
              size='sm'
              variant='outline'
              disabled={
                !commitsQuery.data?.nextCursor || commitsQuery.isFetching
              }
              onClick={() => {
                setCursorStack((current) => [...current, cursor])
                setCursor(commitsQuery.data?.nextCursor ?? '')
              }}
            >
              {copy.next}
            </Button>
          </div>
        </>
      )}
      {view === 'compare' && (
        <>
          <h1 className='text-xl font-semibold'>{copy.compare}</h1>
          <div className='grid min-w-0 gap-4 md:grid-cols-2'>
            <div className='grid gap-3'>
              <NativeSelect
                label={copy.sourceBranch}
                placeholder={copy.branch}
                value={compareFromBranchId}
                options={branches.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
                onChange={(value) => {
                  setCompareFromBranchId(value)
                  onCompareSelection({ from: '', to })
                  setComparison(undefined)
                }}
              />
              <NativeSelect
                label={copy.source}
                placeholder={copy.source}
                value={from}
                options={(fromCommitsQuery.data?.items ?? []).map((item) => ({
                  value: item.id,
                  label: `${item.id.slice(0, 10)} · ${item.message}`,
                }))}
                onChange={(value) => {
                  onCompareSelection({ from: value, to })
                  setComparison(undefined)
                }}
              />
            </div>
            <div className='grid gap-3'>
              <div className='grid gap-2'>
                <Label>{copy.targetBranch}</Label>
                <p className='flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm'>
                  {branch.name}
                </p>
              </div>
              <NativeSelect
                label={copy.target}
                placeholder={copy.target}
                value={to}
                options={[
                  ...new Map([
                    ...(commitsQuery.data?.items ?? []).map(
                      (item) =>
                        [
                          item.id,
                          {
                            value: item.id,
                            label: `${item.id.slice(0, 10)} · ${item.message}`,
                          },
                        ] as const
                    ),
                    [
                      commitId,
                      { value: commitId, label: commitId.slice(0, 12) },
                    ] as const,
                  ]).values(),
                ]}
                onChange={(value) => {
                  onCompareSelection({ from, to: value })
                  setComparison(undefined)
                }}
              />
            </div>
          </div>
          <LoadingErrorState state={fromCommitsQuery} />
          <div className='flex flex-wrap items-center gap-3'>
            <Button
              disabled={!from || !to || comparisonMutation.isPending}
              onClick={() =>
                doCompare(from, to, allFiles ? undefined : documentId)
              }
            >
              {copy.runCompare}
            </Button>
            {documentId && (
              <label className='inline-flex items-center gap-2 text-sm'>
                <input
                  type='checkbox'
                  checked={allFiles}
                  onChange={(event) => {
                    setAllFiles(event.target.checked)
                    setComparison(undefined)
                  }}
                />
                {copy.allFiles}
              </label>
            )}
          </div>
        </>
      )}
      {view === 'merges' && (
        <>
          <h1 className='text-xl font-semibold'>{copy.merges}</h1>
          {canWrite && (
            <form
              className='grid gap-4 border-b pb-5'
              onSubmit={(event) => {
                event.preventDefault()
                mergeMutation.mutate()
              }}
            >
              <div className='grid gap-4 sm:grid-cols-2'>
                <NativeSelect
                  label={copy.sourceBranch}
                  placeholder={copy.sourceBranch}
                  value={sourceBranchId}
                  options={branches.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                  onChange={setSourceBranchId}
                />
                <NativeSelect
                  label={copy.targetBranch}
                  placeholder={copy.targetBranch}
                  value={targetBranchId}
                  options={branches.map((item) => ({
                    value: item.id,
                    label: item.name,
                  }))}
                  onChange={setTargetBranchId}
                />
              </div>
              <label className='grid gap-2 text-sm'>
                {copy.title}
                <Input
                  value={mergeTitle}
                  onChange={(event) => setMergeTitle(event.target.value)}
                />
              </label>
              <Button
                className='w-fit'
                disabled={
                  sourceBranchId === targetBranchId || mergeMutation.isPending
                }
              >
                <GitMerge aria-hidden />
                {copy.requestMerge}
              </Button>
            </form>
          )}
          <LoadingErrorState
            state={{
              isLoading: false,
              isError: mergeMutation.isError,
              error: mergeMutation.error,
            }}
          />
          <LoadingErrorState
            state={{
              isLoading: false,
              isError: reviewMutation.isError,
              error: reviewMutation.error,
            }}
          />
          <LoadingErrorState state={mergesQuery} />
          {mergesQuery.isSuccess && !mergesQuery.data.length && (
            <p className='py-8 text-sm text-muted-foreground'>
              {copy.noMerges}
            </p>
          )}
          <ul className='divide-y'>
            {mergesQuery.data?.map((request) => {
              const stale =
                branches.find((item) => item.id === request.source_branch_id)
                  ?.head_commit_id !== request.source_commit_id ||
                branches.find((item) => item.id === request.target_branch_id)
                  ?.head_commit_id !== request.target_commit_id ||
                branches.find((item) => item.id === request.source_branch_id)
                  ?.generation !== request.source_generation ||
                branches.find((item) => item.id === request.target_branch_id)
                  ?.generation !== request.target_generation
              return (
                <li key={request.id} className='grid gap-3 py-4'>
                  <div className='flex flex-wrap justify-between gap-2'>
                    <h2 className='text-sm font-medium'>
                      {request.title ||
                        `${label(request.source_branch_id)} → ${label(request.target_branch_id)}`}
                    </h2>
                    <Badge variant='outline'>{request.status}</Badge>
                  </div>
                  <p className='font-mono text-xs text-muted-foreground'>
                    {request.source_commit_id.slice(0, 12)} →{' '}
                    {request.target_commit_id.slice(0, 12)}
                  </p>
                  {request.conflicts.length > 0 && (
                    <Alert variant='destructive'>
                      <AlertDescription>
                        {copy.conflicts}: {request.conflicts.join(', ')}
                      </AlertDescription>
                    </Alert>
                  )}
                  {stale &&
                    (request.status === 'open' ||
                      request.status === 'approved') && (
                      <p className='text-sm text-destructive'>
                        {copy.staleReview}
                      </p>
                    )}
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setPreview(request)}
                    >
                      {language === 'zh-CN'
                        ? '审阅合并候选结果'
                        : 'Review merge candidate'}
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() =>
                        doCompare(
                          request.target_commit_id,
                          request.source_commit_id
                        )
                      }
                    >
                      {language === 'zh-CN'
                        ? '比较来源与目标'
                        : 'Compare inputs'}
                    </Button>
                    {canManage &&
                      !stale &&
                      !request.conflicts.length &&
                      request.status === 'open' && (
                        <Button
                          variant='outline'
                          size='sm'
                          disabled={reviewMutation.isPending}
                          onClick={() =>
                            reviewMutation.mutate({
                              request,
                              action: 'approve',
                            })
                          }
                        >
                          {copy.approve}
                        </Button>
                      )}
                    {canWrite &&
                      !stale &&
                      request.conflicts.length > 0 &&
                      request.status === 'open' && (
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => setResolving(request)}
                        >
                          {language === 'zh-CN'
                            ? '解决冲突'
                            : 'Resolve conflicts'}
                        </Button>
                      )}
                    {canManage &&
                      !stale &&
                      !request.conflicts.length &&
                      request.status === 'approved' && (
                        <ConfirmActionButton
                          label={copy.merge}
                          title={copy.merge}
                          description={`${request.source_commit_id.slice(0, 12)} → ${request.target_commit_id.slice(0, 12)}`}
                          destructive={false}
                          onConfirm={async () => {
                            await reviewMutation.mutateAsync({
                              request,
                              action: 'merge',
                            })
                          }}
                        />
                      )}
                    {request.merged_commit_id && (
                      <Button
                        variant='link'
                        size='sm'
                        onClick={() => onOpenCommit(request.merged_commit_id!)}
                      >
                        {copy.open}
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
      {view === 'merges' && preview && (
        <RepositoryMergePreview
          key={`${preview.id}:${preview.generation}`}
          projectId={projectId}
          request={preview}
        />
      )}
      {view === 'merges' && resolvedId && (
        <p role='status' className='text-sm text-muted-foreground'>
          {language === 'zh-CN'
            ? '已创建新的合并请求，请检查内容后再批准：'
            : 'New merge request created. Review its content before approval: '}
          <code>{resolvedId.slice(0, 12)}</code>
        </p>
      )}
      {view === 'merges' && resolving && (
        <RepositoryMergeResolver
          key={resolving.id}
          projectId={projectId}
          request={resolving}
          onCancel={() => setResolving(undefined)}
          onResolved={async (result) => {
            setResolving(undefined)
            setResolvedId(result.id)
            await onChanged()
          }}
        />
      )}
      {view === 'releases' && (
        <>
          <h1 className='text-xl font-semibold'>{copy.releases}</h1>
          <p className='max-w-prose text-sm leading-6 text-muted-foreground'>
            {copy.publicationBoundary}
          </p>
          {canManage && (
            <div className='grid gap-3 border-b pb-5'>
              <p className='flex items-center gap-2 font-mono text-xs'>
                <GitCommitHorizontal aria-hidden className='size-4' />
                {commitId}
              </p>
              <label className='grid gap-2 text-sm'>
                {copy.publicationNote}
                <Input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </label>
              <div>
                <ConfirmActionButton
                  label={copy.publish}
                  title={copy.publish}
                  description={`${copy.publishConfirm} ${commitId}`}
                  destructive={false}
                  variant='default'
                  onConfirm={async () => {
                    await publishRepositoryCommit(
                      projectId,
                      branch,
                      commitId,
                      message || undefined
                    )
                    setMessage('')
                    await onChanged()
                  }}
                />
              </div>
              <p className='text-xs text-muted-foreground'>{copy.generated}</p>
            </div>
          )}
          <LoadingErrorState state={releasesQuery} />
          {releasesQuery.isSuccess && !releasesQuery.data.length && (
            <p className='py-8 text-sm text-muted-foreground'>
              {copy.noReleases}
            </p>
          )}
          <ul className='divide-y'>
            {releasesQuery.data?.map((release) => (
              <li
                key={release.id}
                className='flex flex-wrap items-start justify-between gap-3 py-4'
              >
                <div className='min-w-0'>
                  <p className='text-sm font-medium'>{release.version_name}</p>
                  <p className='mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground'>
                    <code title={release.commit_id}>
                      {release.commit_id.slice(0, 12)}
                    </code>
                    <span>{date(release.published_at)}</span>
                    <span>{label(release.branch_id)}</span>
                  </p>
                  {release.message && (
                    <p className='mt-2 text-sm break-words'>
                      {release.message}
                    </p>
                  )}
                </div>
                <div className='flex flex-wrap gap-2'>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => onOpenCommit(release.commit_id)}
                  >
                    <History aria-hidden className='size-4' />
                    {copy.open}
                  </Button>
                  {canManage && documentId && (
                    <RepositoryShareDialog
                      projectId={projectId}
                      documentId={documentId}
                      releaseId={release.id}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <LoadingErrorState
        state={{
          isLoading: false,
          isError: comparisonMutation.isError,
          error: comparisonMutation.error,
        }}
      />
      {comparison && (
        <section
          className='grid min-w-0 gap-5 border-t pt-5'
          aria-label={copy.compare}
        >
          <p className='font-mono text-xs text-muted-foreground'>
            {comparison.from_commit_id.slice(0, 12)} →{' '}
            {comparison.to_commit_id.slice(0, 12)}
          </p>
          {!comparison.files.length && (
            <p className='text-sm text-muted-foreground'>{copy.noChanges}</p>
          )}
          {comparison.files.map((file) => (
            <div key={file.document_id} className='grid min-w-0 gap-2'>
              <h2 className='font-mono text-sm break-all'>
                {file.old_relative_path &&
                file.old_relative_path !== file.relative_path
                  ? `${file.old_relative_path} → `
                  : ''}
                {file.relative_path}
              </h2>
              <p className='text-xs text-muted-foreground'>
                {file.change_type}
                {file.semantic_status
                  ? ` · ${copy.semantic}: ${file.semantic_status}`
                  : ''}
              </p>
              <Suspense
                fallback={<p role='status'>{t('admin.common.loading')}</p>}
              >
                <SourceDiffViewer
                  before={file.old_content}
                  after={file.new_content}
                  fromLabel={comparison.from_commit_id.slice(0, 12)}
                  toLabel={comparison.to_commit_id.slice(0, 12)}
                  fileName={file.relative_path}
                />
              </Suspense>
              {file.semantic_diff != null && (
                <details>
                  <summary className='cursor-pointer text-sm'>
                    {copy.semantic}
                  </summary>
                  <pre className='max-h-80 overflow-auto bg-muted p-3 font-mono text-xs'>
                    {JSON.stringify(file.semantic_diff, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
