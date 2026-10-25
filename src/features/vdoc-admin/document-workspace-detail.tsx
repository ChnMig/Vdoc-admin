import {
  lazy,
  Suspense,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react'
import {
  BookOpen,
  Bot,
  Clock3,
  GitBranch,
  GitCompareArrows,
  Link2,
  ListTree,
  Settings2,
  SquarePen,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentDTO } from '@/lib/vdoc-api'
import type { VdocRouteSearch } from '@/lib/vdoc-route-search'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DocumentTypeIcon } from './document-type-icon'
import { DocumentWorkspaceContent } from './document-workspace-content'
import { DocumentWorkspaceToolbar } from './document-workspace-toolbar'
import { LoadingErrorState } from './page-shared'
import { useDocumentReadingSelection } from './use-document-reading-selection'
import { WorkspaceEmbedding } from './workspace-embedding'

const DocumentWorkspaceOutline = lazy(() =>
  import('./document-workspace-outline').then((module) => ({
    default: module.DocumentWorkspaceOutline,
  }))
)
const DocumentWorkspaceBranches = lazy(() =>
  import('./document-workspace-branches').then((module) => ({
    default: module.DocumentWorkspaceBranches,
  }))
)
const DocumentWorkspaceShare = lazy(() =>
  import('./document-workspace-share').then((module) => ({
    default: module.DocumentWorkspaceShare,
  }))
)

const DraftsPage = lazy(() =>
  import('./drafts-page').then((module) => ({ default: module.DraftsPage }))
)
const VersionsPage = lazy(() =>
  import('./versions-page').then((module) => ({ default: module.VersionsPage }))
)
const DiffsPage = lazy(() =>
  import('./diffs-page').then((module) => ({ default: module.DiffsPage }))
)
const DocumentsPage = lazy(() =>
  import('./documents-page').then((module) => ({
    default: module.DocumentsPage,
  }))
)
const DocumentWorkspaceAI = lazy(() =>
  import('./document-workspace-ai').then((module) => ({
    default: module.DocumentWorkspaceAI,
  }))
)

export function DocumentWorkspaceDetail({
  projectId,
  document,
  search,
  canManage,
  canWrite,
  interactive,
  onSearchChange,
  navigationActions,
  projectName,
}: {
  projectId: string
  document: DocumentDTO
  search: VdocRouteSearch
  canManage: boolean
  canWrite: boolean
  interactive: boolean
  onSearchChange: (patch: Partial<VdocRouteSearch>, replace?: boolean) => void
  navigationActions?: ReactNode
  projectName?: string
}) {
  const { t } = useLanguage()
  const { selection, branches, branch, versions, drafts, queryStates } =
    useDocumentReadingSelection(projectId, document, search)
  const view = search.workspace_view ?? 'content'
  const section =
    view === 'versions' || view === 'diffs'
      ? 'tools'
      : view === 'manage'
        ? 'manage'
        : view === 'ai'
          ? 'ai'
          : 'content'
  const [shareOpen, setShareOpen] = useState(false)
  const shareTriggerRef = useRef<HTMLButtonElement>(null)
  const [settingsTab, setSettingsTab] = useState('document')
  const [outlineOpen, setOutlineOpen] = useState(false)
  const contentRootRef = useRef<HTMLDivElement>(null)
  const scrollRootRef = useRef<HTMLElement>(null)
  const readingSelectionReady = !selection.pending && !selection.invalid
  const embeddingOwner = JSON.stringify([
    projectId,
    document.id,
    selection.branchId,
    selection.mode,
    selection.version?.id,
    selection.draft?.id,
    search.version_id,
    search.draft_id,
    readingSelectionReady,
    view,
    settingsTab,
  ])
  const activeEmbedding = useRef<string | null>(embeddingOwner)
  useLayoutEffect(() => {
    activeEmbedding.current = embeddingOwner
    return () => {
      activeEmbedding.current = null
    }
  }, [embeddingOwner])
  const contextSearch: VdocRouteSearch = {
    ...search,
    project_id: projectId,
    document_id: document.id,
    branch_id: readingSelectionReady
      ? selection.branchId || undefined
      : search.branch_id,
    version_id: readingSelectionReady
      ? selection.mode === 'published'
        ? selection.version?.id
        : undefined
      : search.version_id,
    draft_id: readingSelectionReady
      ? selection.mode === 'draft'
        ? selection.draft?.id
        : undefined
      : search.draft_id,
  }
  const changeEmbedded =
    (pane: string) => (patch: Partial<VdocRouteSearch>) => {
      if (
        !readingSelectionReady ||
        activeEmbedding.current !== embeddingOwner ||
        view !== pane
      )
        return
      onSearchChange(
        {
          ...patch,
          ...(patch.draft_id
            ? { content_mode: 'draft' as const, version_id: undefined }
            : {}),
          ...(patch.version_id
            ? { content_mode: 'published' as const, draft_id: undefined }
            : {}),
        },
        true
      )
    }
  const changeBranch = (id: string) =>
    onSearchChange({
      branch_id: id || undefined,
      version_id: undefined,
      draft_id: undefined,
      endpoint_id: undefined,
      from_version_id: undefined,
      to_version_id: undefined,
      diff_id: undefined,
      content_mode: selection.mode,
      workspace_view: 'content',
    })
  const editDraft = () =>
    onSearchChange({
      workspace_view: 'drafts',
      content_mode: 'draft',
      version_id: undefined,
      branch_id: selection.branchId || undefined,
      draft_id: selection.mode === 'draft' ? selection.draft?.id : undefined,
    })
  const isReading = view === 'content' || view === 'share'
  const readingKey = `${projectId}:${document.id}:${selection.branchId}:${selection.mode}:${selection.version?.id ?? selection.draft?.id ?? ''}`
  const toolItems: {
    value: 'versions' | 'diffs' | 'ai' | 'manage'
    label: string
    icon: typeof Clock3
  }[] = [
    { value: 'versions', label: t('admin.workspace.versions'), icon: Clock3 },
    {
      value: 'diffs',
      label: t('admin.workspace.diffs'),
      icon: GitCompareArrows,
    },
    { value: 'ai', label: t('admin.workspace.ai'), icon: Bot },
    ...(canManage
      ? [
          {
            value: 'manage' as const,
            label: t('admin.workspace.manage'),
            icon: Settings2,
          },
        ]
      : []),
  ]
  const goToContent = () => onSearchChange({ workspace_view: 'content' })
  const openBranches = () => {
    setSettingsTab('branches')
    onSearchChange({ workspace_view: 'manage' })
  }
  const loading = (
    <p role='status' className='py-6 text-sm text-muted-foreground'>
      {t('admin.common.loading')}
    </p>
  )
  const outline = (
    <Suspense fallback={loading}>
      <DocumentWorkspaceOutline
        contentRootRef={contentRootRef}
        scrollRootRef={scrollRootRef}
        contextKey={readingKey}
      />
    </Suspense>
  )
  return (
    <div
      className='flex h-full min-h-0 min-w-0 flex-col bg-card'
      data-document-page
    >
      <header className='flex min-h-14 shrink-0 items-center justify-between gap-3 border-b px-4 sm:px-6'>
        <div className='flex min-w-0 items-center gap-2.5'>
          {navigationActions}
          <DocumentTypeIcon
            documentType={document.document_type}
            className='shrink-0 text-muted-foreground'
          />
          <div className='min-w-0'>
            <p className='truncate text-sm font-medium' title={document.name}>
              {document.name}
            </p>
            {projectName && (
              <p className='hidden truncate text-xs text-muted-foreground sm:block'>
                {projectName}
              </p>
            )}
          </div>
        </div>
        <div className='flex shrink-0 items-center gap-1.5'>
          <Button
            variant='ghost'
            size='icon'
            className='xl:hidden'
            aria-label={t('admin.workspace.outline')}
            onClick={() => setOutlineOpen(true)}
          >
            <ListTree aria-hidden />
          </Button>
          {canManage && (
            <Button
              variant='outline'
              size='sm'
              ref={shareTriggerRef}
              aria-label={t('admin.workspace.share')}
              onClick={() => setShareOpen(true)}
              disabled={
                selection.pending ||
                selection.invalid ||
                (selection.mode === 'published' && !selection.version)
              }
            >
              <Link2 aria-hidden />
              <span className='hidden sm:inline'>
                {t('admin.workspace.share')}
              </span>
            </Button>
          )}
          {canWrite && (
            <Button
              size='sm'
              onClick={view === 'drafts' ? goToContent : editDraft}
              aria-label={t(
                view === 'drafts'
                  ? 'admin.workspace.backToContent'
                  : 'admin.workspace.editDraft'
              )}
              disabled={!interactive || branch?.status !== 1}
            >
              <SquarePen aria-hidden />
              <span className='hidden sm:inline'>
                {t(
                  view === 'drafts'
                    ? 'admin.workspace.backToContent'
                    : 'admin.workspace.editDraft'
                )}
              </span>
            </Button>
          )}
        </div>
      </header>
      <div className='flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2 sm:px-6'>
        <DocumentWorkspaceToolbar
          selection={selection}
          branches={branches}
          versions={versions}
          drafts={drafts}
          canManage={canManage}
          onBranchChange={changeBranch}
          onModeChange={(mode) =>
            onSearchChange({
              content_mode: mode,
              version_id: undefined,
              draft_id: undefined,
              workspace_view: 'content',
              branch_id: selection.branchId || undefined,
            })
          }
          onRevisionChange={(id) =>
            onSearchChange({
              version_id:
                selection.mode === 'published' ? id || undefined : undefined,
              draft_id:
                selection.mode === 'draft' ? id || undefined : undefined,
              content_mode: selection.mode,
              workspace_view: 'content',
              endpoint_id: undefined,
            })
          }
          onManageBranches={openBranches}
        />
        <nav
          className='flex w-full min-w-0 items-center gap-1 overflow-x-auto xl:hidden'
          aria-label={t('admin.workspace.tools')}
        >
          {toolItems.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant={view === value ? 'secondary' : 'ghost'}
              size='sm'
              className='h-8 gap-1.5 text-xs'
              onClick={() => onSearchChange({ workspace_view: value })}
            >
              <Icon aria-hidden className='size-3.5' />
              {label}
            </Button>
          ))}
        </nav>
      </div>
      <WorkspaceEmbedding>
        <div
          className='grid min-h-0 min-w-0 flex-1 xl:grid-cols-[minmax(0,1fr)_var(--document-aside-width)]'
          style={
            {
              '--document-aside-width': view === 'ai' ? '23rem' : '15rem',
            } as CSSProperties
          }
        >
          <main
            id='content'
            tabIndex={-1}
            ref={scrollRootRef}
            className={cn(
              'min-h-0 min-w-0 overflow-y-auto overscroll-contain focus:outline-none',
              view === 'ai' && 'hidden xl:block'
            )}
          >
            <div
              className={cn(
                'mx-auto min-w-0 px-5 py-8 sm:px-10 sm:py-10',
                isReading || view === 'ai' ? 'max-w-[52rem]' : 'max-w-[82rem]'
              )}
            >
              {queryStates.map((state, index) => (
                <LoadingErrorState
                  key={index}
                  state={{
                    isLoading: false,
                    isError: state.isError,
                    error: state.error,
                  }}
                />
              ))}
              {!isReading && view !== 'ai' && (
                <div className='mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4'>
                  <h1 className='text-lg font-semibold'>
                    {t(
                      view === 'drafts'
                        ? 'admin.workspace.editingDraft'
                        : view === 'manage'
                          ? 'admin.workspace.manage'
                          : view === 'diffs'
                            ? 'admin.workspace.diffs'
                            : 'admin.workspace.versions'
                    )}
                  </h1>
                  <Button variant='ghost' size='sm' onClick={goToContent}>
                    <BookOpen aria-hidden />
                    {t('admin.workspace.backToContent')}
                  </Button>
                </div>
              )}
              <div hidden={!isReading && view !== 'ai'} ref={contentRootRef}>
                <div className='mb-7'>
                  <h1 className='text-[1.75rem] leading-snug font-semibold tracking-[-0.025em] break-words sm:text-[2.125rem]'>
                    {document.name}
                  </h1>
                  <p className='mt-3 text-xs leading-5 break-all text-muted-foreground'>
                    {document.relative_path ?? document.file_name}
                  </p>
                </div>
                <DocumentWorkspaceContent
                  projectId={projectId}
                  document={document}
                  selection={selection}
                  canWrite={canWrite && branch?.status === 1}
                  onEditDraft={editDraft}
                  presentation='page'
                />
              </div>
              <Suspense fallback={loading}>
                <RetainedBody active={view === 'drafts'}>
                  <DraftsPage
                    search={contextSearch}
                    onSearchChange={changeEmbedded('drafts')}
                  />
                </RetainedBody>
                <RetainedBody active={section === 'tools'}>
                  <ReadingTargetGuard
                    pending={selection.pending}
                    invalid={selection.invalid}
                  >
                    <Tabs
                      value={view === 'diffs' ? 'diffs' : 'versions'}
                      onValueChange={(value) =>
                        onSearchChange({
                          workspace_view: value as 'versions' | 'diffs',
                        })
                      }
                      className='min-w-0 gap-5'
                    >
                      <TabsList className='w-fit'>
                        <TabsTrigger value='versions'>
                          {t('admin.workspace.versions')}
                        </TabsTrigger>
                        <TabsTrigger value='diffs'>
                          {t('admin.workspace.diffs')}
                        </TabsTrigger>
                      </TabsList>
                      <RetainedSection
                        value='versions'
                        active={view === 'versions'}
                      >
                        <VersionsPage
                          search={contextSearch}
                          onSearchChange={changeEmbedded('versions')}
                        />
                      </RetainedSection>
                      <RetainedSection value='diffs' active={view === 'diffs'}>
                        <DiffsPage
                          search={contextSearch}
                          onSearchChange={changeEmbedded('diffs')}
                        />
                      </RetainedSection>
                    </Tabs>
                  </ReadingTargetGuard>
                </RetainedBody>
                {canManage && (
                  <RetainedBody active={section === 'manage'}>
                    <Tabs
                      value={settingsTab}
                      onValueChange={setSettingsTab}
                      className='min-w-0 gap-5'
                    >
                      <TabsList className='w-fit'>
                        <TabsTrigger value='document'>
                          {t('admin.workspace.manage')}
                        </TabsTrigger>
                        <TabsTrigger value='branches'>
                          {t('admin.workspace.manageBranches')}
                        </TabsTrigger>
                      </TabsList>
                      <RetainedSection
                        value='document'
                        active={settingsTab === 'document'}
                      >
                        <DocumentsPage
                          search={contextSearch}
                          onSearchChange={changeEmbedded('manage')}
                          workspaceSettings
                        />
                      </RetainedSection>
                      <RetainedSection
                        value='branches'
                        active={settingsTab === 'branches'}
                      >
                        <DocumentWorkspaceBranches
                          projectId={projectId}
                          document={document}
                          canManage={canManage}
                          interactive={interactive}
                          selectedBranchId={selection.branchId}
                          onBranchSelect={changeBranch}
                        />
                      </RetainedSection>
                    </Tabs>
                  </RetainedBody>
                )}
              </Suspense>
            </div>
          </main>
          <aside
            className={cn(
              'min-h-0 min-w-0 flex-col border-s bg-card',
              view === 'ai' ? 'flex' : 'hidden xl:flex'
            )}
            aria-label={t('admin.workspace.documentSidebar')}
          >
            <nav
              className='hidden shrink-0 items-center justify-between gap-1 border-b px-3 py-3 xl:flex'
              aria-label={t('admin.workspace.tools')}
            >
              <Button
                variant={isReading ? 'secondary' : 'ghost'}
                size='icon'
                className='size-8'
                title={t('admin.workspace.outline')}
                aria-label={t('admin.workspace.outline')}
                onClick={goToContent}
              >
                <ListTree aria-hidden className='size-4' />
              </Button>
              {toolItems.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant={view === value ? 'secondary' : 'ghost'}
                  size='icon'
                  className='size-8'
                  title={label}
                  aria-label={label}
                  onClick={() => onSearchChange({ workspace_view: value })}
                >
                  <Icon aria-hidden className='size-4' />
                </Button>
              ))}
            </nav>
            <div className='min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5'>
              <div hidden={view === 'ai'}>
                {isReading ? (
                  !outlineOpen && outline
                ) : (
                  <div className='grid gap-2'>
                    <p className='mb-2 text-xs font-medium text-muted-foreground'>
                      {t('admin.workspace.tools')}
                    </p>
                    {toolItems.map(({ value, label, icon: Icon }) => (
                      <Button
                        key={value}
                        variant={view === value ? 'secondary' : 'ghost'}
                        className='justify-start'
                        onClick={() =>
                          onSearchChange({ workspace_view: value })
                        }
                      >
                        <Icon aria-hidden />
                        {label}
                      </Button>
                    ))}
                    {canManage && (
                      <Button
                        variant='ghost'
                        className='justify-start'
                        onClick={openBranches}
                      >
                        <GitBranch aria-hidden />
                        {t('admin.workspace.manageBranches')}
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <Suspense fallback={loading}>
                <RetainedBody active={view === 'ai'}>
                  <div className='mb-5 flex items-center justify-between gap-2'>
                    <h2 className='text-sm font-semibold'>
                      {t('admin.workspace.ai')}
                    </h2>
                    <Button
                      variant='ghost'
                      size='icon'
                      className='size-7'
                      aria-label={t('admin.workspace.backToContent')}
                      onClick={goToContent}
                    >
                      <X aria-hidden className='size-4' />
                    </Button>
                  </div>
                  <DocumentWorkspaceAI
                    projectId={projectId}
                    document={document}
                    selection={selection}
                    interactive={interactive && branch?.status === 1}
                    canRegenerate={canWrite && branch?.status === 1}
                  />
                </RetainedBody>
              </Suspense>
            </div>
          </aside>
        </div>
      </WorkspaceEmbedding>
      <Dialog open={outlineOpen} onOpenChange={setOutlineOpen}>
        <DialogContent className='max-h-[85svh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{t('admin.workspace.outline')}</DialogTitle>
            <DialogDescription>{document.name}</DialogDescription>
          </DialogHeader>
          {outlineOpen && (
            <Suspense fallback={loading}>
              <DocumentWorkspaceOutline
                contentRootRef={contentRootRef}
                scrollRootRef={scrollRootRef}
                contextKey={readingKey}
                onNavigate={() => setOutlineOpen(false)}
              />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={shareOpen || view === 'share'}
        onOpenChange={(open) => {
          setShareOpen(open)
          if (!open && view === 'share')
            onSearchChange({ workspace_view: 'content' }, true)
        }}
      >
        <DialogContent
          className='max-h-[90svh] overflow-y-auto sm:max-w-3xl'
          onCloseAutoFocus={(event) => {
            if (shareTriggerRef.current) {
              event.preventDefault()
              shareTriggerRef.current.focus()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t('admin.workspace.share')} · {document.name}
            </DialogTitle>
            <DialogDescription>
              {t('admin.workspace.shareContextDescription')}
            </DialogDescription>
          </DialogHeader>
          {(shareOpen || view === 'share') && (
            <Suspense fallback={loading}>
              <DocumentWorkspaceShare
                embedded
                projectId={projectId}
                document={document}
                canManage={canManage}
                interactive={
                  interactive && branch?.status === 1 && !selection.invalid
                }
                selectedBranchId={selection.branchId || undefined}
                selectedVersionId={
                  selection.mode === 'published'
                    ? (selection.version?.id ?? null)
                    : null
                }
              />
            </Suspense>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ReadingTargetGuard({
  pending,
  invalid,
  children,
}: {
  pending?: boolean
  invalid?: boolean
  children: ReactNode
}) {
  const { t } = useLanguage()
  return pending || invalid ? (
    <p role='status' className='py-5 text-sm text-muted-foreground'>
      {t(
        pending ? 'admin.common.loading' : 'admin.workspace.readerUnavailable'
      )}
    </p>
  ) : (
    children
  )
}
function RetainedBody({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  const [visited, setVisited] = useState(active)
  if (active && !visited) setVisited(true)
  if (!active && !visited) return null
  return (
    <div hidden={!active} className='min-w-0'>
      {children}
    </div>
  )
}
function RetainedSection({
  value,
  active,
  children,
}: {
  value: string
  active: boolean
  children: ReactNode
}) {
  const [visited, setVisited] = useState(active)
  if (active && !visited) setVisited(true)
  if (!active && !visited) return null
  return (
    <TabsContent value={value} forceMount hidden={!active} className='min-w-0'>
      {children}
    </TabsContent>
  )
}
