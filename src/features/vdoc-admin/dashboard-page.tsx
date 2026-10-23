import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BookOpenText,
  FileText,
  GitCompareArrows,
  KeyRound,
  Layers3,
  Route,
  Server,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import {
  getHealth,
  getIdentity,
  listBranches,
  getDocumentOverview,
  getDocumentMCPReadiness,
  listMCPTokens,
  listProjectMembers,
  listTeams,
  listUsers,
  type MCPTokenDTO,
} from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  PageChrome,
  LoadingErrorState,
  SelectorGrid,
  NativeSelect,
  StatusBadge,
  CollectionCard,
  EmptyState,
} from './page-shared'
import {
  DOCUMENT_TYPE_MARKDOWN,
  SCOPE_DOC_READ,
  DOCUMENT_TYPE_OPENAPI,
  SCOPE_API_READ,
  useProjectsAndSelection,
  activeProjectRole,
  ROLE_ADMIN,
  ROLE_WRITER,
  ROLE_READER,
  useDocumentsAndSelection,
  ACTIVE_STATUS,
  tokenIsActive,
  type PageGuidance,
  contextualHref,
} from './page-utils'

type WorkbenchStepKey =
  | 'team'
  | 'project'
  | 'document'
  | 'branch'
  | 'draft'
  | 'version'
  | 'token'
  | 'connection'

function tokenHasReadScope(token: MCPTokenDTO, documentType?: number) {
  if (documentType === DOCUMENT_TYPE_MARKDOWN) {
    return token.scopes.includes(SCOPE_DOC_READ)
  }
  if (documentType === DOCUMENT_TYPE_OPENAPI) {
    return token.scopes.includes(SCOPE_API_READ)
  }
  return false
}

export function DashboardPage() {
  const { t } = useLanguage()
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => getHealth({ signal }),
  })
  const identityQuery = useQuery({
    queryKey: ['identity'],
    queryFn: ({ signal }) => getIdentity({ signal }),
  })
  const isSuperAdmin = Boolean(identityQuery.data?.is_super_admin)
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: ({ signal }) => listUsers({ signal }),
    enabled: isSuperAdmin,
  })
  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: ({ signal }) => listTeams({ signal }),
    enabled: isSuperAdmin,
  })
  const { projectsQuery, projectId, setProjectId, projectOptions } =
    useProjectsAndSelection()
  const selectedProject = projectsQuery.data?.items.find(
    (project) => project.id === projectId
  )
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: ({ signal }) => listProjectMembers(projectId, { signal }),
    enabled: projectId.length > 0 && !isSuperAdmin,
  })
  const currentUserId = identityQuery.data?.id ?? ''
  const projectRole = activeProjectRole(membersQuery.data?.items, currentUserId)
  const roleLabel = isSuperAdmin
    ? t('admin.workbench.superAdminRole')
    : projectRole === ROLE_ADMIN
      ? t('admin.workbench.adminRole')
      : projectRole === ROLE_WRITER
        ? t('admin.workbench.writerRole')
        : projectRole === ROLE_READER
          ? t('admin.workbench.readerRole')
          : t('admin.workbench.noProjectRole')
  const roleGuidance = isSuperAdmin
    ? t('admin.workbench.superAdminGuidance')
    : projectRole === ROLE_ADMIN
      ? t('admin.workbench.adminGuidance')
      : projectRole === ROLE_WRITER
        ? t('admin.workbench.writerGuidance')
        : projectRole === ROLE_READER
          ? t('admin.workbench.readerGuidance')
          : t('admin.workbench.noProjectGuidance')
  const {
    documentsQuery,
    documentId,
    selectedDocument,
    setDocumentId,
    documentOptions,
  } = useDocumentsAndSelection(projectId)
  const branchesQuery = useQuery({
    queryKey: ['branches', projectId, documentId],
    queryFn: ({ signal }) => listBranches(projectId, documentId, { signal }),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const overviewQuery = useQuery({
    queryKey: ['document-overview', projectId, documentId],
    queryFn: ({ signal }) =>
      getDocumentOverview(projectId, documentId, { signal }),
    enabled: Boolean(projectId && documentId),
  })
  const tokensQuery = useQuery({
    queryKey: ['mcp-tokens'],
    queryFn: ({ signal }) => listMCPTokens({ signal }),
  })
  const readinessQuery = useQuery({
    queryKey: ['mcp-readiness', projectId, documentId],
    queryFn: ({ signal }) =>
      getDocumentMCPReadiness(projectId, documentId, { signal }),
    enabled: Boolean(projectId && documentId),
  })
  const queryState = {
    isLoading:
      healthQuery.isLoading ||
      identityQuery.isLoading ||
      (isSuperAdmin && usersQuery.isLoading) ||
      (isSuperAdmin && teamsQuery.isLoading) ||
      projectsQuery.isLoading ||
      documentsQuery.isLoading ||
      branchesQuery.isLoading ||
      overviewQuery.isLoading ||
      tokensQuery.isLoading ||
      readinessQuery.isLoading,
    isError:
      healthQuery.isError ||
      identityQuery.isError ||
      (isSuperAdmin && usersQuery.isError) ||
      (isSuperAdmin && teamsQuery.isError) ||
      projectsQuery.isError ||
      documentsQuery.isError ||
      branchesQuery.isError ||
      overviewQuery.isError ||
      tokensQuery.isError ||
      readinessQuery.isError,
    error: (healthQuery.error ??
      identityQuery.error ??
      (isSuperAdmin ? usersQuery.error : null) ??
      (isSuperAdmin ? teamsQuery.error : null) ??
      projectsQuery.error ??
      documentsQuery.error ??
      branchesQuery.error ??
      overviewQuery.error ??
      tokensQuery.error ??
      readinessQuery.error) as Error | null,
  }
  const dependencyEntries = Object.entries(healthQuery.data?.dependencies ?? {})
  const activeDocumentContext = Boolean(
    selectedProject?.status === ACTIVE_STATUS &&
    selectedDocument?.status === ACTIVE_STATUS
  )
  const activeBranchIds = new Set(
    (branchesQuery.data?.items ?? [])
      .filter((branch) => branch.status === ACTIVE_STATUS)
      .map((branch) => branch.id)
  )
  const activeReadableTokens = (tokensQuery.data?.items ?? []).filter(
    (token) =>
      activeDocumentContext &&
      tokenIsActive(token) &&
      tokenHasReadScope(token, selectedDocument?.document_type)
  )
  const hasPublishedReadEvidence =
    activeDocumentContext &&
    activeReadableTokens.length > 0 &&
    Boolean(readinessQuery.data?.last_read_at)
  const onboardingSteps: Array<{
    key: WorkbenchStepKey
    icon: typeof UsersRound
    done: boolean
    href: string
  }> = [
    ...(isSuperAdmin
      ? [
          {
            key: 'team' as const,
            icon: UsersRound,
            done: Boolean((teamsQuery.data?.total ?? 0) > 0),
            href: '/teams',
          },
        ]
      : []),
    {
      key: 'project',
      icon: Layers3,
      done: selectedProject?.status === ACTIVE_STATUS,
      href: '/projects',
    },
    {
      key: 'document',
      icon: FileText,
      done: selectedDocument?.status === ACTIVE_STATUS,
      href: '/documents',
    },
    {
      key: 'branch',
      icon: Route,
      done: activeDocumentContext && activeBranchIds.size > 0,
      href: '/documents',
    },
    {
      key: 'draft',
      icon: BookOpenText,
      done:
        activeDocumentContext &&
        Boolean(overviewQuery.data?.has_reviewed_draft),
      href: '/drafts',
    },
    {
      key: 'version',
      icon: GitCompareArrows,
      done:
        activeDocumentContext &&
        Boolean(overviewQuery.data?.published_branch_ids.length),
      href: '/versions',
    },
    {
      key: 'token',
      icon: KeyRound,
      done: activeReadableTokens.length > 0,
      href: '/mcp-tokens',
    },
    {
      key: 'connection',
      icon: ShieldCheck,
      done: hasPublishedReadEvidence,
      href: '/mcp-tokens',
    },
  ]
  const firstIncompleteStep = onboardingSteps.find((step) => !step.done)
  const dashboardGuidance: PageGuidance = firstIncompleteStep
    ? {
        title: t('admin.common.nextAction'),
        description: t('admin.workbench.nextIncompleteStep', {
          step: t(`admin.workbench.steps.${firstIncompleteStep.key}.title`),
        }),
        action: {
          href: firstIncompleteStep.href,
          label: t('admin.workbench.continueStep'),
        },
      }
    : {
        title: t('admin.workbench.lifecycleCompleteTitle'),
        description: t('admin.workbench.lifecycleCompleteDescription'),
      }

  return (
    <PageChrome page='dashboard' guidance={dashboardGuidance}>
      <LoadingErrorState state={queryState} />
      <SelectorGrid>
        <NativeSelect
          label={t('admin.fields.project')}
          value={projectId}
          onChange={setProjectId}
          placeholder={t('admin.placeholders.selectProject')}
          options={projectOptions}
        />
        <NativeSelect
          label={t('admin.fields.document')}
          value={documentId}
          onChange={setDocumentId}
          placeholder={t('admin.placeholders.selectDocument')}
          options={documentOptions}
        />
      </SelectorGrid>
      <section className='flex min-w-0 flex-wrap items-start justify-between gap-4 rounded-lg border bg-card p-5 text-card-foreground'>
        <div className='min-w-0 flex-1 space-y-2'>
          <div className='flex flex-wrap items-center gap-2'>
            <h2 className='text-sm font-semibold'>
              {t('admin.workbench.roleTitle')}
            </h2>
            <StatusBadge>{roleLabel}</StatusBadge>
          </div>
          <p className='max-w-3xl text-sm leading-6 text-muted-foreground'>
            {roleGuidance}
          </p>
          {selectedProject && (
            <p className='text-xs break-words text-muted-foreground'>
              {selectedProject.name} ·{' '}
              <span className='font-mono'>{selectedProject.id}</span>
            </p>
          )}
        </div>
        <StatusBadge muted={!healthQuery.data?.ready}>
          {healthQuery.data?.ready
            ? t('admin.statuses.ready')
            : t('admin.statuses.degraded')}
        </StatusBadge>
      </section>
      <dl className='grid grid-cols-2 rounded-lg border bg-card text-card-foreground lg:grid-cols-4'>
        {[
          [
            t('nav.users'),
            isSuperAdmin ? String(usersQuery.data?.total ?? '—') : '—',
            t('admin.workbench.usersStat'),
          ],
          [
            t('nav.teams'),
            isSuperAdmin ? String(teamsQuery.data?.total ?? '—') : '—',
            t('admin.workbench.teamsStat'),
          ],
          [
            t('nav.projects'),
            String(projectsQuery.data?.total ?? '—'),
            t('admin.workbench.projectsStat'),
          ],
          [
            t('nav.mcpTokens'),
            String(tokensQuery.data?.total ?? '—'),
            t('admin.workbench.tokensStat'),
          ],
        ].map(([title, value, description], index) => (
          <div
            key={title}
            className={`min-w-0 p-4 ${index % 2 === 1 ? 'border-s' : ''} ${index > 1 ? 'border-t lg:border-t-0' : ''} ${index === 2 ? 'lg:border-s' : ''}`}
          >
            <dt className='text-sm text-muted-foreground'>{title}</dt>
            <dd className='mt-1'>
              <span className='text-xl font-semibold tabular-nums'>
                {value}
              </span>
              <p className='mt-1 text-xs leading-5 text-muted-foreground'>
                {description}
              </p>
            </dd>
          </div>
        ))}
      </dl>
      <section className='grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]'>
        <CollectionCard
          title={t('admin.workbench.nextStepsTitle')}
          description={t('admin.workbench.nextStepsDescription')}
        >
          <ol className='divide-y'>
            {onboardingSteps.map((step, index) => {
              const Icon = step.icon
              return (
                <li
                  key={step.key}
                  className='grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1.25rem_minmax(0,1fr)_auto]'
                >
                  <Icon
                    aria-hidden
                    className='mt-1 size-4 text-muted-foreground'
                  />
                  <div className='min-w-0 space-y-1'>
                    <p className='flex flex-wrap items-center gap-2 text-sm font-medium'>
                      <span>
                        {t(`admin.workbench.steps.${step.key}.title`)}
                      </span>
                      <Badge variant={step.done ? 'outline' : 'secondary'}>
                        {step.done ? t('admin.workbench.done') : `${index + 1}`}
                      </Badge>
                    </p>
                    <p className='text-sm leading-6 text-muted-foreground'>
                      {t(`admin.workbench.steps.${step.key}.description`)}
                    </p>
                  </div>
                  <Button
                    asChild
                    variant='link'
                    size='sm'
                    className='col-start-2 h-auto justify-start p-0 text-sm sm:col-start-3 sm:mt-1'
                  >
                    <a href={contextualHref(step.href, projectId, documentId)}>
                      {t(
                        step.done
                          ? 'admin.workbench.inspectStep'
                          : 'admin.workbench.continueStep'
                      )}
                      <ArrowRight />
                    </a>
                  </Button>
                </li>
              )
            })}
          </ol>
        </CollectionCard>
        <CollectionCard
          title={t('admin.pages.dashboard.health')}
          description='/api/v1/open/health'
        >
          <div className='grid gap-3 text-sm'>
            <div className='flex flex-wrap items-center gap-2'>
              <Server className='size-4 text-muted-foreground' />
              <StatusBadge>
                {healthQuery.data?.status ?? t('admin.common.unknown')}
              </StatusBadge>
              <StatusBadge muted={!healthQuery.data?.ready}>
                {healthQuery.data?.ready
                  ? t('admin.statuses.ready')
                  : t('admin.statuses.degraded')}
              </StatusBadge>
            </div>
            <p className='text-muted-foreground'>
              {healthQuery.data?.uptime ?? '-'}
            </p>
            <div className='grid gap-2'>
              {dependencyEntries.length ? (
                dependencyEntries.map(([name, dependency]) => (
                  <div
                    key={name}
                    className='flex min-w-0 flex-wrap items-center justify-between gap-3 border-t py-3 first:border-t-0 first:pt-0 last:pb-0'
                  >
                    <span className='min-w-0 font-medium break-words'>
                      {name}
                    </span>
                    <StatusBadge muted={!dependency.ready}>
                      {dependency.status}
                    </StatusBadge>
                  </div>
                ))
              ) : (
                <EmptyState />
              )}
            </div>
          </div>
        </CollectionCard>
      </section>
    </PageChrome>
  )
}
