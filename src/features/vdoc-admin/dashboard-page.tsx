import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BookOpenText,
  CircleDot,
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
import { Card, CardContent } from '@/components/ui/card'
import {
  PageChrome,
  LoadingErrorState,
  SelectorGrid,
  NativeSelect,
  StatusBadge,
  StatCard,
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
      <Card className='overflow-hidden'>
        <CardContent className='grid gap-5 p-5 lg:grid-cols-[1.25fr_0.75fr]'>
          <div className='grid gap-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge
                className='w-fit border-primary/20 bg-primary/8 text-primary'
                variant='outline'
              >
                {t('admin.workbench.eyebrow')}
              </Badge>
              <StatusBadge muted={!healthQuery.data?.ready}>
                {healthQuery.data?.ready
                  ? t('admin.statuses.ready')
                  : t('admin.statuses.degraded')}
              </StatusBadge>
            </div>
            <div className='grid gap-3'>
              <h2 className='max-w-3xl text-2xl font-semibold tracking-[-0.025em] text-balance'>
                {t('admin.workbench.title')}
              </h2>
              <p className='max-w-3xl text-sm leading-6 text-pretty text-muted-foreground'>
                {t('admin.workbench.description')}
              </p>
            </div>
          </div>
          <div className='grid gap-3 rounded-md border bg-[var(--surface-control)] p-4 shadow-[var(--shadow-panel)]'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <p className='text-sm font-medium'>
                {t('admin.workbench.roleTitle')}
              </p>
              <StatusBadge>{roleLabel}</StatusBadge>
            </div>
            <p className='text-sm text-muted-foreground'>{roleGuidance}</p>
            {selectedProject && (
              <p className='font-mono text-xs text-muted-foreground'>
                {selectedProject.name} · {selectedProject.id}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
      <section className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <StatCard
          title={t('nav.users')}
          value={isSuperAdmin ? String(usersQuery.data?.total ?? '-') : '-'}
          description={t('admin.workbench.usersStat')}
        />
        <StatCard
          title={t('nav.teams')}
          value={isSuperAdmin ? String(teamsQuery.data?.total ?? '-') : '—'}
          description={t('admin.workbench.teamsStat')}
        />
        <StatCard
          title={t('nav.projects')}
          value={String(projectsQuery.data?.total ?? '-')}
          description={t('admin.workbench.projectsStat')}
        />
        <StatCard
          title={t('nav.mcpTokens')}
          value={String(tokensQuery.data?.total ?? '-')}
          description={t('admin.workbench.tokensStat')}
        />
      </section>
      <section className='grid gap-4 lg:grid-cols-[1.25fr_0.75fr]'>
        <CollectionCard
          title={t('admin.workbench.nextStepsTitle')}
          description={t('admin.workbench.nextStepsDescription')}
        >
          <div className='grid gap-3 md:grid-cols-2'>
            {onboardingSteps.map((step, index) => {
              const Icon = step.icon
              return (
                <div
                  key={step.key}
                  className='rounded-md border bg-[var(--surface-control)] p-4 shadow-[var(--shadow-panel)]'
                >
                  <div className='mb-3 flex items-center justify-between gap-3'>
                    <div className='flex items-center gap-2'>
                      <span className='flex size-8 items-center justify-center rounded-md border bg-background text-primary'>
                        <Icon className='size-4' />
                      </span>
                      <Badge variant={step.done ? 'outline' : 'secondary'}>
                        {step.done ? t('admin.workbench.done') : `${index + 1}`}
                      </Badge>
                    </div>
                    <CircleDot className='size-4 text-muted-foreground' />
                  </div>
                  <p className='font-medium'>
                    {t(`admin.workbench.steps.${step.key}.title`)}
                  </p>
                  <p className='mt-2 text-sm text-muted-foreground'>
                    {t(`admin.workbench.steps.${step.key}.description`)}
                  </p>
                  <Button
                    asChild
                    variant='link'
                    size='sm'
                    className='mt-3 h-auto p-0'
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
                </div>
              )
            })}
          </div>
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
                    className='flex items-center justify-between gap-3 rounded-lg border p-3'
                  >
                    <span className='font-medium'>{name}</span>
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
