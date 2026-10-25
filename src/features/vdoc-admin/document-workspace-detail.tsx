import {
  lazy,
  Suspense,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { BookOpen, Bot, GitCompareArrows, Link2, Settings2 } from 'lucide-react'
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
import { DocumentWorkspaceBranches } from './document-workspace-branches'
import { DocumentWorkspaceContent } from './document-workspace-content'
import { DocumentWorkspaceShare } from './document-workspace-share'
import { DocumentWorkspaceToolbar } from './document-workspace-toolbar'
import { LoadingErrorState } from './page-shared'
import { useDocumentReadingSelection } from './use-document-reading-selection'
import { WorkspaceEmbedding } from './workspace-embedding'

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
}: {
  projectId: string
  document: DocumentDTO
  search: VdocRouteSearch
  canManage: boolean
  canWrite: boolean
  interactive: boolean
  onSearchChange: (patch: Partial<VdocRouteSearch>, replace?: boolean) => void
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
  const navItems = [
    {
      value: 'content',
      label: t('admin.workspace.readDocument'),
      icon: BookOpen,
    },
    {
      value: 'tools',
      label: t('admin.workspace.tools'),
      icon: GitCompareArrows,
    },
    { value: 'ai', label: t('admin.workspace.ai'), icon: Bot },
    ...(canManage
      ? [
          {
            value: 'manage',
            label: t('admin.workspace.manage'),
            icon: Settings2,
          },
        ]
      : []),
  ]
  return (
    <div className='min-w-0'>
      <header className='mb-5 flex min-w-0 flex-wrap items-start justify-between gap-3'>
        <div className='flex min-w-0 flex-1 items-start gap-3'>
          <DocumentTypeIcon
            documentType={document.document_type}
            className='mt-0.5 size-6 shrink-0 text-primary'
          />
          <div className='min-w-0'>
            <h2 className='text-lg leading-6 font-semibold break-words'>
              {document.name}
            </h2>
            <p
              className='mt-1 line-clamp-2 text-xs leading-5 break-all text-muted-foreground'
              title={document.relative_path ?? document.file_name}
            >
              {document.relative_path ?? document.file_name}
            </p>
          </div>
        </div>
        {canManage && (
          <Button
            variant='outline'
            size='sm'
            ref={shareTriggerRef}
            onClick={() => setShareOpen(true)}
            disabled={
              selection.pending ||
              selection.invalid ||
              (selection.mode === 'published' && !selection.version)
            }
          >
            <Link2 aria-hidden />
            {t('admin.workspace.share')}
          </Button>
        )}
      </header>
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
            draft_id: selection.mode === 'draft' ? id || undefined : undefined,
            content_mode: selection.mode,
            workspace_view: 'content',
            endpoint_id: undefined,
          })
        }
        onManageBranches={() => {
          setSettingsTab('branches')
          onSearchChange({ workspace_view: 'manage' })
        }}
      />
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
      <Tabs
        value={section}
        onValueChange={(value) =>
          onSearchChange({
            workspace_view:
              value === 'tools'
                ? 'versions'
                : (value as VdocRouteSearch['workspace_view']),
          })
        }
        className='min-w-0 gap-5'
      >
        <TabsList
          aria-label={t('admin.workspace.title')}
          className='h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-0 pt-2'
        >
          {navItems.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className='min-h-11 flex-none gap-2 rounded-none border-b-2 border-transparent bg-transparent px-3 shadow-none data-[state=active]:border-b-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-b-primary'
            >
              <Icon aria-hidden className='size-4' />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <WorkspaceEmbedding>
          <Suspense
            fallback={
              <p role='status' className='py-5 text-sm text-muted-foreground'>
                {t('admin.common.loading')}
              </p>
            }
          >
            <RetainedSection value='content' active={section === 'content'}>
              <div hidden={view === 'drafts'}>
                <DocumentWorkspaceContent
                  projectId={projectId}
                  document={document}
                  selection={selection}
                  canWrite={canWrite && branch?.status === 1}
                  onEditDraft={editDraft}
                />
              </div>
              <RetainedBody active={view === 'drafts'}>
                <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
                  <h3 className='font-medium'>
                    {t('admin.workspace.editingDraft')}
                  </h3>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() =>
                      onSearchChange({ workspace_view: 'content' })
                    }
                  >
                    {t('admin.workspace.backToContent')}
                  </Button>
                </div>
                <ReadingTargetGuard
                  pending={selection.pending}
                  invalid={selection.invalid}
                >
                  <DraftsPage
                    search={contextSearch}
                    onSearchChange={changeEmbedded('drafts')}
                  />
                </ReadingTargetGuard>
              </RetainedBody>
            </RetainedSection>
            <RetainedSection value='tools' active={section === 'tools'}>
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
                  <RetainedSection value='versions' active={view !== 'diffs'}>
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
            </RetainedSection>
            <RetainedSection value='ai' active={section === 'ai'}>
              <DocumentWorkspaceAI
                projectId={projectId}
                document={document}
                selection={selection}
                interactive={interactive && branch?.status === 1}
                canRegenerate={canWrite && branch?.status === 1}
              />
            </RetainedSection>
            {canManage && (
              <RetainedSection value='manage' active={section === 'manage'}>
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
              </RetainedSection>
            )}
          </Suspense>
        </WorkspaceEmbedding>
      </Tabs>
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
  if (pending || invalid)
    return (
      <p role='status' className='py-5 text-sm text-muted-foreground'>
        {t(
          pending ? 'admin.common.loading' : 'admin.workspace.readerUnavailable'
        )}
      </p>
    )
  return children
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
