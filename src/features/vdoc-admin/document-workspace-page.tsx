import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, FolderTree } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useVdocContextStore } from '@/stores/vdoc-context-store'
import { cn } from '@/lib/utils'
import {
  createDocument,
  createDocumentFolder,
  listDocumentFolders,
  listDocuments,
  listProjectMembers,
  listProjects,
  type ProjectDTO,
} from '@/lib/vdoc-api'
import { invalidateVdocQueries } from '@/lib/vdoc-query-invalidation'
import type {
  VdocPageDeepLinkProps,
  VdocRouteSearch,
} from '@/lib/vdoc-route-search'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { LanguageSwitch } from '@/components/language-switch'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { DocumentFileTree } from './document-file-tree'
import {
  DocumentFormFields,
  documentPayloadFromFormData,
} from './document-form-fields'
import { DocumentWorkspaceDetail } from './document-workspace-detail'
import {
  documentSelection,
  emptyDocumentSelection,
  type WorkspaceView,
} from './document-workspace-model'
import {
  FormDialog,
  LoadingErrorState,
  NativeSelect,
  TextField,
} from './page-shared'
import {
  ACTIVE_STATUS,
  ROLE_ADMIN,
  ROLE_WRITER,
  activeProjectRole,
  fieldValue,
} from './page-utils'

export type DocumentWorkspacePageProps = VdocPageDeepLinkProps & {
  defaultView?: WorkspaceView
}

export function DocumentWorkspacePage({
  search = {},
  onSearchChange,
  defaultView = 'content',
}: DocumentWorkspacePageProps) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)
  const sessionVersion = useAuthStore((state) => state.auth.sessionVersion)
  const [localSearch, setLocalSearch] = useState<VdocRouteSearch>(search)
  const routeSearch = onSearchChange ? search : localSearch
  const [filesVisible, setFilesVisible] = useState(true)
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
    teamOptions[0]?.value ??
    ''
  const teamProjects = projects.filter((project) => project.team_id === teamId)
  const project = routeSearch.project_id
    ? teamProjects.find((candidate) => candidate.id === routeSearch.project_id)
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
  const document = documentsQuery.data?.items.find(
    (item) => item.id === routeSearch.document_id
  )
  const canWrite = Boolean(
    (user?.is_super_admin || (role ?? 0) >= ROLE_WRITER) &&
    project?.status === ACTIVE_STATUS &&
    document?.status === ACTIVE_STATUS
  )
  const folders = foldersQuery.data?.items ?? []
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
      ((routeSearch.team_id &&
        !teamOptions.some((team) => team.value === teamId)) ||
        (routeSearch.project_id && !project))) ||
    (documentsQuery.isSuccess && routeSearch.document_id && !document) ||
    (foldersQuery.isSuccess && folderId && !folder)
  )
  const view = routeSearch.workspace_view ?? defaultView
  const setStoredProject = useVdocContextStore((state) => state.setProjectId)
  const setStoredDocument = useVdocContextStore((state) => state.setDocumentId)
  useEffect(() => {
    setStoredProject(projectId)
    setStoredDocument(document?.id ?? '')
  }, [projectId, document?.id, setStoredProject, setStoredDocument])
  const selectProject = (
    selected: ProjectDTO | undefined,
    selectedTeam = teamId
  ) =>
    changeSearch({
      ...emptyDocumentSelection,
      team_id: selectedTeam || undefined,
      project_id: selected?.id,
      folder_id: undefined,
      workspace_view: 'content',
    })
  const createMutation = useMutation({
    mutationFn: async (request: {
      projectId: string
      owner: string
      formData: FormData
    }) =>
      createDocument(
        request.projectId,
        await documentPayloadFromFormData(request.formData, t)
      ),
    onSuccess: async (result, request) => {
      await invalidateVdocQueries(queryClient, {
        kind: 'document',
        projectId: request.projectId,
        documentId: result.id,
      })
      if (currentScope.current !== request.owner) return
      changeSearch({
        ...documentSelection(result),
        ...(result.initial_draft_id
          ? {
              workspace_view: 'drafts',
              draft_id: result.initial_draft_id,
              branch_id: result.initial_branch_id,
            }
          : {}),
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
  return (
    <>
      <Header>
        <Search className='me-auto' />
        <LanguageSwitch />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main fluid className='min-w-0 pt-2'>
        <div className='mb-5 flex min-w-0 flex-wrap items-start justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-semibold tracking-tight'>
              {t('admin.workspace.title')}
            </h1>
            <p className='mt-1 max-w-3xl text-sm leading-6 text-muted-foreground'>
              {t('admin.workspace.description')}
            </p>
          </div>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setFilesVisible((visible) => !visible)}
            aria-expanded={filesVisible}
            aria-controls='workspace-files'
          >
            <FolderTree aria-hidden />
            {filesVisible
              ? t('admin.workspace.hideFiles')
              : t('admin.workspace.showFiles')}
          </Button>
        </div>
        <div className='mb-5 grid min-w-0 gap-3 border-b pb-5 sm:max-w-2xl sm:grid-cols-2'>
          <NativeSelect
            label={t('admin.fields.team')}
            value={teamId}
            placeholder={t('admin.workspace.chooseTeam')}
            options={teamOptions}
            onChange={(value) =>
              selectProject(
                projects.find(
                  (item) =>
                    item.team_id === value && item.status === ACTIVE_STATUS
                ) ?? projects.find((item) => item.team_id === value),
                value
              )
            }
          />
          <NativeSelect
            label={t('admin.fields.project')}
            value={projectId}
            placeholder={t('admin.workspace.chooseProject')}
            options={teamProjects.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
            onChange={(value) =>
              selectProject(teamProjects.find((item) => item.id === value))
            }
          />
        </div>
        <LoadingErrorState state={projectsQuery} />
        {unavailable && (
          <Alert variant='destructive' className='mb-5'>
            <AlertDescription>
              {t('admin.workspace.unavailable')}
            </AlertDescription>
          </Alert>
        )}
        {!projectId && !projectsQuery.isPending && (
          <p className='py-12 text-center text-sm text-muted-foreground'>
            {teamId
              ? t('admin.workspace.noProjects')
              : t('admin.workspace.chooseScope')}
          </p>
        )}
        {projectId && (
          <div
            className={cn(
              'grid min-w-0 items-start gap-5',
              filesVisible && 'lg:grid-cols-[18rem_minmax(0,1fr)]'
            )}
          >
            {filesVisible && (
              <aside
                id='workspace-files'
                className='flex max-h-80 min-w-0 flex-col gap-3 overflow-hidden rounded-lg border bg-card py-3 lg:sticky lg:top-4 lg:max-h-[calc(100svh-12rem)]'
              >
                <div className='flex min-w-0 flex-wrap items-center justify-between gap-2 px-3'>
                  <h2 className='text-sm font-semibold'>
                    {t('admin.workspace.files')}{' '}
                    <span className='ms-1 font-normal text-muted-foreground'>
                      {documentsQuery.data?.items.length ?? 0}
                    </span>
                  </h2>
                </div>
                {canMutate && (
                  <div className='flex flex-wrap gap-2 px-3'>
                    <FormDialog
                      title={t('admin.workspace.newDocument')}
                      submitLabel={t('admin.common.create')}
                      triggerSize='sm'
                      pending={createMutation.isPending}
                      disabled={unavailable}
                      submissionScope={`${effectiveScope}:${folderId}`}
                      onSubmit={(formData) =>
                        createMutation.mutateAsync({
                          projectId,
                          owner: mutationScope,
                          formData,
                        })
                      }
                    >
                      <DocumentFormFields
                        projectId={projectId}
                        initialFolderId={folderId}
                      />
                    </FormDialog>
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
                  </div>
                )}
                <LoadingErrorState state={documentsQuery} />
                <LoadingErrorState state={foldersQuery} />
                {!documentsQuery.isPending && !foldersQuery.isPending && (
                  <DocumentFileTree
                    key={`${effectiveScope}`}
                    folders={folders}
                    documents={documentsQuery.data?.items ?? []}
                    documentId={document?.id}
                    folderId={folderId}
                    onDocumentSelect={(selected) =>
                      changeSearch(documentSelection(selected))
                    }
                    onFolderSelect={(selected) =>
                      changeSearch({ folder_id: selected || 'root' })
                    }
                  />
                )}
              </aside>
            )}
            <div className='min-w-0 rounded-lg border bg-card p-4 sm:p-5'>
              {document ? (
                <DocumentWorkspaceDetail
                  key={`${effectiveScope}:${document.id}`}
                  projectId={projectId}
                  document={document}
                  search={{ ...routeSearch, workspace_view: view }}
                  canManage={canManage}
                  canWrite={canWrite}
                  interactive={Boolean(
                    project?.status === ACTIVE_STATUS &&
                    document.status === ACTIVE_STATUS
                  )}
                  onSearchChange={changeSearch}
                />
              ) : (
                <div className='grid min-h-72 place-content-center justify-items-center gap-3 px-5 py-12 text-center'>
                  <FileText
                    aria-hidden
                    className='size-9 text-muted-foreground'
                  />
                  <h2 className='text-lg font-semibold'>
                    {folder?.name ?? t('admin.workspace.selectFile')}
                  </h2>
                  <p className='max-w-md text-sm leading-6 text-muted-foreground'>
                    {t('admin.workspace.selectFileDescription')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Main>
    </>
  )
}
