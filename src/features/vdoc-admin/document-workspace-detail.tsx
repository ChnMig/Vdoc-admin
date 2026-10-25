import {
  lazy,
  Suspense,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type CSSProperties,
} from 'react'
import {
  BookOpen,
  Bot,
  Clock3,
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
  const requestedView = search.workspace_view ?? 'content'
  const view = requestedView === 'ai' ? 'content' : requestedView
  const [assistantOpen, setAssistantOpen] = useState(requestedView === 'ai')
  const [assistantVisited, setAssistantVisited] = useState(assistantOpen)
  if (assistantOpen && !assistantVisited) setAssistantVisited(true)
  const [previousRequestedView, setPreviousRequestedView] =
    useState(requestedView)
  if (requestedView !== previousRequestedView) {
    setPreviousRequestedView(requestedView)
    if (requestedView === 'ai') setAssistantOpen(true)
  }
  const wideLayout = useWideDocumentLayout()
  const [shareOpen, setShareOpen] = useState(false)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const externalModalOpen = useExternalDocumentModal()
  const assistantPresented =
    assistantOpen &&
    (wideLayout ||
      !(
        externalModalOpen ||
        shareOpen ||
        requestedView === 'share' ||
        outlineOpen
      ))
  const assistantRef = useRef<HTMLDialogElement>(null)
  const assistantTriggerRef = useRef<HTMLButtonElement>(null)
  const restoreAssistantFocus = useRef(false)
  const assistantTitleId = useId()
  useLayoutEffect(() => {
    const panel = assistantRef.current
    if (!panel) return
    if (!assistantPresented || (!wideLayout && hasExternalDocumentModal())) {
      if (panel.open) panel.close()
      if (restoreAssistantFocus.current) {
        assistantTriggerRef.current?.focus({ preventScroll: true })
        restoreAssistantFocus.current = false
      }
      return
    }
    const focused = panel.contains(globalThis.document.activeElement)
      ? (globalThis.document.activeElement as HTMLElement)
      : null
    // Changing modal presentation retains the same dialog and AI subtree.
    if (panel.open) panel.close()
    if (wideLayout) panel.show()
    else panel.showModal()
    focused?.focus({ preventScroll: true })
  }, [assistantPresented, wideLayout])
  const shareTriggerRef = useRef<HTMLButtonElement>(null)
  const [settingsTab, setSettingsTab] = useState('document')
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
        (!readingSelectionReady && pane !== 'versions' && pane !== 'diffs') ||
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
  const goToContent = () => {
    restoreReadingFocus.current = true
    onSearchChange({ workspace_view: 'content' })
  }
  const closeAssistant = () => {
    restoreAssistantFocus.current = true
    setAssistantOpen(false)
    if (requestedView === 'ai')
      onSearchChange({ workspace_view: 'content' }, true)
  }
  const activateTool = (value: 'versions' | 'diffs' | 'ai' | 'manage') => {
    if (value === 'ai') {
      if (assistantOpen) closeAssistant()
      else setAssistantOpen(true)
      return
    }
    onSearchChange({ workspace_view: value })
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
        />
        <nav
          className='flex w-full min-w-0 items-center gap-1 overflow-x-auto xl:hidden'
          aria-label={t('admin.workspace.tools')}
        >
          {toolItems.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant={
                (value === 'ai' ? assistantOpen : view === value)
                  ? 'secondary'
                  : 'ghost'
              }
              size='sm'
              className='h-8 gap-1.5 text-xs'
              onClick={() => activateTool(value)}
              aria-pressed={value === 'ai' ? assistantOpen : view === value}
              ref={
                value === 'ai' && !wideLayout ? assistantTriggerRef : undefined
              }
            >
              <Icon aria-hidden className='size-3.5' />
              {label}
            </Button>
          ))}
        </nav>
      </div>
      <WorkspaceEmbedding>
        <div
          className='document-workspace-layout grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_var(--document-aside-width)_3rem]'
          data-ai-open={assistantOpen || undefined}
          style={
            {
              '--document-aside-width': assistantOpen
                ? '23rem'
                : isReading
                  ? '15rem'
                  : '0rem',
            } as CSSProperties
          }
        >
          <main
            id='content'
            ref={mainRef}
            tabIndex={-1}
            className='relative flex min-h-0 min-w-0 flex-col focus:outline-none'
          >
            <div
              hidden={!isReading}
              ref={scrollRootRef}
              data-document-reading-pane
              data-pane-active={isReading || undefined}
              className='document-pane-transition min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain'
            >
              <div className='mx-auto max-w-[52rem] min-w-0 px-5 py-8 sm:px-10 sm:py-10'>
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
                <div ref={contentRootRef}>
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
              </div>
            </div>
            <RetainedPane
              active={view === 'drafts'}
              title={t('admin.workspace.editingDraft')}
              onClose={goToContent}
            >
              <DraftsPage
                search={contextSearch}
                onSearchChange={changeEmbedded('drafts')}
              />
            </RetainedPane>
            <RetainedPane
              active={view === 'versions'}
              title={t('admin.workspace.versions')}
              onClose={goToContent}
            >
              <VersionsPage
                presentation='history'
                search={contextSearch}
                onSearchChange={changeEmbedded('versions')}
              />
            </RetainedPane>
            <RetainedPane
              active={view === 'diffs'}
              title={t('admin.workspace.diffs')}
              onClose={goToContent}
            >
              <DiffsPage
                search={contextSearch}
                onSearchChange={changeEmbedded('diffs')}
              />
            </RetainedPane>
            {canManage && (
              <RetainedPane
                active={view === 'manage'}
                title={t('admin.workspace.manage')}
                onClose={goToContent}
              >
                <Tabs
                  value={settingsTab}
                  onValueChange={setSettingsTab}
                  className='min-w-0 gap-5'
                >
                  <TabsList className='w-fit'>
                    <TabsTrigger value='document'>
                      {t('admin.workspace.documentDetails')}
                    </TabsTrigger>
                    <TabsTrigger value='branches'>
                      {t('admin.sections.branches')}
                    </TabsTrigger>
                  </TabsList>
                  <RetainedSection
                    value='document'
                    active={settingsTab === 'document'}
                  >
                    <Suspense fallback={<ToolSkeleton />}>
                      <DocumentsPage
                        search={contextSearch}
                        onSearchChange={changeEmbedded('manage')}
                        workspaceSettings
                      />
                    </Suspense>
                  </RetainedSection>
                  <RetainedSection
                    value='branches'
                    active={settingsTab === 'branches'}
                  >
                    <Suspense fallback={<ToolSkeleton />}>
                      <DocumentWorkspaceBranches
                        projectId={projectId}
                        document={document}
                        canManage={canManage}
                        interactive={interactive}
                        selectedBranchId={selection.branchId}
                        onBranchSelect={changeBranch}
                      />
                    </Suspense>
                  </RetainedSection>
                </Tabs>
              </RetainedPane>
            )}
          </main>
          <div className='document-assistant-dock contents min-h-0 min-w-0 xl:block xl:border-s'>
            <aside
              hidden={assistantOpen || !isReading}
              className={cn(
                'h-full min-h-0 min-w-0 flex-col bg-card',
                assistantOpen || !isReading ? 'hidden' : 'hidden xl:flex'
              )}
              aria-label={t('admin.workspace.outline')}
            >
              <div className='border-b px-5 py-4 text-xs font-medium text-muted-foreground'>
                {t('admin.workspace.outline')}
              </div>
              <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5'>
                {!outlineOpen && outline}
              </div>
            </aside>
            <dialog
              ref={assistantRef}
              inert={!assistantPresented}
              className='document-assistant-panel bg-card text-foreground'
              aria-labelledby={assistantTitleId}
              aria-modal={assistantPresented && !wideLayout ? true : undefined}
              onKeyDown={(event) => {
                if (
                  !wideLayout &&
                  event.key === 'Tab' &&
                  !event.defaultPrevented
                ) {
                  const focusable = Array.from(
                    event.currentTarget.querySelectorAll<HTMLElement>(
                      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                    )
                  ).filter(
                    (element) =>
                      !element.matches(':disabled') &&
                      !element.closest(
                        '[hidden], [inert], [aria-hidden="true"]'
                      ) &&
                      element.getClientRects().length > 0
                  )
                  const first = focusable[0]
                  const last = focusable[focusable.length - 1]
                  const active = globalThis.document.activeElement
                  if (
                    event.shiftKey &&
                    (active === first || active === event.currentTarget)
                  ) {
                    event.preventDefault()
                    last?.focus()
                  } else if (!event.shiftKey && active === last) {
                    event.preventDefault()
                    first?.focus()
                  }
                }
                if (
                  wideLayout &&
                  event.key === 'Escape' &&
                  !event.defaultPrevented
                ) {
                  event.preventDefault()
                  closeAssistant()
                }
              }}
              onCancel={(event) => {
                event.preventDefault()
                closeAssistant()
              }}
              onClick={(event) => {
                if (wideLayout || event.target !== event.currentTarget) return
                const bounds = event.currentTarget.getBoundingClientRect()
                if (
                  event.clientX < bounds.left ||
                  event.clientX > bounds.right ||
                  event.clientY < bounds.top ||
                  event.clientY > bounds.bottom
                )
                  closeAssistant()
              }}
            >
              <div className='flex h-full min-h-0 min-w-0 flex-col'>
                <div className='flex shrink-0 items-center justify-between gap-2 border-b px-5 py-3'>
                  <h2
                    id={assistantTitleId}
                    className='flex items-center gap-2 text-sm font-semibold'
                  >
                    <Bot aria-hidden className='size-4 text-primary' />
                    {t('admin.workspace.ai')}
                  </h2>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='size-8'
                    aria-label={t('admin.workspace.closeAssistant')}
                    onClick={closeAssistant}
                  >
                    <X aria-hidden className='size-4' />
                  </Button>
                </div>
                <div className='min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-5'>
                  {assistantVisited && (
                    <Suspense fallback={<ToolSkeleton />}>
                      <DocumentWorkspaceAI
                        projectId={projectId}
                        document={document}
                        selection={selection}
                        interactive={interactive && branch?.status === 1}
                        canRegenerate={canWrite && branch?.status === 1}
                      />
                    </Suspense>
                  )}
                </div>
              </div>
            </dialog>
          </div>
          <nav
            className='hidden min-h-0 flex-col items-center gap-2 border-s bg-card px-1 py-4 xl:flex'
            aria-label={t('admin.workspace.tools')}
          >
            <Button
              variant={isReading && !assistantOpen ? 'secondary' : 'ghost'}
              size='icon'
              className='size-9'
              title={t('admin.workspace.outline')}
              aria-label={t('admin.workspace.outline')}
              aria-pressed={isReading && !assistantOpen}
              onClick={() => {
                setAssistantOpen(false)
                goToContent()
              }}
            >
              <ListTree aria-hidden className='size-4' />
            </Button>
            {toolItems.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                variant={
                  (value === 'ai' ? assistantOpen : view === value)
                    ? 'secondary'
                    : 'ghost'
                }
                size='icon'
                className='size-9'
                title={label}
                aria-label={label}
                aria-pressed={value === 'ai' ? assistantOpen : view === value}
                ref={
                  value === 'ai' && wideLayout ? assistantTriggerRef : undefined
                }
                onClick={() => activateTool(value)}
              >
                <Icon aria-hidden className='size-4' />
              </Button>
            ))}
          </nav>
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

function RetainedPane({
  active,
  title,
  onClose,
  children,
}: {
  active: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useLanguage()
  const [visited, setVisited] = useState(active)
  if (active && !visited) setVisited(true)
  if (!active && !visited) return null
  return (
    <section
      hidden={!active}
      aria-label={title}
      data-document-tool-pane
      data-pane-active={active || undefined}
      className='document-pane-transition min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain'
    >
      <div className='mx-auto max-w-[82rem] min-w-0 px-5 py-6 sm:px-10 sm:py-8'>
        <div className='mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4'>
          <h1 className='text-lg font-semibold'>{title}</h1>
          <Button variant='ghost' size='sm' onClick={onClose}>
            <BookOpen aria-hidden />
            {t('admin.workspace.backToContent')}
          </Button>
        </div>
        <Suspense fallback={<ToolSkeleton />}>{children}</Suspense>
      </div>
    </section>
  )
}
function ToolSkeleton() {
  const { t } = useLanguage()
  return (
    <div
      role='status'
      aria-label={t('admin.common.loading')}
      className='grid gap-4 py-3'
    >
      <span className='sr-only'>{t('admin.common.loading')}</span>
      <div aria-hidden className='h-9 w-52 rounded-md bg-muted' />
      <div aria-hidden className='h-28 rounded-md bg-muted/70' />
    </div>
  )
}
// All shared Radix dialogs, confirmations and sheets yield the mobile top layer.
// Observe their owned state, not aria-hidden/inert side effects from focus scopes.
const externalDocumentModalSelector = [
  '[role="dialog"][data-state="open"][data-slot="dialog-content"]',
  '[role="alertdialog"][data-state="open"][data-slot="alert-dialog-content"]',
  '[role="dialog"][data-state="open"][data-slot="sheet-content"]',
].join(',')
function hasExternalDocumentModal() {
  return Array.from(
    globalThis.document.querySelectorAll<HTMLElement>(
      externalDocumentModalSelector
    )
  ).some((modal) => !modal.closest('dialog.document-assistant-panel, [hidden]'))
}
function subscribeExternalDocumentModals(callback: () => void) {
  const observer = new MutationObserver(callback)
  observer.observe(globalThis.document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-state', 'data-slot', 'role', 'hidden'],
  })
  return () => observer.disconnect()
}
function useExternalDocumentModal() {
  return useSyncExternalStore(
    subscribeExternalDocumentModals,
    hasExternalDocumentModal,
    () => false
  )
}
const wideDocumentQuery = '(min-width: 1280px)'
function subscribeWideDocumentLayout(callback: () => void) {
  const media = window.matchMedia(wideDocumentQuery)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
function useWideDocumentLayout() {
  return useSyncExternalStore(
    subscribeWideDocumentLayout,
    () => window.matchMedia(wideDocumentQuery).matches,
    () => false
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
