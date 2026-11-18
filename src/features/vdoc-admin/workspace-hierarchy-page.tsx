import {
  lazy,
  Suspense,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderGit2,
  FolderOpen,
  FolderTree,
  RefreshCw,
  Search as SearchIcon,
  Settings2,
  Users,
  X,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { listRepositoryDocuments, repositoryKeys } from '@/lib/repository-api'
import type { RepositoryNewFileAttempt } from '@/lib/repository-new-file'
import { cn } from '@/lib/utils'
import {
  createDocumentFolder,
  createProject,
  createTeam,
  listDocumentFolders,
  listProjectMembers,
  listProjects,
  listTeams,
  listUsers,
  type DocumentDTO,
  type DocumentFolderDTO,
} from '@/lib/vdoc-api'
import { invalidateVdocQueries } from '@/lib/vdoc-query-invalidation'
import type {
  VdocPageDeepLinkProps,
  VdocRouteSearch,
} from '@/lib/vdoc-route-search'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LanguageSwitch } from '@/components/language-switch'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { CopyPathButton, CopyPathMenu } from './copy-path-action'
import { DocumentTypeIcon } from './document-type-icon'
import {
  documentSelection,
  documentWorkflowState,
  emptyDocumentSelection,
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
  activeProjectRole,
  fieldValue,
  formatDate,
} from './page-utils'
import { repositoryDocumentTree } from './use-repository-snapshot'
import { WorkspaceEmbedding } from './workspace-embedding'

const ProjectsPage = lazy(() =>
  import('./projects-page').then((module) => ({ default: module.ProjectsPage }))
)
const DocumentFormFields = lazy(() =>
  import('./document-form-fields').then((module) => ({
    default: module.DocumentFormFields,
  }))
)
const DocumentFolderActions = lazy(() =>
  import('./document-folder-actions').then((module) => ({
    default: module.DocumentFolderActions,
  }))
)
const DocumentActions = lazy(() =>
  import('./document-actions').then((module) => ({
    default: module.DocumentActions,
  }))
)
const TeamsPage = lazy(() =>
  import('./teams-page').then((module) => ({ default: module.TeamsPage }))
)
const UsersPage = lazy(() =>
  import('./users-page').then((module) => ({ default: module.UsersPage }))
)

export type WorkspaceHierarchyPageProps = VdocPageDeepLinkProps & {
  onDocumentOpen?: (
    projectId: string,
    documentId: string,
    teamId: string
  ) => void
}

type HubPanel = 'browse' | 'teams' | 'people'
type ProjectPanel = 'documents' | 'members' | 'settings'
type ProjectPanelNavigation = { browse: () => void }
type TeamSummary = { id: string; name: string; description?: string }
type MutationScope = { owner: string; sessionVersion: number }

const breadcrumbLinkClass =
  'inline-flex min-h-8 min-w-0 max-w-[min(12rem,60vw)] items-center gap-2 rounded-md px-2 text-muted-foreground hover:bg-surface-control hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-[current=location]:font-medium aria-[current=location]:text-foreground [&>svg]:size-3.5 [&>svg]:opacity-70'
const workspaceTabClass =
  'h-12 flex-none gap-2 rounded-none border-0 border-b-2 border-transparent px-1 text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none dark:data-[state=active]:border-foreground dark:data-[state=active]:bg-transparent dark:data-[state=active]:text-foreground'

export function WorkspaceHierarchyPage({
  search = {},
  onSearchChange,
  onDocumentOpen,
}: WorkspaceHierarchyPageProps = {}) {
  const { t, language } = useLanguage()
  const client = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)
  const sessionVersion = useAuthStore((state) => state.auth.sessionVersion)
  const isSuperAdmin = Boolean(user?.is_super_admin)
  const [localSearch, setLocalSearch] = useState<VdocRouteSearch>(search)
  const routeSearch = onSearchChange ? search : localSearch
  const [panel, setPanel] = useState<HubPanel>('browse')
  const [navigationOpen, setNavigationOpen] = useState(false)
  const navigationId = useId()
  const navigationRef = useRef<HTMLElement>(null)
  const navigationTrigger = useRef<HTMLButtonElement>(null)
  const [filter, setFilter] = useState('')
  const [fileFilter, setFileFilter] = useState('')
  const newFileAttempt = useRef<RepositoryNewFileAttempt | undefined>(undefined)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [createProjectScope, setCreateProjectScope] = useState<string | null>(
    null
  )
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: ({ signal }) => listProjects({ signal }),
  })
  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: ({ signal }) => listTeams({ signal }),
    enabled: isSuperAdmin,
  })
  const projects = projectsQuery.data?.items ?? []
  const teams: TeamSummary[] = isSuperAdmin
    ? (teamsQuery.data?.items ?? [])
    : [
        ...new Map(
          projects.map((project) => [
            project.team_id,
            {
              id: project.team_id,
              name: project.team_name || project.team_id,
            },
          ])
        ).values(),
      ]
  const requestedProject = projects.find(
    (project) => project.id === routeSearch.project_id
  )
  const teamId = routeSearch.team_id ?? requestedProject?.team_id ?? ''
  const team = teams.find((item) => item.id === teamId)
  const project =
    team && requestedProject?.team_id === team.id ? requestedProject : undefined
  const projectId = project?.id ?? ''
  const pathScope = {
    projectId,
    projectName: project?.name,
    teamId: project?.team_id,
    teamName: team?.name,
  }
  const folderId =
    routeSearch.folder_id === 'root' ? '' : (routeSearch.folder_id ?? '')
  const folderHeadingRef = useRef<HTMLHeadingElement>(null)
  const projectNavigationRef = useRef<ProjectPanelNavigation>(null)
  const pendingFolderFocus = useRef<{
    projectId: string
    sessionVersion: number
    folderId: string
  } | null>(null)
  useLayoutEffect(() => {
    const requested = pendingFolderFocus.current
    if (!requested) return
    if (
      requested.projectId !== projectId ||
      requested.sessionVersion !== sessionVersion
    ) {
      pendingFolderFocus.current = null
      return
    }
    if (requested.folderId !== folderId) return
    pendingFolderFocus.current = null
    const heading = folderHeadingRef.current
    if (heading && !heading.closest('[hidden]'))
      heading.focus({ preventScroll: true })
  }, [folderId, projectId, sessionVersion])
  const scope = `${sessionVersion}:${teamId}:${projectId}:${folderId}:${panel}`
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: ({ signal }) => listUsers({ signal }),
    enabled: isSuperAdmin && createProjectScope === scope,
  })
  const currentScope = useRef<string | null>(scope)
  useLayoutEffect(() => {
    currentScope.current = scope
    return () => {
      currentScope.current = null
    }
  }, [scope])
  const documentsQuery = useQuery({
    queryKey: repositoryKeys.documents(projectId),
    queryFn: ({ signal }) => listRepositoryDocuments(projectId, signal),
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
    enabled: Boolean(projectId && !isSuperAdmin),
  })
  const storedFolders = foldersQuery.data?.items ?? []
  const inferredFolders = repositoryDocumentTree(
    projectId,
    documentsQuery.data ?? []
  ).folders
  const folders = [
    ...storedFolders,
    ...inferredFolders.filter(
      (item) => !storedFolders.some((stored) => stored.path === item.path)
    ),
  ].map((item, _, all) => ({
    ...item,
    parent_id:
      all.find(
        (parent) => parent.path === item.path.split('/').slice(0, -1).join('/')
      )?.id ?? null,
  }))
  const inferredFolderPath = folderId.startsWith('repository-folder:')
    ? folderId.slice('repository-folder:'.length)
    : undefined
  const folder = folders.find(
    (item) => item.id === folderId || item.path === inferredFolderPath
  )
  // Older URLs identify inferred directories by path. Persistence may replace
  // those IDs after their last document is deleted or moved.
  const activeFolderId = folder?.id ?? folderId
  const canManageProject = Boolean(
    isSuperAdmin ||
    activeProjectRole(membersQuery.data?.items, user?.id) === ROLE_ADMIN
  )
  const canCreateDocument =
    canManageProject && project?.status === ACTIVE_STATUS
  const unavailable = Boolean(
    (projectsQuery.isSuccess &&
      (!isSuperAdmin || teamsQuery.isSuccess) &&
      ((teamId && !team) || (routeSearch.project_id && !project))) ||
    (projectId &&
      documentsQuery.isSuccess &&
      foldersQuery.isSuccess &&
      folderId &&
      !folder)
  )
  const changeSearch = (patch: Partial<VdocRouteSearch>) => {
    if (onSearchChange) onSearchChange(patch)
    else setLocalSearch((current) => ({ ...current, ...patch }))
  }
  const closeNavigation = () => {
    if (!navigationOpen) return
    if (navigationRef.current?.contains(document.activeElement))
      navigationTrigger.current?.focus()
    setNavigationOpen(false)
  }
  const selectScope = (nextTeam?: string, nextProject?: string) => {
    projectNavigationRef.current?.browse()
    setPanel('browse')
    closeNavigation()
    setFileFilter('')
    if (nextTeam) setExpanded((current) => ({ ...current, [nextTeam]: true }))
    changeSearch({
      ...emptyDocumentSelection,
      team_id: nextTeam,
      project_id: nextProject,
      folder_id: undefined,
      workspace_view: undefined,
    })
  }
  const selectFolder = (id: string) => {
    projectNavigationRef.current?.browse()
    if (id === folderId) return
    setFileFilter('')
    pendingFolderFocus.current = { projectId, sessionVersion, folderId: id }
    changeSearch({ folder_id: id || 'root' })
  }
  const openDocument = (document: DocumentDTO) => {
    if (!project) return
    if (onDocumentOpen) onDocumentOpen(project.id, document.id, project.team_id)
    else
      changeSearch({
        ...documentSelection(document),
        project_id: project.id,
        team_id: project.team_id,
      })
  }
  const teamMutation = useMutation({
    mutationFn: (
      request: MutationScope & {
        name: string
        description: string
      }
    ) => createTeam({ name: request.name, description: request.description }),
    onSuccess: async (result, request) => {
      if (!ownsSession(request.sessionVersion)) return
      await invalidateVdocQueries(client, { kind: 'teams' })
      if (currentScope.current === request.owner) selectScope(result.id)
    },
  })
  const projectMutation = useMutation({
    mutationFn: (
      request: MutationScope & {
        team_id: string
        name: string
        description: string
        admin_user_id: string
      }
    ) =>
      createProject({
        team_id: request.team_id,
        name: request.name,
        description: request.description,
        admin_user_id: request.admin_user_id,
      }),
    onSuccess: async (result, request) => {
      if (!ownsSession(request.sessionVersion)) return
      await invalidateVdocQueries(client, {
        kind: 'project',
        projectId: result.id,
      })
      if (currentScope.current === request.owner)
        selectScope(result.team_id, result.id)
    },
  })
  const documentMutation = useMutation({
    mutationFn: async (
      request: MutationScope & {
        projectId: string
        formData: FormData
      }
    ) => {
      const { documentPayloadFromFormData } =
        await import('./document-form-fields')
      const payload = await documentPayloadFromFormData(request.formData, t)
      if (!ownsSession(request.sessionVersion))
        throw new Error(t('admin.common.error'))
      const directory = String(
        request.formData.get('relative_directory') ?? folder?.path ?? ''
      )
      const newBranchName = String(
        request.formData.get('new_branch_name') ?? ''
      )
      const fingerprint = JSON.stringify([
        request.projectId,
        payload,
        directory,
        newBranchName,
      ])
      if (newFileAttempt.current?.fingerprint !== fingerprint)
        newFileAttempt.current = { fingerprint, key: crypto.randomUUID() }
      const { createRepositoryFile } = await import('@/lib/repository-new-file')
      return createRepositoryFile(request.projectId, payload, {
        directory,
        newBranchName,
        attempt: newFileAttempt.current,
        isCurrent: () =>
          currentScope.current === request.owner &&
          ownsSession(request.sessionVersion),
      })
    },
    onSuccess: async (result, request) => {
      if (!result || !ownsSession(request.sessionVersion)) return
      await invalidateVdocQueries(client, {
        kind: 'document',
        projectId: request.projectId,
        documentId: result.documentId,
      })
      client.setQueryData(
        repositoryKeys.commit(
          { projectId: request.projectId, documentId: result.documentId },
          result.commit.id
        ),
        result.commit
      )
      await client.invalidateQueries({
        queryKey: repositoryKeys.all(request.projectId),
      })
      if (currentScope.current !== request.owner) return
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
    mutationFn: (
      request: MutationScope & {
        projectId: string
        parentPath: string
        name: string
      }
    ) =>
      createDocumentFolder(request.projectId, {
        parent_path: request.parentPath,
        name: request.name,
      }),
    onSuccess: async (result, request) => {
      if (!ownsSession(request.sessionVersion)) return
      await client.invalidateQueries({
        queryKey: ['document-folders', request.projectId],
      })
      if (currentScope.current === request.owner) selectFolder(result.id)
    },
  })
  const normalizedFilter = filter.trim().toLocaleLowerCase()
  const matches = (value?: string) =>
    !normalizedFilter || value?.toLocaleLowerCase().includes(normalizedFilter)
  const visibleTeams = teams.filter(
    (item) =>
      matches(item.name) ||
      projects.some(
        (candidate) => candidate.team_id === item.id && matches(candidate.name)
      )
  )
  const teamProjects = projects.filter((item) => item.team_id === teamId)
  const visibleProjects = teamProjects.filter(
    (item) => matches(item.name) || matches(team?.name)
  )
  const normalizedFileFilter = fileFilter.trim().toLocaleLowerCase()
  const visibleFolders = folders
    .filter(
      (item) =>
        (item.parent_id ?? '') === activeFolderId &&
        (!normalizedFileFilter ||
          item.name.toLocaleLowerCase().includes(normalizedFileFilter))
    )
    .sort((left, right) => left.name.localeCompare(right.name, language))
  const visibleDocuments = (documentsQuery.data ?? [])
    .filter(
      (item) =>
        item.status === ACTIVE_STATUS &&
        documentFolderId(item, folders) === activeFolderId &&
        (!normalizedFileFilter ||
          `${item.name} ${item.file_name ?? ''}`
            .toLocaleLowerCase()
            .includes(normalizedFileFilter))
    )
    .sort((left, right) => left.name.localeCompare(right.name, language))
  const visibleItemCount = visibleFolders.length + visibleDocuments.length
  const directoryReady = documentsQuery.isSuccess && foldersQuery.isSuccess
  const directoryError = documentsQuery.error ?? foldersQuery.error
  const breadcrumbFolders = folderAncestors(activeFolderId, folders)
  const management = panel !== 'browse' && isSuperAdmin
  const listLoading =
    projectsQuery.isLoading || (isSuperAdmin && teamsQuery.isLoading)
  const listError =
    projectsQuery.error ?? (isSuperAdmin ? teamsQuery.error : null)
  const folderNonempty = (item: DocumentFolderDTO) => {
    const prefix = `${item.path.toLocaleLowerCase()}/`
    return (
      folders.some((candidate) =>
        candidate.path.toLocaleLowerCase().startsWith(prefix)
      ) ||
      (documentsQuery.data ?? []).some((candidate) =>
        candidate.relative_path?.toLocaleLowerCase().startsWith(prefix)
      )
    )
  }
  const currentFolderChanged = (updated: DocumentFolderDTO | null) =>
    selectFolder(updated?.id ?? folder?.parent_id ?? '')
  const renderFolderActions = (item: DocumentFolderDTO, selected = false) =>
    canCreateDocument ? (
      <Suspense fallback={<span className='size-9 shrink-0' />}>
        <DocumentFolderActions
          projectId={projectId}
          pathScope={pathScope}
          folder={item}
          folders={folders}
          nonempty={folderNonempty(item)}
          disabled={
            foldersQuery.isPending ||
            foldersQuery.isError ||
            documentsQuery.isError
          }
          submissionScope={scope}
          isCurrent={() => currentScope.current === scope}
          onChanged={selected ? currentFolderChanged : undefined}
        />
      </Suspense>
    ) : (
      <CopyPathMenu
        path={item.path}
        scope={pathScope}
        label={`${t('admin.workspace.folderActions')}: ${item.name}`}
      />
    )
  const refreshingFolder = documentsQuery.isFetching || foldersQuery.isFetching
  const refreshFolder = () => {
    if (!refreshingFolder)
      void Promise.all([documentsQuery.refetch(), foldersQuery.refetch()])
  }
  const createTeamAction = isSuperAdmin && (
    <FormDialog
      title={t('admin.sections.createTeam')}
      submitLabel={t('admin.common.create')}
      pending={teamMutation.isPending}
      submissionScope={scope}
      triggerSize='sm'
      onSubmit={(formData) =>
        teamMutation.mutateAsync({
          name: fieldValue(formData, 'name'),
          description: fieldValue(formData, 'description'),
          owner: scope,
          sessionVersion,
        })
      }
    >
      <TextField name='name' label={t('admin.fields.name')} required />
      <TextField name='description' label={t('admin.fields.description')} />
    </FormDialog>
  )
  const createProjectAction = isSuperAdmin && team && (
    <FormDialog
      title={t('admin.sections.createProject')}
      description={team.name}
      submitLabel={t('admin.common.create')}
      pending={projectMutation.isPending}
      submissionScope={scope}
      triggerSize='sm'
      onOpenChange={(open) => setCreateProjectScope(open ? scope : null)}
      onSubmit={(formData) =>
        projectMutation.mutateAsync({
          team_id: team.id,
          name: fieldValue(formData, 'name'),
          description: fieldValue(formData, 'description'),
          admin_user_id: fieldValue(formData, 'admin_user_id'),
          owner: scope,
          sessionVersion,
        })
      }
    >
      <TextField name='name' label={t('admin.fields.name')} required />
      <TextField name='description' label={t('admin.fields.description')} />
      <LoadingErrorState state={usersQuery} />
      <NativeSelect
        name='admin_user_id'
        label={t('admin.fields.initialAdmin')}
        placeholder={t('admin.placeholders.useCurrentUser')}
        hint={t('admin.projects.initialAdminHint')}
        disabled={usersQuery.isLoading || usersQuery.isError}
        options={(usersQuery.data?.items ?? [])
          .filter(
            (candidate) =>
              candidate.status === ACTIVE_STATUS && !candidate.is_super_admin
          )
          .map((candidate) => ({
            value: candidate.id,
            label: `${candidate.name} · ${candidate.email}`,
          }))}
      />
    </FormDialog>
  )
  return (
    <>
      <Header fixed className='border-b bg-card'>
        <Search className='me-auto' />
        <LanguageSwitch />
        <ThemeSwitch />
      </Header>
      <Main fluid className='min-w-0 bg-card p-0 sm:px-0 lg:px-0'>
        <h1 className='sr-only'>{t('admin.hierarchy.title')}</h1>
        <p className='sr-only'>{t('admin.hierarchy.description')}</p>
        <div className='grid min-h-[calc(100dvh-3.5rem)] min-w-0 content-start lg:grid-cols-[16rem_minmax(0,1fr)] lg:content-stretch'>
          <button
            ref={navigationTrigger}
            type='button'
            aria-expanded={navigationOpen}
            aria-controls={navigationId}
            className='flex min-h-14 min-w-0 items-center gap-3 border-b bg-surface-panel px-5 text-start text-sm font-medium hover:bg-surface-control focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring lg:hidden'
            onClick={() => setNavigationOpen((open) => !open)}
          >
            <FolderTree aria-hidden className='size-4 shrink-0 text-primary' />
            <span className='min-w-0 flex-1'>
              {t('admin.hierarchy.navigation')}
            </span>
            <ChevronDown
              aria-hidden
              className={cn(
                'workspace-tree-chevron size-4 shrink-0 text-muted-foreground',
                navigationOpen && 'rotate-180'
              )}
            />
          </button>
          <aside
            id={navigationId}
            ref={navigationRef}
            aria-label={t('admin.hierarchy.navigation')}
            className={cn(
              'min-w-0 flex-col border-b bg-surface-panel lg:flex lg:border-e lg:border-b-0',
              navigationOpen ? 'flex' : 'hidden'
            )}
          >
            <div className='px-4 pt-5 pb-3'>
              <p
                aria-hidden
                className='mb-4 hidden px-1 text-sm font-semibold lg:block'
              >
                {t('admin.hierarchy.title')}
              </p>
              <WorkspaceFilter
                label={t('admin.hierarchy.search')}
                value={filter}
                onChange={setFilter}
              />
            </div>
            <nav
              className='max-h-72 space-y-1 overflow-y-auto px-3 pb-4 lg:max-h-none lg:flex-1'
              aria-label={t('admin.hierarchy.navigation')}
            >
              <button
                type='button'
                onClick={() => selectScope()}
                aria-current={!teamId && !management ? 'page' : undefined}
                className={navRow(!teamId && !management)}
              >
                <FolderTree
                  data-hierarchy-kind='workspace'
                  aria-hidden
                  className='size-4 shrink-0'
                />
                <span className='truncate'>
                  {t('admin.hierarchy.allTeams')}
                </span>
              </button>
              {visibleTeams.map((item) => {
                const children = projects.filter(
                  (candidate) =>
                    candidate.team_id === item.id &&
                    (matches(item.name) || matches(candidate.name))
                )
                const isExpanded =
                  Boolean(normalizedFilter) ||
                  (expanded[item.id] ?? teamId === item.id)
                return (
                  <div key={item.id}>
                    <div className='flex min-w-0 items-center'>
                      <button
                        type='button'
                        aria-label={t(
                          isExpanded
                            ? 'admin.documentForm.collapseFolder'
                            : 'admin.documentForm.expandFolder',
                          { name: item.name }
                        )}
                        aria-expanded={isExpanded}
                        className='flex h-10 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring'
                        onClick={() =>
                          setExpanded((current) => {
                            return { ...current, [item.id]: !isExpanded }
                          })
                        }
                      >
                        <ChevronRight
                          aria-hidden
                          className={cn(
                            'workspace-tree-chevron size-3.5',
                            isExpanded && 'rotate-90'
                          )}
                        />
                      </button>
                      <button
                        type='button'
                        aria-label={item.name}
                        aria-current={
                          teamId === item.id && !projectId && !management
                            ? 'page'
                            : undefined
                        }
                        onClick={() => selectScope(item.id)}
                        className={cn(
                          navRow(
                            teamId === item.id && !projectId && !management
                          ),
                          'flex-1'
                        )}
                      >
                        <Building2
                          data-hierarchy-kind='team'
                          aria-hidden
                          className='size-4 shrink-0 text-muted-foreground'
                        />
                        <span className='truncate'>{item.name}</span>
                      </button>
                    </div>
                    {isExpanded && (
                      <div className='workspace-pane-enter ms-3 border-s border-border/70 ps-3'>
                        {children.map((candidate) => (
                          <button
                            key={candidate.id}
                            type='button'
                            aria-label={candidate.name}
                            aria-current={
                              projectId === candidate.id && !management
                                ? 'page'
                                : undefined
                            }
                            onClick={() => selectScope(item.id, candidate.id)}
                            className={navRow(
                              projectId === candidate.id && !management
                            )}
                          >
                            <FolderGit2
                              data-hierarchy-kind='project'
                              aria-hidden
                              className='size-4 shrink-0 text-muted-foreground'
                            />
                            <span className='truncate'>{candidate.name}</span>
                          </button>
                        ))}
                        {!children.length && (
                          <p className='px-2 py-2 text-xs leading-5 text-muted-foreground'>
                            {t('admin.hierarchy.noProjects')}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {!listLoading && !visibleTeams.length && (
                <p className='px-2 py-3 text-xs leading-5 text-muted-foreground'>
                  {t(
                    normalizedFilter
                      ? 'admin.hierarchy.noMatches'
                      : 'admin.hierarchy.noTeams'
                  )}
                </p>
              )}
            </nav>
            {isSuperAdmin && (
              <div className='mx-3 grid gap-1 border-t border-border/70 py-3'>
                <button
                  type='button'
                  onClick={() => {
                    closeNavigation()
                    setPanel('people')
                  }}
                  aria-current={panel === 'people' ? 'page' : undefined}
                  className={navRow(panel === 'people')}
                >
                  <Users
                    data-hierarchy-kind='people'
                    aria-hidden
                    className='size-4'
                  />
                  {t('admin.hierarchy.globalPeople')}
                </button>
                <button
                  type='button'
                  onClick={() => {
                    closeNavigation()
                    setPanel('teams')
                  }}
                  aria-current={panel === 'teams' ? 'page' : undefined}
                  className={navRow(panel === 'teams')}
                >
                  <Settings2 aria-hidden className='size-4' />
                  {t('admin.hierarchy.teamSettings')}
                </button>
              </div>
            )}
          </aside>
          <section className='min-w-0'>
            <div className='flex min-h-14 min-w-0 items-start justify-between gap-2 border-b border-border/70 px-3 py-2.5 sm:items-center sm:px-6'>
              <nav
                aria-label={t('admin.hierarchy.breadcrumb')}
                className='flex min-h-9 min-w-0 flex-1 flex-wrap items-center text-xs text-muted-foreground sm:text-sm'
              >
                <button
                  type='button'
                  onClick={() => selectScope()}
                  aria-current={!team && !management ? 'location' : undefined}
                  className={breadcrumbLinkClass}
                >
                  <Users aria-hidden className='size-4 shrink-0' />
                  <span className='truncate'>
                    {t('admin.hierarchy.allTeams')}
                  </span>
                </button>
                {team && !management && (
                  <span className='inline-flex min-w-0 items-center gap-1'>
                    <ChevronRight aria-hidden className='size-3 shrink-0' />
                    <button
                      type='button'
                      onClick={() => selectScope(team.id)}
                      title={team.name}
                      aria-current={!project ? 'location' : undefined}
                      className={breadcrumbLinkClass}
                    >
                      <Building2 aria-hidden className='size-4 shrink-0' />
                      <span className='truncate'>{team.name}</span>
                    </button>
                  </span>
                )}
                {project && !management && (
                  <span className='inline-flex min-w-0 items-center gap-1'>
                    <ChevronRight aria-hidden className='size-3 shrink-0' />
                    <button
                      type='button'
                      onClick={() => selectFolder('')}
                      title={project.name}
                      aria-current={!folderId ? 'location' : undefined}
                      className={breadcrumbLinkClass}
                    >
                      <FolderGit2 aria-hidden className='size-4 shrink-0' />
                      <span className='truncate'>{project.name}</span>
                    </button>
                  </span>
                )}
                {project &&
                  !management &&
                  breadcrumbFolders.map((item) => (
                    <span
                      key={item.id}
                      className='inline-flex min-w-0 items-center gap-1'
                    >
                      <ChevronRight aria-hidden className='size-3 shrink-0' />
                      <button
                        type='button'
                        onClick={() => selectFolder(item.id)}
                        title={item.path}
                        aria-current={
                          item.id === activeFolderId ? 'location' : undefined
                        }
                        className={breadcrumbLinkClass}
                      >
                        {item.id === activeFolderId ? (
                          <FolderOpen aria-hidden className='size-4 shrink-0' />
                        ) : (
                          <Folder aria-hidden className='size-4 shrink-0' />
                        )}
                        <span className='truncate'>{item.name}</span>
                      </button>
                    </span>
                  ))}
                {management && (
                  <>
                    <ChevronRight aria-hidden className='size-3' />
                    <span className='px-1 font-medium text-foreground'>
                      {t(
                        panel === 'people'
                          ? 'admin.hierarchy.globalPeople'
                          : 'admin.hierarchy.teamSettings'
                      )}
                    </span>
                  </>
                )}
              </nav>
              {project && !management && (
                <div className='flex shrink-0 items-center text-muted-foreground'>
                  <CopyPathButton
                    path={folderId ? folder?.path : ''}
                    scope={pathScope}
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='size-9'
                    aria-disabled={refreshingFolder}
                    aria-label={t(
                      refreshingFolder
                        ? 'admin.workspace.refreshingFolder'
                        : 'admin.workspace.refreshFolder'
                    )}
                    title={t('admin.workspace.refreshFolder')}
                    onClick={refreshFolder}
                  >
                    <RefreshCw
                      aria-hidden
                      className={cn(
                        'size-4',
                        refreshingFolder &&
                          'animate-spin motion-reduce:animate-none'
                      )}
                    />
                  </Button>
                  {folder && renderFolderActions(folder, true)}
                </div>
              )}
            </div>
            <div className='mx-auto max-w-7xl min-w-0 px-5 py-6 sm:px-8 sm:py-8 xl:px-12'>
              <LoadingErrorState
                state={{
                  isLoading: false,
                  isError: Boolean(listError),
                  error: listError,
                }}
              />
              {listError && (
                <Button
                  variant='outline'
                  size='sm'
                  className='mt-3'
                  disabled={listLoading}
                  onClick={() => {
                    void projectsQuery.refetch()
                    if (isSuperAdmin) void teamsQuery.refetch()
                  }}
                >
                  {t('admin.workspace.retry')}
                </Button>
              )}
              {listLoading && <ResourceLoadingState />}
              {management ? (
                <ManagementFallback>
                  <WorkspaceEmbedding>
                    {panel === 'people' ? <UsersPage /> : <TeamsPage />}
                  </WorkspaceEmbedding>
                </ManagementFallback>
              ) : unavailable ? (
                <Alert>
                  <AlertDescription>
                    {t('admin.hierarchy.unavailable')}
                  </AlertDescription>
                </Alert>
              ) : (
                !listLoading &&
                !listError && (
                  <>
                    <div className='mb-6 flex min-w-0 flex-wrap items-start justify-between gap-4'>
                      <div className='min-w-0'>
                        <h2 className='flex min-w-0 items-center gap-3 text-xl font-semibold tracking-tight sm:text-2xl'>
                          <span className='flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-surface-panel text-muted-foreground [&>svg]:size-5 [&>svg]:text-current'>
                            {project ? (
                              <FolderGit2
                                data-hierarchy-kind='project'
                                aria-hidden
                                className='size-5 shrink-0 text-primary'
                              />
                            ) : team ? (
                              <Building2
                                data-hierarchy-kind='team'
                                aria-hidden
                                className='size-5 shrink-0 text-primary'
                              />
                            ) : (
                              <FolderTree
                                aria-hidden
                                className='size-5 shrink-0 text-primary'
                              />
                            )}
                          </span>
                          <span className='truncate'>
                            {project?.name ??
                              team?.name ??
                              t('admin.hierarchy.allTeams')}
                          </span>
                          {project && project.status !== ACTIVE_STATUS && (
                            <Badge variant='outline'>
                              {t('admin.statuses.archived')}
                            </Badge>
                          )}
                        </h2>
                        {(project?.description || team?.description) && (
                          <p className='mt-1 max-w-2xl text-sm leading-6 text-muted-foreground'>
                            {project ? project.description : team?.description}
                          </p>
                        )}
                        {team && !project && (
                          <p className='mt-1 text-xs leading-5 text-muted-foreground'>
                            {t('admin.hierarchy.teamMembersHint')}
                          </p>
                        )}
                      </div>
                      {!project &&
                        (team ? createProjectAction : createTeamAction)}
                    </div>
                    {project ? (
                      <ProjectWorkspaceTabs
                        key={`${sessionVersion}:${project.id}:${canManageProject}`}
                        navigationRef={projectNavigationRef}
                      >
                        {(activePanel, visitedPanels) => (
                          <>
                            <TabsList className='h-auto w-full flex-wrap gap-x-6 overflow-visible rounded-none border-b border-border/70 bg-transparent p-0'>
                              <TabsTrigger
                                value='documents'
                                className={workspaceTabClass}
                              >
                                <FolderOpen
                                  aria-hidden
                                  className='hidden sm:block'
                                />
                                {t('admin.hierarchy.documents')}
                              </TabsTrigger>
                              <TabsTrigger
                                value='members'
                                aria-label={t('admin.hierarchy.members')}
                                className={workspaceTabClass}
                              >
                                <Users
                                  data-hierarchy-kind='people'
                                  aria-hidden
                                  className='hidden sm:block'
                                />
                                <span className='hidden sm:inline'>
                                  {t('admin.hierarchy.members')}
                                </span>
                                <span className='sm:hidden'>
                                  {t('admin.hierarchy.membersCompact')}
                                </span>
                              </TabsTrigger>
                              {canManageProject && (
                                <TabsTrigger
                                  value='settings'
                                  aria-label={t(
                                    'admin.hierarchy.projectSettings'
                                  )}
                                  className={workspaceTabClass}
                                >
                                  <Settings2
                                    aria-hidden
                                    className='hidden sm:block'
                                  />
                                  <span className='hidden sm:inline'>
                                    {t('admin.hierarchy.projectSettings')}
                                  </span>
                                  <span className='sm:hidden'>
                                    {t('admin.hierarchy.settingsCompact')}
                                  </span>
                                </TabsTrigger>
                              )}
                            </TabsList>
                            <TabsContent
                              value='documents'
                              hidden={activePanel !== 'documents'}
                              forceMount
                              aria-busy={
                                documentsQuery.isLoading ||
                                foldersQuery.isLoading
                              }
                              className='workspace-pane-enter min-w-0 data-[state=inactive]:hidden'
                            >
                              <div className='mb-5 flex flex-wrap items-center justify-between gap-4'>
                                <div className='flex min-w-0 items-center gap-2'>
                                  {folderId && (
                                    <Button
                                      variant='ghost'
                                      size='icon'
                                      aria-label={t('admin.hierarchy.upFolder')}
                                      onClick={() =>
                                        selectFolder(folder?.parent_id ?? '')
                                      }
                                    >
                                      <ArrowLeft aria-hidden />
                                    </Button>
                                  )}
                                  <h3
                                    ref={folderHeadingRef}
                                    tabIndex={-1}
                                    className='truncate text-sm font-medium outline-none'
                                  >
                                    {folder?.name ??
                                      t('admin.workspace.rootFolder')}
                                  </h3>
                                  {directoryReady && (
                                    <span className='shrink-0 rounded-md bg-surface-panel px-2 py-1 text-xs text-muted-foreground tabular-nums'>
                                      {visibleItemCount === 1
                                        ? t('admin.hierarchy.singleItem')
                                        : t('admin.hierarchy.itemCount', {
                                            count: visibleItemCount,
                                          })}
                                    </span>
                                  )}
                                </div>
                                <div className='flex w-full flex-wrap items-center gap-2 xl:w-auto'>
                                  <WorkspaceFilter
                                    label={t('admin.workspace.searchFiles')}
                                    className='w-full sm:w-48'
                                    value={fileFilter}
                                    onChange={setFileFilter}
                                  />
                                  {canCreateDocument && (
                                    <>
                                      <FormDialog
                                        title={t(
                                          'admin.workspace.createFolder'
                                        )}
                                        triggerVariant='outline'
                                        triggerSize='default'
                                        submitLabel={t('admin.common.create')}
                                        pending={folderMutation.isPending}
                                        disabled={
                                          foldersQuery.isLoading ||
                                          foldersQuery.isError
                                        }
                                        submissionScope={scope}
                                        onSubmit={(formData) =>
                                          folderMutation.mutateAsync({
                                            projectId,
                                            parentPath: folder?.path ?? '',
                                            name: fieldValue(formData, 'name'),
                                            owner: scope,
                                            sessionVersion,
                                          })
                                        }
                                      >
                                        <TextField
                                          name='name'
                                          label={t(
                                            'admin.workspace.folderName'
                                          )}
                                          required
                                        />
                                      </FormDialog>
                                      <FormDialog
                                        title={t(
                                          'admin.sections.createDocument'
                                        )}
                                        triggerSize='default'
                                        submitLabel={t('admin.common.create')}
                                        pending={documentMutation.isPending}
                                        disabled={
                                          foldersQuery.isLoading ||
                                          foldersQuery.isError
                                        }
                                        submissionScope={scope}
                                        onSubmit={(formData) =>
                                          documentMutation.mutateAsync({
                                            projectId,
                                            owner: scope,
                                            sessionVersion,
                                            formData,
                                          })
                                        }
                                      >
                                        <Suspense
                                          fallback={
                                            <p role='status'>
                                              {t('admin.common.loading')}
                                            </p>
                                          }
                                        >
                                          <DocumentFormFields
                                            projectId={projectId}
                                            repositoryDirectory={
                                              folder?.path ?? ''
                                            }
                                          />
                                        </Suspense>
                                        <TextField
                                          name='new_branch_name'
                                          defaultValue='main'
                                          label={
                                            language === 'zh-CN'
                                              ? '初始分支'
                                              : 'Initial branch'
                                          }
                                          description={
                                            language === 'zh-CN'
                                              ? '仅属于这篇文档。版本号将按分支名自动递增，例如 main.1、main.2。'
                                              : 'Belongs to this document only. Versions increase automatically, for example main.1, main.2.'
                                          }
                                        />
                                      </FormDialog>
                                    </>
                                  )}
                                </div>
                              </div>
                              {directoryError && (
                                <div className='mb-4 grid justify-items-start gap-2'>
                                  <LoadingErrorState
                                    state={{
                                      isLoading: false,
                                      isError: true,
                                      error: directoryError,
                                    }}
                                  />
                                  <Button
                                    variant='outline'
                                    size='sm'
                                    disabled={refreshingFolder}
                                    onClick={refreshFolder}
                                  >
                                    {t('admin.workspace.retry')}
                                  </Button>
                                </div>
                              )}
                              {(documentsQuery.isLoading ||
                                foldersQuery.isLoading) && (
                                <ResourceLoadingState />
                              )}
                              {directoryReady && (
                                <div
                                  key={`${projectId}:${folderId}`}
                                  className='workspace-pane-enter divide-y divide-border/60 border-y border-border/70'
                                >
                                  {visibleFolders.map((item) => (
                                    <ResourceRow
                                      key={item.id}
                                      icon={
                                        <Folder
                                          data-hierarchy-kind='folder'
                                          aria-hidden
                                          className='size-5'
                                        />
                                      }
                                      name={item.name}
                                      onClick={() => selectFolder(item.id)}
                                      detail={
                                        item.path === item.name
                                          ? undefined
                                          : item.path
                                      }
                                      actions={renderFolderActions(item)}
                                    />
                                  ))}
                                  {visibleDocuments.map((item) => (
                                    <ResourceRow
                                      key={item.id}
                                      icon={
                                        <DocumentTypeIcon
                                          documentType={item.document_type}
                                          data-document-type={
                                            item.document_type
                                          }
                                          className='size-5'
                                        />
                                      }
                                      name={item.name}
                                      detail={
                                        item.file_name ?? item.relative_path
                                      }
                                      onClick={() => openDocument(item)}
                                      actions={
                                        canCreateDocument ? (
                                          <Suspense
                                            fallback={
                                              <span className='size-9' />
                                            }
                                          >
                                            <DocumentActions
                                              projectId={projectId}
                                              pathScope={pathScope}
                                              document={item}
                                              folders={folders}
                                              disabled={
                                                foldersQuery.isPending ||
                                                foldersQuery.isError ||
                                                documentsQuery.isError
                                              }
                                              submissionScope={scope}
                                              isCurrent={() =>
                                                currentScope.current === scope
                                              }
                                            />
                                          </Suspense>
                                        ) : (
                                          <CopyPathMenu
                                            path={
                                              item.relative_path ??
                                              item.file_name
                                            }
                                            scope={pathScope}
                                            documentId={item.id}
                                            label={`${t('admin.workspace.moreActions')}: ${item.name}`}
                                          />
                                        )
                                      }
                                      trailing={
                                        <>
                                          <Badge
                                            className='min-w-16 justify-center rounded-md border-border/80 bg-surface-panel py-1 text-xs font-normal text-muted-foreground'
                                            variant={
                                              documentWorkflowState(item) ===
                                              'published'
                                                ? 'secondary'
                                                : 'outline'
                                            }
                                          >
                                            {item.head_version_name ||
                                              item.default_branch_name ||
                                              t(
                                                `admin.workspace.${documentWorkflowState(item)}`
                                              )}
                                          </Badge>
                                          {item.status !== ACTIVE_STATUS && (
                                            <Badge variant='outline'>
                                              {t('admin.statuses.archived')}
                                            </Badge>
                                          )}
                                          <span className='hidden w-36 text-end text-xs text-muted-foreground tabular-nums xl:block'>
                                            {formatDate(
                                              item.updated_at,
                                              language
                                            )}
                                          </span>
                                        </>
                                      }
                                    />
                                  ))}
                                  {!visibleItemCount && (
                                    <div className='grid justify-items-center gap-3 px-4 py-10 text-center'>
                                      <FolderOpen
                                        aria-hidden
                                        className='size-6 text-muted-foreground'
                                      />
                                      <p
                                        role='status'
                                        className='text-sm text-muted-foreground'
                                      >
                                        {t(
                                          normalizedFileFilter
                                            ? 'admin.hierarchy.noFilesMatch'
                                            : 'admin.hierarchy.emptyFolder'
                                        )}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </TabsContent>
                            <TabsContent
                              value='members'
                              hidden={activePanel !== 'members'}
                              forceMount
                              className='workspace-pane-enter data-[state=inactive]:hidden'
                            >
                              {visitedPanels.includes('members') && (
                                <ManagementFallback>
                                  <WorkspaceEmbedding>
                                    <ProjectsPage
                                      projectId={project.id}
                                      section='members'
                                    />
                                  </WorkspaceEmbedding>
                                </ManagementFallback>
                              )}
                            </TabsContent>
                            {canManageProject && (
                              <TabsContent
                                value='settings'
                                hidden={activePanel !== 'settings'}
                                forceMount
                                className='workspace-pane-enter data-[state=inactive]:hidden'
                              >
                                {visitedPanels.includes('settings') && (
                                  <ManagementFallback>
                                    <WorkspaceEmbedding>
                                      <ProjectsPage
                                        projectId={project.id}
                                        section='settings'
                                      />
                                    </WorkspaceEmbedding>
                                  </ManagementFallback>
                                )}
                              </TabsContent>
                            )}
                          </>
                        )}
                      </ProjectWorkspaceTabs>
                    ) : (
                      <div
                        key={teamId || 'workspace'}
                        className='workspace-pane-enter divide-y border-y'
                      >
                        {team
                          ? visibleProjects.map((item) => (
                              <ResourceRow
                                key={item.id}
                                icon={
                                  <FolderGit2
                                    data-hierarchy-kind='project'
                                    aria-hidden
                                    className='size-5 text-muted-foreground'
                                  />
                                }
                                name={item.name}
                                detail={item.description}
                                onClick={() => selectScope(team.id, item.id)}
                                trailing={
                                  item.status !== ACTIVE_STATUS && (
                                    <Badge variant='outline'>
                                      {t('admin.statuses.archived')}
                                    </Badge>
                                  )
                                }
                              />
                            ))
                          : visibleTeams.map((item) => (
                              <ResourceRow
                                key={item.id}
                                icon={
                                  <Building2
                                    data-hierarchy-kind='team'
                                    aria-hidden
                                    className='size-5 text-muted-foreground'
                                  />
                                }
                                name={item.name}
                                detail={item.description}
                                onClick={() => selectScope(item.id)}
                                trailing={
                                  <span className='text-xs text-muted-foreground'>
                                    {
                                      projects.filter(
                                        (candidate) =>
                                          candidate.team_id === item.id
                                      ).length
                                    }{' '}
                                    {t('nav.projects')}
                                  </span>
                                }
                              />
                            ))}
                        {((team && !visibleProjects.length) ||
                          (!team && !visibleTeams.length)) && (
                          <p className='py-12 text-center text-sm text-muted-foreground'>
                            {t(
                              normalizedFilter
                                ? 'admin.hierarchy.noMatches'
                                : team
                                  ? 'admin.hierarchy.noProjects'
                                  : 'admin.hierarchy.noTeams'
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )
              )}
            </div>
          </section>
        </div>
      </Main>
    </>
  )
}

function ProjectWorkspaceTabs({
  children,
  navigationRef,
}: {
  navigationRef: Ref<ProjectPanelNavigation>
  children: (
    activePanel: ProjectPanel,
    visitedPanels: readonly ProjectPanel[]
  ) => React.ReactNode
}) {
  const [activePanel, setActivePanel] = useState<ProjectPanel>('documents')
  const [visitedPanels, setVisitedPanels] = useState<ProjectPanel[]>([
    'documents',
  ])
  useImperativeHandle(
    navigationRef,
    () => ({ browse: () => setActivePanel('documents') }),
    []
  )
  return (
    <Tabs
      value={activePanel}
      onValueChange={(value) => {
        const nextPanel = value as ProjectPanel
        setActivePanel(nextPanel)
        setVisitedPanels((previous) =>
          previous.includes(nextPanel) ? previous : [...previous, nextPanel]
        )
      }}
      className='gap-6'
    >
      {children(activePanel, visitedPanels)}
    </Tabs>
  )
}

function ResourceLoadingState() {
  const { t } = useLanguage()
  return (
    <div
      role='status'
      aria-label={t('admin.common.loading')}
      className='border-y'
    >
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          aria-hidden
          className='flex min-h-[4.5rem] items-center gap-3 px-3 py-3'
        >
          <Skeleton className='size-9 shrink-0 motion-reduce:animate-none' />
          <div className='grid w-full max-w-md gap-2'>
            <Skeleton className='h-3.5 w-2/3 motion-reduce:animate-none' />
            <Skeleton className='h-3 w-1/2 motion-reduce:animate-none' />
          </div>
        </div>
      ))}
    </div>
  )
}

function WorkspaceFilter({
  label,
  value,
  onChange,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const { t } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className={cn('relative min-w-0', className)}>
      <SearchIcon
        aria-hidden
        className='pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground'
      />
      <Input
        ref={inputRef}
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className='h-9 border-border bg-card ps-10 pe-9 shadow-none hover:border-input'
      />
      {value && (
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='absolute inset-y-0 end-0.5 z-10 my-auto size-8 active:translate-y-0'
          aria-label={t('admin.hierarchy.clearSearch')}
          onClick={() => {
            onChange('')
            inputRef.current?.focus()
          }}
        >
          <X aria-hidden />
        </Button>
      )}
    </div>
  )
}

function navRow(selected: boolean) {
  return cn(
    'flex min-h-10 w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-start text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring',
    selected
      ? 'bg-accent font-medium text-accent-foreground'
      : 'text-muted-foreground hover:bg-surface-control hover:text-foreground'
  )
}

function ResourceRow({
  icon,
  name,
  detail,
  trailing,
  actions,
  onClick,
}: {
  icon: React.ReactNode
  name: string
  detail?: string
  trailing?: React.ReactNode
  actions?: React.ReactNode
  onClick: () => void
}) {
  return (
    <div className='group/resource flex min-w-0 items-center transition-colors focus-within:bg-surface-panel hover:bg-surface-panel'>
      <button
        type='button'
        aria-label={name}
        onClick={onClick}
        className='flex min-h-20 w-full min-w-0 items-center gap-3 px-3 py-4 text-start focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:gap-4 sm:px-4'
      >
        <span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-control text-muted-foreground [&>svg]:size-5 [&>svg]:text-current'>
          {icon}
        </span>
        <span className='min-w-0 flex-1'>
          <span className='block truncate text-sm font-medium'>{name}</span>
          {detail && (
            <span className='mt-1 block truncate text-xs text-muted-foreground'>
              {detail}
            </span>
          )}
        </span>
        <span className='flex shrink-0 items-center gap-4 sm:gap-6'>
          {trailing}
          {!actions && (
            <ChevronRight
              aria-hidden
              className='size-4 text-muted-foreground'
            />
          )}
        </span>
      </button>
      {actions && (
        <div className='shrink-0 pe-2 text-muted-foreground sm:pe-3'>
          {actions}
        </div>
      )}
    </div>
  )
}

function ManagementFallback({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage()
  return (
    <Suspense
      fallback={
        <p className='py-8 text-sm text-muted-foreground'>
          {t('admin.hierarchy.loadingManagement')}
        </p>
      }
    >
      {children}
    </Suspense>
  )
}

function documentFolderId(document: DocumentDTO, folders: DocumentFolderDTO[]) {
  if (
    document.folder_id &&
    folders.some((folder) => folder.id === document.folder_id)
  )
    return document.folder_id
  const path = document.relative_path?.split('/').slice(0, -1).join('/')
  return path
    ? (folders.find((folder) => folder.path === path)?.id ??
        document.folder_id ??
        '')
    : (document.folder_id ?? '')
}

function folderAncestors(folderId: string, folders: DocumentFolderDTO[]) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const seen = new Set<string>()
  const result: DocumentFolderDTO[] = []
  let current = byId.get(folderId)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    result.unshift(current)
    current = byId.get(current.parent_id ?? '')
  }
  return result
}

function ownsSession(sessionVersion: number) {
  return useAuthStore.getState().auth.sessionVersion === sessionVersion
}
