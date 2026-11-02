import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  Bot,
  GitCompareArrows,
  GitMerge,
  ListTree,
  MoreHorizontal,
  Send,
  SquarePen,
  GitCommitHorizontal,
  History,
  LockKeyhole,
  RefreshCw,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import {
  listRepositoryCommits,
  repositoryScopeKey,
  type RepositoryScope,
  bootstrapRepository,
  createRepositoryBranch,
  getRepositoryContent,
  repositoryKeys,
  type RepositoryBranch,
  type RepositoryCommit,
} from '@/lib/repository-api'
import type { DocumentDTO } from '@/lib/vdoc-api'
import type { VdocRouteSearch } from '@/lib/vdoc-route-search'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { RepositoryLink } from '@/components/repository-link'
import {
  DocumentReader,
  DocumentReadingPreferences,
} from '@/features/document-reader/document-reader'
import { useWideDocumentLayout } from './document-layout-hooks'
import { DocumentToolSidebar } from './document-tool-sidebar'
import { DocumentTypeIcon } from './document-type-icon'
import { DocumentWorkspaceOutline } from './document-workspace-outline'
import {
  FormDialog,
  LoadingErrorState,
  NativeSelect,
  TextField,
} from './page-shared'
import { RepositoryAutomation } from './repository-automation'
import { useRepositoryCopy } from './repository-copy'
import { RepositoryDocumentAI } from './repository-document-ai'
import { RepositoryEditor, type RepositoryEdit } from './repository-editor'
import { RepositoryHistoryTools } from './repository-history-tools'
import { RepositoryDocumentShareDialog } from './repository-share-dialog'
import { useRepositorySnapshot } from './use-repository-snapshot'

export type RepositoryView = NonNullable<VdocRouteSearch['repository_view']>

export function RepositoryWorkspace({
  projectId,
  projectName,
  document,
  search,
  canManage,
  canWrite,
  interactive,
  navigationActions,
  onSearchChange,
}: {
  projectId: string
  projectName?: string
  document?: DocumentDTO & { default_branch_id?: string }
  legacyDocuments: DocumentDTO[]
  search: VdocRouteSearch
  canManage: boolean
  canWrite: boolean
  interactive: boolean
  navigationActions?: ReactNode
  onSearchChange: (patch: Partial<VdocRouteSearch>, replace?: boolean) => void
}) {
  const { t, language } = useLanguage()
  const copy = useRepositoryCopy()
  const queryClient = useQueryClient()
  const {
    repositoryScope,
    branchesQuery,
    branches,
    branch,
    commitId,
    commitQuery,
  } = useRepositorySnapshot(
    projectId,
    { ...search, document_id: document?.id },
    true,
    document?.default_branch_id
  )
  const requestedView = search.repository_view ?? 'content'
  const [view, setMainView] = useState<'content' | 'edit'>(
    requestedView === 'edit' ? 'edit' : 'content'
  )
  const [tool, setTool] = useState<RepositoryView | 'outline'>(
    requestedView === 'content' || requestedView === 'edit'
      ? 'outline'
      : requestedView
  )
  const [sidebarOpen, setSidebarOpen] = useState<boolean | undefined>(
    requestedView === 'content' || requestedView === 'edit' ? undefined : true
  )
  const [expanded, setExpanded] = useState(false)
  const [previousRequestedView, setPreviousRequestedView] =
    useState(requestedView)
  if (requestedView !== previousRequestedView) {
    setPreviousRequestedView(requestedView)
    if (requestedView === 'content' || requestedView === 'edit')
      setMainView(requestedView)
    else {
      setTool(requestedView)
      setSidebarOpen(true)
    }
  }
  const wideLayout = useWideDocumentLayout()
  const sidebarVisible = sidebarOpen ?? wideLayout
  const sidebarOverlay = expanded || !wideLayout
  const toolTriggerRef = useRef<HTMLButtonElement>(null)
  const contentRootRef = useRef<HTMLDivElement>(null)
  const scrollRootRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const restoreReadingFocus = useRef(false)
  useLayoutEffect(() => {
    if (view === 'content' && restoreReadingFocus.current) {
      mainRef.current?.focus({ preventScroll: true })
      restoreReadingFocus.current = false
    }
  }, [view])
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
  const [comparisonScopes, setComparisonScopes] = useState<
    Record<string, { from: string; to: string }>
  >({})
  const comparisonScope = `${projectId}:${document?.id ?? ''}`
  const compareSelection = comparisonScopes[comparisonScope] ?? {
    from: '',
    to: '',
  }
  const setCompareSelection = (value: { from: string; to: string }) =>
    setComparisonScopes((current) => ({ ...current, [comparisonScope]: value }))
  const versionsQuery = useQuery({
    queryKey: [...repositoryKeys.all(repositoryScope), 'versions', branch?.id],
    queryFn: ({ signal }) =>
      listRepositoryCommits(repositoryScope, { branch_id: branch!.id }, signal),
    enabled: Boolean(branch),
  })
  const versions = versionsQuery.data?.items ?? []

  const file = commitQuery.data?.files.find(
    (item) => item.document_id === document?.id
  )
  const contentQuery = useQuery({
    queryKey: [
      ...repositoryKeys.all(repositoryScope),
      'content',
      commitId,
      document?.id,
    ],
    queryFn: ({ signal }) =>
      getRepositoryContent(repositoryScope, commitId, document!.id, signal),
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
    mutationFn: () => bootstrapRepository(repositoryScope),
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
    setTool('outline')
    setSidebarOpen(wideLayout)
    setExpanded(false)
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
    setExpanded(false)
    if (!wideLayout) setSidebarOpen(false)
    onSearchChange({ commit_id: undefined, repository_view: 'edit' })
  }
  const isReading = view === 'content'
  const readingKey = `${sessionVersion}:${projectId}:${document?.id ?? ''}:${branch?.id ?? ''}:${commitId}`
  const goToContent = () => {
    setExpanded(false)
    if (!wideLayout) setSidebarOpen(false)
    restoreReadingFocus.current = true
    setView('content')
  }
  const closeSidebar = () => {
    setSidebarOpen(false)
    setExpanded(false)
    if (requestedView !== 'content' && requestedView !== 'edit')
      onSearchChange({ repository_view: view }, true)
  }
  const toolItems = [
    { id: 'history' as const, label: copy.history, icon: History },
    { id: 'compare' as const, label: copy.compare, icon: GitCompareArrows },
    { id: 'ai' as const, label: copy.ai, icon: Bot },
    { id: 'merges' as const, label: copy.merges, icon: GitMerge },
    { id: 'releases' as const, label: copy.releases, icon: Send },
    { id: 'events' as const, label: copy.events, icon: History },
  ]
  const activateTool = (next: RepositoryView | 'outline') => {
    setTool(next)
    setSidebarOpen(true)
    if (next !== 'outline') setView(next)
    else onSearchChange({ repository_view: view }, true)
  }
  return (
    <section
      className='flex h-full min-h-0 min-w-0 flex-col bg-card'
      data-document-page
      aria-label={projectName}
    >
      <header className='flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-2 sm:px-6'>
        <div className='flex max-w-full min-w-0 items-center gap-2.5'>
          {navigationActions}
          {document && (
            <DocumentTypeIcon
              documentType={document.document_type}
              className='shrink-0 text-muted-foreground'
            />
          )}
          <div className='min-w-0'>
            <p
              className='truncate text-sm font-medium'
              title={document?.name ?? projectName}
            >
              {document?.name ?? projectName}
            </p>
            {projectName && (
              <p className='hidden truncate text-xs text-muted-foreground sm:block'>
                {projectName}
              </p>
            )}
          </div>
        </div>
        <div className='ms-auto flex shrink-0 items-center gap-1.5'>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='xl:hidden'
                aria-label={t('admin.workspace.tools')}
                ref={!wideLayout ? toolTriggerRef : undefined}
              >
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align='end'
              onCloseAutoFocus={(event) => {
                if (!wideLayout && sidebarVisible) {
                  event.preventDefault()
                  requestAnimationFrame(() =>
                    globalThis.document
                      .querySelector<HTMLElement>('.document-tool-sidebar')
                      ?.focus({ preventScroll: true })
                  )
                }
              }}
            >
              <DropdownMenuItem
                onSelect={() => {
                  activateTool('outline')
                }}
              >
                <ListTree aria-hidden />
                {t('admin.workspace.outline')}
              </DropdownMenuItem>
              {toolItems.map(({ id, label, icon: Icon }) => (
                <DropdownMenuItem key={id} onSelect={() => activateTool(id)}>
                  <Icon aria-hidden />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {canManage && document && (
            <RepositoryDocumentShareDialog
              key={`${sessionVersion}:${repositoryScopeKey(repositoryScope)}:${commitId}`}
              projectId={repositoryScope}
              documentId={document.id}
              commitId={commitId}
              versionName={commitQuery.data?.version_name}
              disabled={!interactive || !commitId || !commitQuery.isSuccess}
              onPublish={() => setView('releases')}
            />
          )}
          {canWrite && (
            <Button
              size='sm'
              aria-label={
                view === 'edit' ? t('admin.workspace.backToContent') : copy.edit
              }
              disabled={!interactive || !branch}
              onClick={view === 'edit' ? goToContent : startEditing}
            >
              {view === 'edit' ? (
                <BookOpen aria-hidden />
              ) : (
                <SquarePen aria-hidden />
              )}
              <span className='hidden sm:inline'>
                {view === 'edit'
                  ? t('admin.workspace.backToContent')
                  : copy.edit}
              </span>
            </Button>
          )}
          <DocumentReadingPreferences />
          <RepositoryLink />
        </div>
      </header>
      <div className='grid shrink-0 grid-cols-2 items-end gap-x-4 gap-y-2 border-b px-4 py-2 sm:grid-cols-[minmax(8rem,12rem)_minmax(10rem,16rem)_minmax(0,1fr)] sm:px-6'>
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
        <NativeSelect
          label={copy.version}
          placeholder={copy.version}
          value={search.commit_id ?? 'latest'}
          options={[
            {
              value: 'latest',
              label: `${copy.latest}${versions[0]?.version_name ? ` · ${versions[0].version_name}` : ''}`,
            },
            ...versions.map((item) => ({
              value: item.id,
              label: item.version_name || item.id.slice(0, 12),
            })),
            ...(search.commit_id &&
            !versions.some((item) => item.id === search.commit_id)
              ? [
                  {
                    value: search.commit_id,
                    label:
                      commitQuery.data?.version_name ||
                      search.commit_id.slice(0, 12),
                  },
                ]
              : []),
          ]}
          disabled={!branch || versionsQuery.isPending}
          onChange={(value) =>
            onSearchChange({
              commit_id: value === 'latest' ? undefined : value,
              repository_view: 'content',
            })
          }
        />
        <div className='col-span-2 flex min-h-9 min-w-0 flex-wrap items-center gap-2 text-xs sm:col-span-1'>
          {branch?.is_protected && (
            <Badge variant='outline'>
              <LockKeyhole aria-hidden className='me-1 size-3' />
              {copy.protectedBranch}
            </Badge>
          )}
          {search.commit_id && search.commit_id !== branch?.head_commit_id && (
            <Button
              variant='link'
              size='sm'
              className='h-auto p-0 text-xs'
              onClick={() => onSearchChange({ commit_id: undefined })}
            >
              {copy.latest}
            </Button>
          )}
          {edit?.dirty && (
            <span role='status' className='text-muted-foreground'>
              {copy.unsaved}
            </span>
          )}
          {canWrite && interactive && branch && !branch.import_required && (
            <RepositoryBranchDialog
              compact
              projectId={repositoryScope}
              fromCommitId={commitId}
              onCreated={(created) => {
                void invalidate()
                if (ownerRef.current === scope) branchChanged(created.id)
              }}
            />
          )}
          <Button
            variant='ghost'
            size='icon'
            className='size-8'
            onClick={() => void invalidate()}
            aria-label={copy.refresh}
            title={copy.refresh}
          >
            <RefreshCw aria-hidden className='size-4' />
          </Button>
        </div>
      </div>
      <div
        className='document-workspace-layout repository-document-layout relative grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_var(--document-aside-width)_3rem]'
        data-tool={tool}
        data-sidebar-open={sidebarVisible || undefined}
        style={
          {
            '--document-aside-width': sidebarVisible
              ? tool === 'outline'
                ? '15rem'
                : '24rem'
              : '0rem',
            '--document-tool-width': tool === 'outline' ? '15rem' : '24rem',
          } as CSSProperties
        }
      >
        <main
          id='content'
          inert={sidebarVisible && sidebarOverlay}
          ref={mainRef}
          tabIndex={-1}
          className='relative flex min-h-0 min-w-0 flex-col focus:outline-none'
        >
          <div className='empty:hidden'>
            <LoadingErrorState state={branchesQuery} />
            <LoadingErrorState state={commitQuery} />
            {search.repository_branch_id &&
              branchesQuery.isSuccess &&
              !branch && (
                <Alert variant='destructive'>
                  <AlertDescription>{copy.unavailable}</AlertDescription>
                </Alert>
              )}
            {branch?.import_required && (
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
          </div>
          <div
            ref={scrollRootRef}
            hidden={!isReading}
            data-document-reading-pane
            data-pane-active={isReading || undefined}
            className='document-pane-transition min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain'
          >
            <div
              className='mx-auto max-w-[52rem] min-w-0 px-5 py-8 sm:px-10 sm:py-10'
              ref={contentRootRef}
            >
              {commitQuery.isSuccess && (
                <div hidden={view !== 'content'}>
                  {search.commit_id &&
                    search.commit_id !== branch?.head_commit_id && (
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
                            documentType={
                              contentQuery.data.document.document_type
                            }
                            content={contentQuery.data.content}
                            metadata={
                              <details className='text-xs text-muted-foreground'>
                                <summary className='w-fit cursor-pointer leading-6'>
                                  {language === 'zh-CN'
                                    ? '版本说明'
                                    : 'Version details'}{' '}
                                  · {commitQuery.data?.version_name}
                                </summary>
                                <p className='mt-2 break-words'>
                                  {commitQuery.data?.message}
                                </p>
                              </details>
                            }
                          />
                        )
                      ) : (
                        <div className='grid gap-3 py-10'>
                          <h1 className='text-xl font-semibold'>
                            {document.name}
                          </h1>
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
            </div>
          </div>
          <RepositoryToolPane
            active={view === 'edit'}
            onClose={goToContent}
            backButton={false}
          >
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
                    projectId={repositoryScope}
                    branch={branch}
                    document={document}
                    baseCommitId={commitId}
                    files={commitQuery.data?.files ?? []}
                    content={contentQuery.data}
                    contentPending={Boolean(file && contentQuery.isPending)}
                    initialEdit={edit}
                    canWrite={
                      canWrite && interactive && !branch.import_required
                    }
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
                        repositoryKeys.commit(repositoryScope, saved.id),
                        saved
                      )
                      await invalidate()
                      if (ownerRef.current !== scope) return
                      onSearchChange({
                        repository_branch_id: savedBranchId,
                        commit_id: saved.id,
                        repository_view: 'content',
                        document_id:
                          document?.id ?? saved.files[0]?.document_id,
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
          </RepositoryToolPane>
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
        </main>
        <DocumentToolSidebar
          open={sidebarVisible}
          expanded={expanded}
          overlay={sidebarOverlay}
          title={
            tool === 'outline'
              ? t('admin.workspace.outline')
              : (toolItems.find((item) => item.id === tool)?.label ?? copy.ai)
          }
          onExpand={() => setExpanded((value) => !value)}
          onClose={closeSidebar}
          triggerRef={toolTriggerRef}
        >
          <RepositoryToolPane
            active={sidebarVisible && tool === 'outline'}
            onClose={closeSidebar}
            sidebar
          >
            <DocumentWorkspaceOutline
              contentRootRef={contentRootRef}
              scrollRootRef={scrollRootRef}
              contextKey={readingKey}
              showTitle={false}
              onNavigate={!wideLayout ? closeSidebar : undefined}
            />
          </RepositoryToolPane>
          {(['history', 'compare', 'merges', 'releases'] as const).map(
            (pane) => (
              <RepositoryToolPane
                key={`${projectId}:${branch?.id}:${document?.id ?? ''}:${pane}`}
                active={sidebarVisible && tool === pane}
                onClose={closeSidebar}
                sidebar
              >
                {branch && (
                  <RepositoryHistoryTools
                    projectId={repositoryScope}
                    branch={branch}
                    branches={branches}
                    commitId={commitId}
                    documentId={document?.id}
                    view={pane}
                    presentation='sidebar'
                    active={sidebarVisible && tool === pane}
                    canManage={
                      canManage && interactive && !branch.import_required
                    }
                    canWrite={
                      canWrite && interactive && !branch.import_required
                    }
                    compareSelection={compareSelection}
                    onCompareSelection={setCompareSelection}
                    onOpenCommit={openCommit}
                    onChanged={invalidate}
                  />
                )}
              </RepositoryToolPane>
            )
          )}
          <RepositoryToolPane
            key={`${projectId}:${document?.id ?? ''}:events`}
            active={sidebarVisible && tool === 'events'}
            onClose={closeSidebar}
            sidebar
          >
            {commitId && (
              <RepositoryAutomation
                projectId={repositoryScope}
                branch={branch}
                commitId={commitId}
                documentId={document?.id}
                view='events'
                active={sidebarVisible && tool === 'events'}
                canManage={canManage && interactive}
              />
            )}
          </RepositoryToolPane>
          <RepositoryToolPane
            active={sidebarVisible && tool === 'ai'}
            onClose={closeSidebar}
            sidebar
            fill
          >
            <RepositoryDocumentAI
              project={projectId}
              projectId={repositoryScope}
              branch={branch}
              commitId={commitId}
              documentId={document?.id}
              fromCommitId={
                compareSelection.from || commitQuery.data?.parent_ids[0]
              }
              versionName={commitQuery.data?.version_name}
              active={sidebarVisible && tool === 'ai'}
              canManage={canManage && interactive}
              interactive={interactive}
            />
          </RepositoryToolPane>
        </DocumentToolSidebar>
        <nav
          className='hidden min-h-0 flex-col items-center gap-2 overflow-y-auto border-s bg-card px-1 py-4 xl:col-start-3 xl:flex'
          aria-label={t('admin.workspace.tools')}
        >
          <Button
            variant={
              sidebarVisible && tool === 'outline' ? 'secondary' : 'ghost'
            }
            size='icon'
            className='size-9 shrink-0'
            title={t('admin.workspace.outline')}
            aria-label={t('admin.workspace.outline')}
            aria-pressed={sidebarVisible && tool === 'outline'}
            ref={tool === 'outline' && wideLayout ? toolTriggerRef : undefined}
            onClick={() => {
              activateTool('outline')
            }}
          >
            <ListTree aria-hidden className='size-4' />
          </Button>
          {toolItems.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant={sidebarVisible && tool === id ? 'secondary' : 'ghost'}
              size='icon'
              className='size-9 shrink-0'
              title={label}
              aria-label={label}
              aria-pressed={sidebarVisible && tool === id}
              ref={id === tool && wideLayout ? toolTriggerRef : undefined}
              onClick={() => activateTool(id)}
            >
              <Icon aria-hidden className='size-4' />
            </Button>
          ))}
        </nav>
      </div>
    </section>
  )
}

export function RepositoryBranchDialog({
  projectId,
  fromCommitId,
  onCreated,
  label,
  compact = false,
}: {
  projectId: RepositoryScope
  fromCommitId: string
  onCreated: (branch: RepositoryBranch) => void
  label?: string
  compact?: boolean
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
      triggerVariant={compact ? 'ghost' : 'default'}
      triggerSize={compact ? 'sm' : 'default'}
      submitLabel={copy.newBranch}
      pending={mutation.isPending}
      submissionScope={`${repositoryScopeKey(projectId)}:${fromCommitId}`}
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

function RepositoryToolPane({
  active,
  onClose,
  backButton = true,
  sidebar = false,
  fill = false,
  children,
}: {
  active: boolean
  onClose: () => void
  backButton?: boolean
  sidebar?: boolean
  fill?: boolean
  children: ReactNode
}) {
  const { t } = useLanguage()
  const [visited, setVisited] = useState(active)
  if (active && !visited) setVisited(true)
  if (!visited) return null
  return (
    <section
      hidden={!active}
      data-document-tool-pane
      data-pane-active={active || undefined}
      className={`min-h-0 min-w-0 flex-1 ${fill ? 'flex flex-col overflow-hidden' : 'overflow-y-auto overscroll-contain'}`}
    >
      <div
        className={
          fill
            ? 'h-full min-h-0 min-w-0'
            : sidebar
              ? 'min-w-0 p-4'
              : 'mx-auto max-w-[82rem] min-w-0 px-5 py-6 sm:px-10 sm:py-8'
        }
      >
        {backButton && !sidebar && (
          <div className='mb-5 flex justify-end border-b pb-3'>
            <Button variant='ghost' size='sm' onClick={onClose}>
              <BookOpen aria-hidden />
              {t('admin.workspace.backToContent')}
            </Button>
          </div>
        )}
        {children}
      </div>
    </section>
  )
}
