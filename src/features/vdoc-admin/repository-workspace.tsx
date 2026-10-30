import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  GitCommitHorizontal,
  History,
  LockKeyhole,
  RefreshCw,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import {
  bootstrapRepository,
  createRepositoryBranch,
  getRepositoryContent,
  repositoryKeys,
  type RepositoryBranch,
  type RepositoryCommit,
} from '@/lib/repository-api'
import type { DocumentDTO } from '@/lib/vdoc-api'
import type { VdocRouteSearch } from '@/lib/vdoc-route-search'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DocumentReader } from '@/features/document-reader/document-reader'
import {
  FormDialog,
  LoadingErrorState,
  NativeSelect,
  TextField,
} from './page-shared'
import { RepositoryAutomation } from './repository-automation'
import { useRepositoryCopy } from './repository-copy'
import { RepositoryEditor, type RepositoryEdit } from './repository-editor'
import { RepositoryHistoryTools } from './repository-history-tools'
import { useRepositorySnapshot } from './use-repository-snapshot'

export type RepositoryView = NonNullable<VdocRouteSearch['repository_view']>

export function RepositoryWorkspace({
  projectId,
  projectName,
  document,
  legacyDocuments,
  search,
  canManage,
  canWrite,
  interactive,
  navigationActions,
  onSearchChange,
}: {
  projectId: string
  projectName?: string
  document?: DocumentDTO
  legacyDocuments: DocumentDTO[]
  search: VdocRouteSearch
  canManage: boolean
  canWrite: boolean
  interactive: boolean
  navigationActions?: ReactNode
  onSearchChange: (patch: Partial<VdocRouteSearch>, replace?: boolean) => void
}) {
  const copy = useRepositoryCopy()
  const queryClient = useQueryClient()
  const { branchesQuery, branches, branch, commitId, commitQuery } =
    useRepositorySnapshot(projectId, search)
  const view = search.repository_view ?? 'content'
  const [edits, setEdits] = useState<Record<string, RepositoryEdit>>({})
  const sessionVersion = useAuthStore((state) => state.auth.sessionVersion)
  const scope = `${sessionVersion}:${projectId}:${search.repository_branch_id ?? ''}:${document?.id ?? ''}:${view}`
  const ownerRef = useRef(scope)
  useLayoutEffect(() => {
    ownerRef.current = scope
    return () => {
      ownerRef.current = ''
    }
  }, [scope])
  const [compareSelection, setCompareSelection] = useState({ from: '', to: '' })
  const file = commitQuery.data?.files.find(
    (item) => item.document_id === document?.id
  )
  const contentQuery = useQuery({
    queryKey: ['repository', projectId, 'content', commitId, document?.id],
    queryFn: ({ signal }) =>
      getRepositoryContent(projectId, commitId, document!.id, signal),
    enabled: Boolean(file && document?.id && commitId),
    refetchOnWindowFocus: false,
  })
  const editKey = `${branch?.id ?? ''}:${document?.id ?? ''}`
  const edit = edits[editKey]
  const dirty = Object.values(edits).some((item) => item.dirty)
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: repositoryKeys.all(projectId) })
  const importMutation = useMutation({
    mutationFn: () => bootstrapRepository(projectId),
    onSuccess: async (imported) => {
      await invalidate()
      if (ownerRef.current !== scope) return
      const initial =
        imported.find((item) => item.name === 'main') ?? imported[0]
      if (initial)
        onSearchChange({
          repository_branch_id: initial.id,
          commit_id: undefined,
        })
    },
  })
  const setView = (next: RepositoryView) =>
    onSearchChange({ repository_view: next })
  const openCommit = (commit: RepositoryCommit | string) => {
    onSearchChange({
      commit_id: typeof commit === 'string' ? commit : commit.id,
      repository_view: 'content',
    })
  }
  const branchChanged = (next: string) => {
    onSearchChange({
      repository_branch_id: next,
      commit_id: undefined,
      repository_view: 'content',
      folder_id: undefined,
    })
  }
  const startEditing = () => {
    if (!branch) return
    onSearchChange({ commit_id: undefined, repository_view: 'edit' })
  }
  const nav: { id: RepositoryView; label: string }[] = [
    { id: 'content', label: copy.read },
    ...(canWrite ? [{ id: 'edit' as const, label: copy.edit }] : []),
    { id: 'history', label: copy.history },
    { id: 'compare', label: copy.compare },
    { id: 'merges', label: copy.merges },
    { id: 'releases', label: copy.releases },
    { id: 'ai', label: copy.ai },
    { id: 'events', label: copy.events },
  ]
  return (
    <section
      className='flex h-full min-h-0 min-w-0 flex-col'
      aria-label={projectName}
    >
      <header className='flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2'>
        <div className='flex min-w-0 items-center gap-2'>
          {navigationActions}
          <span className='truncate text-sm font-medium'>{projectName}</span>
        </div>
        <div className='flex items-center gap-1'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => void invalidate()}
            aria-label={copy.refresh}
          >
            <RefreshCw aria-hidden className='size-4' />
          </Button>
          {canWrite && interactive && branch && !branch.import_required && (
            <RepositoryBranchDialog
              projectId={projectId}
              fromCommitId={commitId}
              onCreated={(created) => {
                void invalidate()
                if (ownerRef.current === scope) branchChanged(created.id)
              }}
            />
          )}
        </div>
      </header>
      <div className='grid shrink-0 gap-3 border-b bg-[var(--surface-control)] px-4 py-3 sm:grid-cols-[minmax(11rem,18rem)_minmax(0,1fr)]'>
        <NativeSelect
          label={copy.branch}
          placeholder={copy.branch}
          value={branch?.id ?? ''}
          options={branches.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
          disabled={branchesQuery.isPending}
          onChange={branchChanged}
        />
        <div className='flex min-w-0 flex-wrap items-end gap-2 pb-1 text-xs'>
          <span
            className='inline-flex items-center gap-1.5 font-mono'
            title={commitId}
          >
            <GitCommitHorizontal aria-hidden className='size-4' />
            {commitId.slice(0, 12)}
          </span>
          {branch?.is_protected && (
            <Badge variant='outline'>
              <LockKeyhole aria-hidden className='me-1 size-3' />
              {copy.protectedBranch}
            </Badge>
          )}
          {search.commit_id && (
            <Button
              variant='link'
              size='sm'
              className='h-auto p-0 text-xs'
              onClick={() => onSearchChange({ commit_id: undefined })}
            >
              {copy.latest}
            </Button>
          )}
          {dirty && (
            <span role='status' className='text-muted-foreground'>
              {copy.unsaved}
            </span>
          )}
        </div>
      </div>
      <nav
        aria-label={copy.commit}
        className='flex shrink-0 gap-1 overflow-x-auto border-b px-3 py-2'
      >
        {nav.map((item) => (
          <Button
            key={item.id}
            size='sm'
            variant={view === item.id ? 'secondary' : 'ghost'}
            aria-pressed={view === item.id}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </nav>
      <main
        id='content'
        tabIndex={-1}
        className='min-h-0 flex-1 overflow-y-auto p-4 focus:outline-none sm:p-6'
      >
        <div className='mx-auto grid w-full max-w-6xl min-w-0 gap-5'>
          <LoadingErrorState state={branchesQuery} />
          <LoadingErrorState state={commitQuery} />
          {search.repository_branch_id &&
            branchesQuery.isSuccess &&
            !branch && (
              <Alert variant='destructive'>
                <AlertDescription>{copy.unavailable}</AlertDescription>
              </Alert>
            )}
          {(branch?.import_required ||
            (commitQuery.data?.files.length === 0 &&
              legacyDocuments.some(
                (item) => item.latest_draft_id || item.latest_version_id
              ))) && (
            <div className='grid gap-3 border-b pb-5'>
              <p className='max-w-prose text-sm leading-6 text-muted-foreground'>
                {copy.importDescription}
              </p>
              {!canManage && (
                <p className='text-sm text-muted-foreground'>
                  {copy.importRequired}
                </p>
              )}
              {canManage && interactive && (
                <Button
                  className='w-fit'
                  disabled={importMutation.isPending}
                  onClick={() => importMutation.mutate()}
                >
                  {copy.import}
                </Button>
              )}
              <LoadingErrorState
                state={{
                  isLoading: false,
                  isError: importMutation.isError,
                  error: importMutation.error,
                }}
              />
            </div>
          )}
          {commitQuery.isSuccess && (
            <div hidden={view !== 'content'}>
              {search.commit_id && (
                <p className='text-xs text-muted-foreground'>
                  {copy.immutable}
                </p>
              )}
              {document ? (
                <>
                  <LoadingErrorState state={contentQuery} />
                  {file ? (
                    contentQuery.data && (
                      <DocumentReader
                        title={contentQuery.data.document.name}
                        filePath={contentQuery.data.document.relative_path}
                        documentType={contentQuery.data.document.document_type}
                        content={contentQuery.data.content}
                        metadata={
                          <p className='text-xs text-muted-foreground'>
                            {commitQuery.data?.message}
                          </p>
                        }
                      />
                    )
                  ) : (
                    <div className='grid gap-3 py-10'>
                      <h1 className='text-xl font-semibold'>{document.name}</h1>
                      <p className='text-sm text-muted-foreground'>
                        {copy.missing}
                      </p>
                      {canWrite && interactive && (
                        <Button className='w-fit' onClick={startEditing}>
                          {copy.edit}
                        </Button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h1 className='text-2xl font-semibold'>{projectName}</h1>
                  {!commitQuery.isPending &&
                    !commitQuery.data?.files.length && (
                      <p className='py-8 text-sm text-muted-foreground'>
                        {copy.empty}
                      </p>
                    )}
                  <ul className='divide-y'>
                    {commitQuery.data?.files.map((item) => (
                      <li key={item.document_id}>
                        <button
                          type='button'
                          className='flex w-full items-center gap-3 py-3 text-start text-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-ring'
                          onClick={() =>
                            onSearchChange({
                              document_id: item.document_id,
                              repository_view: 'content',
                              folder_id: undefined,
                            })
                          }
                        >
                          <GitCommitHorizontal
                            aria-hidden
                            className='size-4 shrink-0'
                          />
                          <span className='min-w-0 flex-1 truncate font-mono text-xs'>
                            {item.relative_path}
                          </span>
                          <span className='truncate text-muted-foreground'>
                            {item.name}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          {view === 'edit' && file && !contentQuery.isSuccess && (
            <LoadingErrorState state={contentQuery} />
          )}
          {(view === 'edit' || edit) &&
            branch &&
            commitQuery.isSuccess &&
            (!file || contentQuery.isSuccess || edit) && (
              <div hidden={view !== 'edit'}>
                <RepositoryEditor
                  key={editKey}
                  projectId={projectId}
                  branch={branch}
                  document={document}
                  baseCommitId={commitId}
                  files={commitQuery.data?.files ?? []}
                  content={contentQuery.data}
                  contentPending={Boolean(file && contentQuery.isPending)}
                  initialEdit={edit}
                  canWrite={canWrite && interactive && !branch.import_required}
                  canManage={canManage}
                  onEdit={(next) =>
                    setEdits((current) => ({ ...current, [editKey]: next }))
                  }
                  onSaved={async (saved, savedBranchId) => {
                    setEdits((current) => {
                      if (current[editKey] !== edit) return current
                      const next = { ...current }
                      delete next[editKey]
                      return next
                    })
                    queryClient.setQueryData(
                      repositoryKeys.commit(projectId, saved.id),
                      saved
                    )
                    await invalidate()
                    if (ownerRef.current !== scope) return
                    onSearchChange({
                      repository_branch_id: savedBranchId,
                      commit_id: saved.id,
                      repository_view: 'content',
                      document_id: document?.id ?? saved.files[0]?.document_id,
                      folder_id: undefined,
                    })
                  }}
                  onBranchCreated={(created) => {
                    void invalidate()
                    if (ownerRef.current !== scope) return
                    if (edit)
                      setEdits((current) => ({
                        ...current,
                        [`${created.id}:${document?.id ?? ''}`]: {
                          ...edit,
                          baseCommitId: created.head_commit_id,
                          generation: created.generation,
                        },
                      }))
                    onSearchChange({
                      repository_branch_id: created.id,
                      commit_id: undefined,
                      repository_view: 'edit',
                    })
                  }}
                />
              </div>
            )}
          {branch && (
            <div
              hidden={
                !['history', 'compare', 'merges', 'releases'].includes(view)
              }
            >
              <RepositoryHistoryTools
                key={`${projectId}:${branch.id}:${document?.id ?? ''}`}
                projectId={projectId}
                branch={branch}
                branches={branches}
                commitId={commitId}
                documentId={document?.id}
                view={view}
                canManage={canManage && interactive && !branch.import_required}
                canWrite={canWrite && interactive && !branch.import_required}
                compareSelection={compareSelection}
                onCompareSelection={setCompareSelection}
                onOpenCommit={openCommit}
                onChanged={invalidate}
              />
            </div>
          )}
          {commitId && (
            <div hidden={view !== 'ai' && view !== 'events'}>
              <RepositoryAutomation
                key={`${projectId}:${document?.id ?? ''}`}
                projectId={projectId}
                branch={branch}
                commitId={commitId}
                documentId={document?.id}
                fromCommitId={
                  compareSelection.from || commitQuery.data?.parent_ids[0]
                }
                view={view === 'events' ? 'events' : 'ai'}
                active={view === 'ai' || view === 'events'}
                canManage={canManage && interactive}
              />
            </div>
          )}
          {document?.latest_version_id && (
            <Button
              className='w-fit'
              size='sm'
              variant='link'
              onClick={() =>
                onSearchChange({
                  version_id: document.latest_version_id ?? undefined,
                  repository_view: undefined,
                  workspace_view: 'versions',
                  commit_id: undefined,
                  content_mode: 'published',
                })
              }
            >
              <History aria-hidden className='size-4' />
              {copy.legacyLink}
            </Button>
          )}
        </div>
      </main>
    </section>
  )
}

export function RepositoryBranchDialog({
  projectId,
  fromCommitId,
  onCreated,
  label,
}: {
  projectId: string
  fromCommitId: string
  onCreated: (branch: RepositoryBranch) => void
  label?: string
}) {
  const copy = useRepositoryCopy()
  const mutation = useMutation({
    mutationFn: (name: string) =>
      createRepositoryBranch(projectId, { name, from_commit_id: fromCommitId }),
  })
  return (
    <FormDialog
      title={copy.newBranch}
      triggerLabel={label ?? copy.newBranch}
      submitLabel={copy.newBranch}
      pending={mutation.isPending}
      submissionScope={`${projectId}:${fromCommitId}`}
      onSubmit={async (data) =>
        onCreated(
          await mutation.mutateAsync(String(data.get('name') ?? '').trim())
        )
      }
    >
      <TextField name='name' label={copy.branchName} required />
    </FormDialog>
  )
}
