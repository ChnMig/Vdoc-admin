import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  FileText,
  FolderGit2,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useVdocContextStore } from '@/stores/vdoc-context-store'
import { repositoryKeys } from '@/lib/repository-api'
import type { RepositoryNewFileAttempt } from '@/lib/repository-new-file'
import { cn } from '@/lib/utils'
import {
  createDocumentFolder,
  listDocumentFolders,
  listDocuments,
  listProjectMembers,
  listProjects,
} from '@/lib/vdoc-api'
import { invalidateVdocQueries } from '@/lib/vdoc-query-invalidation'
import type {
  VdocPageDeepLinkProps,
  VdocRouteSearch,
} from '@/lib/vdoc-route-search'
import { useLanguage } from '@/context/language-provider'
import { useIsMobile } from '@/hooks/use-mobile'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { DocumentFileTree } from './document-file-tree'
import {
  DocumentFormFields,
  documentPayloadFromFormData,
} from './document-form-fields'
import {
  documentSelection,
  emptyDocumentSelection,
  type WorkspaceView,
} from './document-workspace-model'
import { DraftEditorSessionProvider } from './draft-editor-session-provider'
import { FormDialog, LoadingErrorState, TextField } from './page-shared'
import {
  ACTIVE_STATUS,
  ROLE_ADMIN,
  ROLE_WRITER,
  activeProjectRole,
  fieldValue,
} from './page-utils'
import {
  isLegacyRepositorySelection,
  projectRepositoryTree,
  useRepositorySnapshot,
} from './use-repository-snapshot'

const DocumentWorkspaceDetail = lazy(() =>
  import('./document-workspace-detail').then((module) => ({
    default: module.DocumentWorkspaceDetail,
  }))
)
const RepositoryWorkspace = lazy(() =>
  import('./repository-workspace').then((module) => ({
    default: module.RepositoryWorkspace,
  }))
)

export type DocumentWorkspacePageProps = VdocPageDeepLinkProps & {
  defaultView?: WorkspaceView
}

export function DocumentWorkspacePage({
  search = {},
  onSearchChange,
  defaultView = 'content',
}: DocumentWorkspacePageProps) {
  const { t, language } = useLanguage()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)
  const sessionVersion = useAuthStore((state) => state.auth.sessionVersion)
  const [localSearch, setLocalSearch] = useState<VdocRouteSearch>(search)
  const routeSearch = onSearchChange ? search : localSearch
  const [filesVisible, setFilesVisible] = useState(true)
  const [mobileFilesOpen, setMobileFilesOpen] = useState(false)
  const newFileAttempt = useRef<RepositoryNewFileAttempt | undefined>(undefined)
  const isMobile = useIsMobile()
  const changeSearch = (patch: Partial<VdocRouteSearch>, replace = false) => {
    if (onSearchChange) onSearchChange(patch, { replace })
    else setLocalSearch((current) => ({ ...current, ...patch }))
  }
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: ({ signal }) => listProjects({ signal }),
  })
  const projects = projectsQuery.data?.items ?? []
  const teamOptions = [
    ...new Map(
      projects.map((project) => [
        project.team_id,
        { value: project.team_id, label: project.team_name || project.team_id },
      ])
    ).values(),
  ]
  const requestedProject = projects.find(
    (project) => project.id === routeSearch.project_id
  )
  const teamId =
    routeSearch.team_id ??
    requestedProject?.team_id ??
    (routeSearch.document_id ? undefined : teamOptions[0]?.value) ??
    ''
  const teamProjects = projects.filter((project) => project.team_id === teamId)
  const project = routeSearch.project_id
    ? teamProjects.find((candidate) => candidate.id === routeSearch.project_id)
    : routeSearch.document_id
      ? undefined
      : (teamProjects.find((candidate) => candidate.status === ACTIVE_STATUS) ??
        teamProjects[0])
  const projectId = project?.id ?? ''
  const effectiveScope = `${sessionVersion}:${teamId}:${projectId}`
  const currentScope = useRef<string | null>(effectiveScope)
  const normalizeSearchRef = useRef(changeSearch)
  useLayoutEffect(() => {
    normalizeSearchRef.current = changeSearch
  })
  useEffect(() => {
    if (!project || (routeSearch.team_id && routeSearch.project_id)) return
    normalizeSearchRef.current(
      { team_id: project.team_id, project_id: project.id },
      true
    )
  }, [project, routeSearch.team_id, routeSearch.project_id])
  const documentsQuery = useQuery({
    queryKey: ['documents', projectId, 'all'],
    queryFn: ({ signal }) => listDocuments(projectId, undefined, { signal }),
    enabled: Boolean(projectId),
  })
  const legacySelection =
    isLegacyRepositorySelection(routeSearch) || defaultView !== 'content'
  const repository = useRepositorySnapshot(
    projectId,
    routeSearch,
    !legacySelection
  )
  const legacyDocuments = documentsQuery.data?.items ?? []
  const repositoryTree = projectRepositoryTree(
    repository.commitQuery.data,
    legacyDocuments
  )
  const visibleDocuments = legacySelection
    ? legacyDocuments
    : repositoryTree.documents
  const foldersQuery = useQuery({
    queryKey: ['document-folders', projectId, sessionVersion],
    queryFn: ({ signal }) => listDocumentFolders(projectId, { signal }),
    enabled: Boolean(projectId),
  })
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: ({ signal }) => listProjectMembers(projectId, { signal }),
    enabled: Boolean(projectId && !user?.is_super_admin),
  })
  const role = activeProjectRole(membersQuery.data?.items, user?.id)
  const canManage = Boolean(user?.is_super_admin || role === ROLE_ADMIN)
  const canMutate = canManage && project?.status === ACTIVE_STATUS
  const document =
    visibleDocuments.find((item) => item.id === routeSearch.document_id) ??
    legacyDocuments.find((item) => item.id === routeSearch.document_id)
  const canWrite = Boolean(
    (user?.is_super_admin || (role ?? 0) >= ROLE_WRITER) &&
    project?.status === ACTIVE_STATUS &&
    (!document || document.status === ACTIVE_STATUS)
  )
  const folders = legacySelection
    ? (foldersQuery.data?.items ?? [])
    : repositoryTree.folders
  const folderId =
    routeSearch.folder_id === 'root'
      ? ''
      : (routeSearch.folder_id ?? document?.folder_id ?? '')
  const folder = folders.find((item) => item.id === folderId)
  const mutationScope = `${effectiveScope}:${folderId}:${document?.id ?? ''}`
  useLayoutEffect(() => {
    currentScope.current = mutationScope
    return () => {
      currentScope.current = null
    }
  }, [mutationScope])
  const unavailable = Boolean(
    (projectsQuery.isSuccess &&
      ((routeSearch.document_id && !routeSearch.project_id) ||
        (routeSearch.team_id &&
          !teamOptions.some((team) => team.value === teamId)) ||
        (routeSearch.project_id && !project))) ||
    (legacySelection &&
      documentsQuery.isSuccess &&
      routeSearch.document_id &&
      !document) ||
    (legacySelection && foldersQuery.isSuccess && folderId && !folder)
  )
  const view = routeSearch.workspace_view ?? defaultView
  const setStoredProject = useVdocContextStore((state) => state.setProjectId)
  const setStoredDocument = useVdocContextStore((state) => state.setDocumentId)
  useEffect(() => {
    setStoredProject(projectId)
    setStoredDocument(document?.id ?? '')
  }, [projectId, document?.id, setStoredProject, setStoredDocument])
  const createMutation = useMutation({
    mutationFn: async (request: {
      projectId: string
      owner: string
      sessionVersion: number
      formData: FormData
    }) => {
      const ownsRequest = () =>
        currentScope.current === request.owner &&
        useAuthStore.getState().auth.sessionVersion === request.sessionVersion
      if (!ownsRequest()) return
      try {
        const payload = await documentPayloadFromFormData(request.formData, t)
        // FileReader may finish after sign-out, reauthentication, or navigation.
        // The API captures the current token when dispatched, so check again.
        if (!ownsRequest()) return
        const directory = String(
          request.formData.get('relative_directory') ?? folder?.path ?? ''
        )
        const newBranchName = String(
          request.formData.get('new_branch_name') ?? ''
        )
        const fingerprint = JSON.stringify([
          request.projectId,
          repository.branch?.id,
          payload,
          directory,
          newBranchName,
        ])
        if (newFileAttempt.current?.fingerprint !== fingerprint)
          newFileAttempt.current = { fingerprint, key: crypto.randomUUID() }
        const { createRepositoryFile } =
          await import('@/lib/repository-new-file')
        const result = await createRepositoryFile(request.projectId, payload, {
          branch: repository.branch,
          directory,
          newBranchName,
          attempt: newFileAttempt.current,
          isCurrent: ownsRequest,
        })
        if (
          useAuthStore.getState().auth.sessionVersion === request.sessionVersion
        )
          return result
      } catch (error) {
        if (ownsRequest()) throw error
      }
    },
    onSuccess: async (result, request) => {
      if (
        !result ||
        useAuthStore.getState().auth.sessionVersion !== request.sessionVersion
      )
        return
      await invalidateVdocQueries(queryClient, {
        kind: 'document',
        projectId: request.projectId,
        documentId: result.documentId,
      })
      queryClient.setQueryData(
        repositoryKeys.commit(request.projectId, result.commit.id),
        result.commit
      )
      await queryClient.invalidateQueries({
        queryKey: repositoryKeys.all(request.projectId),
      })
      if (
        currentScope.current !== request.owner ||
        useAuthStore.getState().auth.sessionVersion !== request.sessionVersion
      )
        return
      changeSearch({
        ...emptyDocumentSelection,
        document_id: result.documentId,
        repository_branch_id: result.branchId,
        commit_id: result.commit.id,
        repository_view: 'content',
        workspace_view: 'content',
        folder_id: undefined,
      })
    },
  })
  const folderMutation = useMutation({
    mutationFn: (request: {
      projectId: string
      parentId: string
      name: string
      owner: string
    }) =>
      createDocumentFolder(request.projectId, {
        parent_id: request.parentId || null,
        name: request.name,
      }),
    onSuccess: async (result, request) => {
      await queryClient.invalidateQueries({
        queryKey: ['document-folders', request.projectId],
      })
      if (currentScope.current === request.owner)
        changeSearch({ folder_id: result.id })
    },
  })
  const backToWorkspace = () =>
    changeSearch({
      ...emptyDocumentSelection,
      folder_id: undefined,
      workspace_view: 'content',
    })
  const navigationActions = (
    <Button
      variant='ghost'
      size='icon'
      className='size-8 shrink-0'
      aria-label={
        isMobile || !filesVisible
          ? t('admin.workspace.showFiles')
          : t('admin.workspace.hideFiles')
      }
      aria-expanded={isMobile ? mobileFilesOpen : filesVisible}
      aria-controls='workspace-files'
      onClick={() =>
        isMobile
          ? setMobileFilesOpen(true)
          : setFilesVisible((visible) => !visible)
      }
    >
      {filesVisible && !isMobile ? (
        <PanelLeftClose aria-hidden className='size-4' />
      ) : (
        <PanelLeftOpen aria-hidden className='size-4' />
      )}
    </Button>
  )
  const fileNavigation = (
    <div
      id='workspace-files'
      className='flex h-full min-h-0 min-w-0 flex-col bg-muted/20'
    >
      <div className='shrink-0 border-b px-3 py-3'>
        <Button
          variant='ghost'
          size='sm'
          className='mb-4 h-8 gap-2 text-muted-foreground'
          onClick={backToWorkspace}
        >
          <ArrowLeft aria-hidden className='size-4' />
          {t('admin.workspace.backToWorkspace')}
        </Button>
        <div className='flex min-w-0 items-center gap-2 px-2 pb-1'>
          <FolderGit2
            aria-hidden
            className='size-5 shrink-0 text-muted-foreground'
          />
          <div className='min-w-0'>
            <p className='truncate text-sm font-semibold' title={project?.name}>
              {project?.name ?? t('admin.fields.project')}
            </p>
            <p className='mt-0.5 truncate text-xs text-muted-foreground'>
              {project?.team_name}
            </p>
          </div>
        </div>
      </div>
      <div className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-3'>
        {canMutate && (
          <div className='flex flex-wrap gap-2 px-3'>
            <FormDialog
              title={t('admin.workspace.newDocument')}
              submitLabel={t('admin.common.create')}
              triggerSize='sm'
              pending={createMutation.isPending}
              disabled={
                unavailable ||
                repository.branch?.import_required ||
                (!legacySelection &&
                  (repository.branchesQuery.isPending ||
                    repository.branchesQuery.isError))
              }
              submissionScope={`${effectiveScope}:${folderId}`}
              onSubmit={(formData) =>
                createMutation.mutateAsync({
                  projectId,
                  owner: mutationScope,
                  sessionVersion,
                  formData,
                })
              }
            >
              <DocumentFormFields
                projectId={projectId}
                repositoryDirectory={folder?.path ?? ''}
              />
              <TextField
                name='new_branch_name'
                label={
                  language === 'zh-CN'
                    ? '新分支名称（可选）'
                    : 'New branch name (optional)'
                }
                description={
                  language === 'zh-CN'
                    ? '保护分支会自动创建工作分支；提交编号由系统生成。'
                    : 'A working branch is created for protected branches. Commit IDs are generated by the server.'
                }
              />
            </FormDialog>
            {legacySelection && (
              <FormDialog
                title={t('admin.workspace.newFolder')}
                submitLabel={t('admin.workspace.createFolder')}
                triggerVariant='outline'
                triggerSize='sm'
                pending={folderMutation.isPending}
                disabled={unavailable}
                submissionScope={`${effectiveScope}:${folderId}`}
                onSubmit={(formData) =>
                  folderMutation.mutateAsync({
                    projectId,
                    parentId: folderId,
                    name: fieldValue(formData, 'name'),
                    owner: mutationScope,
                  })
                }
              >
                <p className='text-sm text-muted-foreground'>
                  {folder?.path ?? t('admin.workspace.rootFolder')}
                </p>
                <TextField
                  label={t('admin.workspace.folderName')}
                  name='name'
                  required
                />
              </FormDialog>
            )}
          </div>
        )}
        <LoadingErrorState state={documentsQuery} />
        <LoadingErrorState state={foldersQuery} />
        {!documentsQuery.isPending && !foldersQuery.isPending && (
          <DocumentFileTree
            key={`${effectiveScope}`}
            folders={folders}
            documents={visibleDocuments}
            documentId={document?.id}
            folderId={folderId}
            onDocumentSelect={(selected) => {
              if (selected.id === document?.id) {
                if (
                  view !== 'content' ||
                  (routeSearch.repository_view &&
                    routeSearch.repository_view !== 'content')
                )
                  changeSearch({
                    workspace_view: 'content',
                    ...(!legacySelection
                      ? { repository_view: 'content' as const }
                      : {}),
                  })
              } else {
                changeSearch({
                  ...documentSelection(selected),
                  ...(!legacySelection
                    ? {
                        repository_branch_id: routeSearch.repository_branch_id,
                        commit_id: routeSearch.commit_id,
                        repository_view: undefined,
                      }
                    : {}),
                })
              }
              setMobileFilesOpen(false)
            }}
            onFolderSelect={(selected) =>
              changeSearch({ folder_id: selected || 'root' })
            }
          />
        )}
      </div>
    </div>
  )
  return (
    <div
      className={cn(
        'grid h-svh min-h-0 min-w-0 overflow-hidden bg-card',
        filesVisible && !isMobile && 'grid-cols-[17rem_minmax(0,1fr)]'
      )}
    >
      {!isMobile && filesVisible && (
        <aside
          className='min-h-0 min-w-0 overflow-hidden border-e'
          aria-label={t('admin.workspace.files')}
        >
          {fileNavigation}
        </aside>
      )}
      {isMobile && (
        <Sheet open={mobileFilesOpen} onOpenChange={setMobileFilesOpen}>
          <SheetContent side='left' className='w-[min(20rem,88vw)] gap-0 p-0'>
            <SheetHeader className='sr-only'>
              <SheetTitle>{t('admin.workspace.files')}</SheetTitle>
              <SheetDescription>{project?.name}</SheetDescription>
            </SheetHeader>
            {fileNavigation}
          </SheetContent>
        </Sheet>
      )}
      <DraftEditorSessionProvider key={effectiveScope}>
        <div className='min-h-0 min-w-0'>
          {projectId && !legacySelection && !unavailable ? (
            <Suspense
              fallback={
                <p role='status' className='p-6 text-sm text-muted-foreground'>
                  {t('admin.common.loading')}
                </p>
              }
            >
              <RepositoryWorkspace
                key={effectiveScope}
                projectId={projectId}
                projectName={project?.name}
                document={document}
                legacyDocuments={legacyDocuments}
                search={routeSearch}
                canManage={canManage}
                canWrite={canWrite}
                interactive={project?.status === ACTIVE_STATUS}
                navigationActions={navigationActions}
                onSearchChange={changeSearch}
              />
            </Suspense>
          ) : document && !unavailable ? (
            <Suspense
              fallback={
                <p role='status' className='p-6 text-sm text-muted-foreground'>
                  {t('admin.common.loading')}
                </p>
              }
            >
              <DocumentWorkspaceDetail
                legacyReadOnly
                key={`${effectiveScope}:${document.id}`}
                projectId={projectId}
                projectName={project?.name}
                document={document}
                search={{ ...routeSearch, workspace_view: view }}
                canManage={canManage}
                canWrite={canWrite}
                interactive={Boolean(
                  project?.status === ACTIVE_STATUS &&
                  document.status === ACTIVE_STATUS
                )}
                navigationActions={navigationActions}
                onSearchChange={changeSearch}
              />
            </Suspense>
          ) : (
            <div className='flex h-full min-h-0 flex-col'>
              <header className='flex h-14 shrink-0 items-center gap-3 border-b px-4'>
                {navigationActions}
                <p className='truncate text-sm font-medium'>
                  {project?.name ?? t('admin.workspace.title')}
                </p>
              </header>
              <div
                id='content'
                tabIndex={-1}
                className='min-h-0 flex-1 overflow-y-auto p-5 focus:outline-none'
              >
                <LoadingErrorState state={projectsQuery} />
                <LoadingErrorState state={documentsQuery} />
                {unavailable && (
                  <Alert variant='destructive'>
                    <AlertDescription>
                      {t('admin.workspace.unavailable')}
                    </AlertDescription>
                  </Alert>
                )}
                {!projectsQuery.isPending &&
                  (!projectId || !documentsQuery.isPending) && (
                    <div className='grid min-h-72 place-content-center justify-items-center gap-3 py-12 text-center'>
                      <FileText
                        aria-hidden
                        className='size-9 text-muted-foreground'
                      />
                      <h1 className='text-lg font-semibold'>
                        {folder?.name ?? t('admin.workspace.selectFile')}
                      </h1>
                      <p className='max-w-md text-sm leading-6 text-muted-foreground'>
                        {t('admin.workspace.selectFileDescription')}
                      </p>
                      <Button variant='outline' onClick={backToWorkspace}>
                        <ArrowLeft aria-hidden />
                        {t('admin.workspace.backToWorkspace')}
                      </Button>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>
      </DraftEditorSessionProvider>
    </div>
  )
}
