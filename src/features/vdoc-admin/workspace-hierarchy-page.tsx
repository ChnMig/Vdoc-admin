import {
  lazy,
  Suspense,
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
  ChevronRight,
  Folder,
  FolderGit2,
  FolderOpen,
  FolderTree,
  Search as SearchIcon,
  Settings2,
  Users,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import {
  createDocument,
  createDocumentFolder,
  createProject,
  createTeam,
  listDocumentFolders,
  listDocuments,
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
import {
  DocumentFormFields,
  documentPayloadFromFormData,
} from './document-form-fields'
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
import { WorkspaceEmbedding } from './workspace-embedding'

const ProjectsPage = lazy(() =>
  import('./projects-page').then((module) => ({ default: module.ProjectsPage }))
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
  const [filter, setFilter] = useState('')
  const [fileFilter, setFileFilter] = useState('')
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
    enabled: Boolean(projectId && !isSuperAdmin),
  })
  const folders = foldersQuery.data?.items ?? []
  const folder = folders.find((item) => item.id === folderId)
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
    (projectId && foldersQuery.isSuccess && folderId && !folder)
  )
  const changeSearch = (patch: Partial<VdocRouteSearch>) => {
    if (onSearchChange) onSearchChange(patch)
    else setLocalSearch((current) => ({ ...current, ...patch }))
  }
  const selectScope = (nextTeam?: string, nextProject?: string) => {
    projectNavigationRef.current?.browse()
    setPanel('browse')
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
    setFileFilter('')
    if (id === folderId) return
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
      const payload = await documentPayloadFromFormData(request.formData, t)
      if (!ownsSession(request.sessionVersion))
        throw new Error(t('admin.common.error'))
      return createDocument(request.projectId, payload)
    },
    onSuccess: async (result, request) => {
      if (!ownsSession(request.sessionVersion)) return
      await invalidateVdocQueries(client, {
        kind: 'document',
        projectId: request.projectId,
        documentId: result.id,
      })
      if (currentScope.current !== request.owner) return
      // Preserve an uploaded first draft when the router opens the document page.
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
    mutationFn: (
      request: MutationScope & {
        projectId: string
        parentId: string
        name: string
      }
    ) =>
      createDocumentFolder(request.projectId, {
        parent_id: request.parentId || null,
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
        (item.parent_id ?? '') === folderId &&
        (!normalizedFileFilter ||
          item.name.toLocaleLowerCase().includes(normalizedFileFilter))
    )
    .sort((left, right) => left.name.localeCompare(right.name, language))
  const visibleDocuments = (documentsQuery.data?.items ?? [])
    .filter(
      (item) =>
        documentFolderId(item, folders) === folderId &&
        (!normalizedFileFilter ||
          `${item.name} ${item.file_name ?? ''}`
            .toLocaleLowerCase()
            .includes(normalizedFileFilter))
    )
    .sort((left, right) => left.name.localeCompare(right.name, language))
  const breadcrumbFolders = folderAncestors(folderId, folders)
  const management = panel !== 'browse' && isSuperAdmin
  const listLoading =
    projectsQuery.isLoading || (isSuperAdmin && teamsQuery.isLoading)
  const listError =
    projectsQuery.error ?? (isSuperAdmin ? teamsQuery.error : null)
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
      <Header>
        <Search className='me-auto' />
        <LanguageSwitch />
        <ThemeSwitch />
      </Header>
      <Main fluid className='min-w-0 pt-3'>
        <div className='mb-5'>
          <h1 className='text-2xl font-semibold tracking-tight'>
            {t('admin.hierarchy.title')}
          </h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            {t('admin.hierarchy.description')}
          </p>
        </div>
        <div className='grid min-w-0 overflow-hidden rounded-lg border bg-card lg:min-h-[calc(100dvh-12rem)] lg:grid-cols-[15.5rem_minmax(0,1fr)]'>
          <aside
            aria-label={t('admin.hierarchy.navigation')}
            className='flex min-w-0 flex-col border-b bg-muted/20 lg:border-r lg:border-b-0'
          >
            <div className='border-b p-3'>
              <div className='relative'>
                <SearchIcon
                  aria-hidden
                  className='pointer-events-none absolute start-2.5 top-2.5 size-4 text-muted-foreground'
                />
                <Input
                  aria-label={t('admin.hierarchy.search')}
                  placeholder={t('admin.hierarchy.search')}
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  className='h-9 bg-background ps-8 text-xs'
                />
              </div>
            </div>
            <nav
              className='max-h-72 space-y-1 overflow-y-auto p-2 lg:max-h-none lg:flex-1'
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
                    <div className='flex min-w-0 items-center gap-0.5'>
                      <button
                        type='button'
                        aria-label={t(
                          isExpanded
                            ? 'admin.documentForm.collapseFolder'
                            : 'admin.documentForm.expandFolder',
                          { name: item.name }
                        )}
                        aria-expanded={isExpanded}
                        className='flex size-7 shrink-0 items-center justify-center rounded hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring'
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
                      <div className='workspace-pane-enter ms-3.5 border-s ps-3'>
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
              <div className='grid gap-1 border-t p-2'>
                <button
                  type='button'
                  onClick={() => setPanel('people')}
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
                  onClick={() => setPanel('teams')}
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
            <div className='border-b px-5 py-3'>
              <nav
                aria-label={t('admin.hierarchy.breadcrumb')}
                className='flex min-h-6 flex-wrap items-center gap-1 text-xs text-muted-foreground'
              >
                <button
                  type='button'
                  onClick={() => selectScope()}
                  className='rounded px-1 py-1 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring'
                >
                  {t('admin.hierarchy.allTeams')}
                </button>
                {team && !management && (
                  <>
                    <ChevronRight aria-hidden className='size-3' />
                    <button
                      type='button'
                      onClick={() => selectScope(team.id)}
                      className='max-w-48 truncate rounded px-1 py-1 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring'
                    >
                      {team.name}
                    </button>
                  </>
                )}
                {project && !management && (
                  <>
                    <ChevronRight aria-hidden className='size-3' />
                    <button
                      type='button'
                      onClick={() => selectFolder('')}
                      className='max-w-48 truncate rounded px-1 py-1 font-medium text-foreground focus-visible:outline-2 focus-visible:outline-ring'
                    >
                      {project.name}
                    </button>
                  </>
                )}
                {project &&
                  !management &&
                  breadcrumbFolders.map((item) => (
                    <span key={item.id} className='contents'>
                      <ChevronRight aria-hidden className='size-3' />
                      <button
                        type='button'
                        onClick={() => selectFolder(item.id)}
                        className='max-w-40 truncate rounded px-1 py-1 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring'
                      >
                        {item.name}
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
            </div>
            <div className='min-w-0 p-4 sm:p-6'>
              <LoadingErrorState
                state={{
                  isLoading: false,
                  isError: Boolean(listError),
                  error: listError,
                }}
              />
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
                    <div className='mb-5 flex min-w-0 flex-wrap items-start justify-between gap-3'>
                      <div className='min-w-0'>
                        <h2 className='flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight'>
                          {project ? (
                            <FolderGit2
                              data-hierarchy-kind='project'
                              aria-hidden
                              className='size-5 shrink-0 text-muted-foreground'
                            />
                          ) : team ? (
                            <Building2
                              data-hierarchy-kind='team'
                              aria-hidden
                              className='size-5 shrink-0 text-muted-foreground'
                            />
                          ) : (
                            <FolderTree
                              aria-hidden
                              className='size-5 shrink-0 text-muted-foreground'
                            />
                          )}
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
                            <TabsList className='max-w-full overflow-x-auto'>
                              <TabsTrigger value='documents'>
                                <FolderOpen aria-hidden />
                                {t('admin.hierarchy.documents')}
                              </TabsTrigger>
                              <TabsTrigger value='members'>
                                <Users
                                  data-hierarchy-kind='people'
                                  aria-hidden
                                />
                                {t('admin.hierarchy.members')}
                              </TabsTrigger>
                              {canManageProject && (
                                <TabsTrigger value='settings'>
                                  <Settings2 aria-hidden />
                                  {t('admin.hierarchy.projectSettings')}
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
                              <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
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
                                </div>
                                <div className='flex flex-wrap items-center gap-2'>
                                  <Input
                                    aria-label={t(
                                      'admin.workspace.searchFiles'
                                    )}
                                    placeholder={t(
                                      'admin.workspace.searchFiles'
                                    )}
                                    className='h-8 w-44 text-xs'
                                    value={fileFilter}
                                    onChange={(event) =>
                                      setFileFilter(event.target.value)
                                    }
                                  />
                                  {canCreateDocument && (
                                    <>
                                      <FormDialog
                                        title={t(
                                          'admin.workspace.createFolder'
                                        )}
                                        triggerVariant='outline'
                                        triggerSize='sm'
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
                                            parentId: folderId,
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
                                        triggerSize='sm'
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
                                        <DocumentFormFields
                                          projectId={projectId}
                                          initialFolderId={folderId}
                                        />
                                      </FormDialog>
                                    </>
                                  )}
                                </div>
                              </div>
                              <LoadingErrorState
                                state={{
                                  isLoading: false,
                                  isError:
                                    documentsQuery.isError ||
                                    foldersQuery.isError,
                                  error:
                                    documentsQuery.error ?? foldersQuery.error,
                                }}
                              />
                              {(documentsQuery.isLoading ||
                                foldersQuery.isLoading) && (
                                <ResourceLoadingState />
                              )}
                              {documentsQuery.isSuccess &&
                                foldersQuery.isSuccess && (
                                  <div
                                    key={`${projectId}:${folderId}`}
                                    className='workspace-pane-enter divide-y border-y'
                                  >
                                    {visibleFolders.map((item) => (
                                      <ResourceRow
                                        key={item.id}
                                        icon={
                                          <Folder
                                            data-hierarchy-kind='folder'
                                            aria-hidden
                                            className='size-5 text-muted-foreground'
                                          />
                                        }
                                        name={item.name}
                                        onClick={() => selectFolder(item.id)}
                                        detail={item.path}
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
                                            className='size-5 text-muted-foreground'
                                          />
                                        }
                                        name={item.name}
                                        detail={
                                          item.file_name ?? item.relative_path
                                        }
                                        onClick={() => openDocument(item)}
                                        trailing={
                                          <>
                                            <Badge
                                              variant={
                                                documentWorkflowState(item) ===
                                                'published'
                                                  ? 'secondary'
                                                  : 'outline'
                                              }
                                            >
                                              {t(
                                                `admin.workspace.${documentWorkflowState(item)}`
                                              )}
                                            </Badge>
                                            {item.status !== ACTIVE_STATUS && (
                                              <Badge variant='outline'>
                                                {t('admin.statuses.archived')}
                                              </Badge>
                                            )}
                                            <span className='hidden w-32 text-end text-xs text-muted-foreground xl:block'>
                                              {formatDate(
                                                item.updated_at,
                                                language
                                              )}
                                            </span>
                                          </>
                                        }
                                      />
                                    ))}
                                    {!visibleFolders.length &&
                                      !visibleDocuments.length && (
                                        <p className='py-12 text-center text-sm text-muted-foreground'>
                                          {t(
                                            normalizedFileFilter
                                              ? 'search.empty'
                                              : 'admin.hierarchy.emptyFolder'
                                          )}
                                        </p>
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
      className='gap-5'
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

function navRow(selected: boolean) {
  return cn(
    'flex min-h-9 w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-2 text-start text-[13px] transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring',
    selected
      ? 'bg-accent font-medium text-accent-foreground'
      : 'text-muted-foreground'
  )
}

function ResourceRow({
  icon,
  name,
  detail,
  trailing,
  onClick,
}: {
  icon: React.ReactNode
  name: string
  detail?: string
  trailing?: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type='button'
      aria-label={name}
      onClick={onClick}
      className='flex min-h-[4.5rem] w-full min-w-0 items-center gap-3 px-2 py-3 text-start transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-3'
    >
      <span className='flex size-9 shrink-0 items-center justify-center'>
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
      <span className='flex shrink-0 items-center gap-3'>
        {trailing}
        <ChevronRight aria-hidden className='size-4 text-muted-foreground' />
      </span>
    </button>
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
  if (document.folder_id) return document.folder_id
  const path = document.relative_path?.split('/').slice(0, -1).join('/')
  return path ? (folders.find((folder) => folder.path === path)?.id ?? '') : ''
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
