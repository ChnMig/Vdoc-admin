import { useId, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  CircleDot,
  Copy,
  FileText,
  GitCompareArrows,
  KeyRound,
  Layers3,
  Route,
  SearchIcon,
  Server,
  UsersRound,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import {
  addProjectMember,
  apiBaseUrl,
  approveDraft,
  archiveBranch,
  archiveDocument,
  archiveProject,
  archiveTeam,
  compareDiff,
  createBranch,
  createDocument,
  createDraft,
  createMCPToken,
  createProject,
  createTeam,
  createUser,
  getDiffSummary,
  getDraftContent,
  getEndpoint,
  getHealth,
  getIdentity,
  getMCPToken,
  getVersionContent,
  listBranches,
  listDocuments,
  listDrafts,
  listEndpoints,
  listMCPTokens,
  listProjectMembers,
  listProjects,
  listTeams,
  listUserMCPTokens,
  listUsers,
  listVersions,
  patchProjectMemberRole,
  patchUser,
  rejectDraft,
  removeProjectMember,
  requestDraftChanges,
  revokeMCPToken,
  revokeUserMCPToken,
  submitDraft,
  updateBranch,
  updateDocument,
  updateDraft,
  updateProject,
  updateTeam,
  type BranchDTO,
  type DiffDTO,
  type DiffItemDTO,
  type DocumentDTO,
  type DraftDTO,
  type EndpointDTO,
  type EndpointSummaryDTO,
  type MCPTokenDTO,
  type ProjectDTO,
  type TeamDTO,
  type UserDTO,
  type VersionDTO,
} from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { useTheme } from '@/context/theme-provider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { LanguageSwitch } from '@/components/language-switch'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

const ACTIVE_STATUS = 1
const ARCHIVED_OR_DISABLED_STATUS = 2
const DOCUMENT_TYPE_OPENAPI = 1
const DOCUMENT_TYPE_MARKDOWN = 2
const ROLE_READER = 1
const ROLE_WRITER = 2
const ROLE_ADMIN = 3
const DRAFT_STATUS_SUBMITTED = 2

type PageKey =
  | 'dashboard'
  | 'users'
  | 'teams'
  | 'projects'
  | 'documents'
  | 'drafts'
  | 'versions'
  | 'diffs'
  | 'mcpTokens'
  | 'settings'

type QueryState = {
  isLoading: boolean
  isError: boolean
  error: Error | null
}

type SelectOption = {
  value: string
  label: string
}

type EmptyStatePreset =
  | 'users'
  | 'teams'
  | 'projects'
  | 'members'
  | 'documents'
  | 'branches'
  | 'drafts'
  | 'versions'
  | 'endpoints'
  | 'diffs'
  | 'tokens'
  | 'userTokens'

type EndpointGroupMode = 'tag' | 'method'
type DraftAction = 'submit' | 'approve' | 'request' | 'reject'
type DiffFilter = 'all' | 'breaking' | 'mustHandle' | 'high'
type WorkbenchStepKey =
  | 'team'
  | 'project'
  | 'document'
  | 'branch'
  | 'draft'
  | 'token'

function useInvalidateAll() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries()
}

function fieldValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function optionalFieldValue(formData: FormData, key: string) {
  const value = fieldValue(formData, key)
  return value.length > 0 ? value : undefined
}

function numberValue(formData: FormData, key: string, fallback: number) {
  const value = Number(fieldValue(formData, key))
  return Number.isFinite(value) ? value : fallback
}

function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function stringify(value: unknown) {
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

function statusLabel(status: number, t: ReturnType<typeof useLanguage>['t']) {
  if (status === ACTIVE_STATUS) return t('admin.statuses.active')
  if (status === ARCHIVED_OR_DISABLED_STATUS)
    return t('admin.statuses.archived')
  return `${t('admin.common.unknown')} ${status}`
}

function draftStatusLabel(
  status: number,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (status === 1) return t('admin.statuses.pending')
  if (status === 2) return t('admin.statuses.submitted')
  if (status === 3) return t('admin.statuses.changesRequested')
  if (status === 4) return t('admin.statuses.rejected')
  if (status === 5) return t('admin.statuses.approved')
  return `${t('admin.common.unknown')} ${status}`
}

function documentTypeLabel(
  type: number,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (type === DOCUMENT_TYPE_MARKDOWN) return t('admin.types.markdown')
  return t('admin.types.openapi')
}

function jsonPreview(value: unknown) {
  if (value === undefined || value === null || value === '') return '-'
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2) ?? '-'
}

function methodLabel(method?: string) {
  return method?.toUpperCase() ?? '-'
}

function parseEndpointGroupMode(value: string): EndpointGroupMode {
  return value === 'method' ? 'method' : 'tag'
}

function diffFilter(value: string): DiffFilter {
  if (value === 'breaking' || value === 'mustHandle' || value === 'high') {
    return value
  }
  return 'all'
}

function endpointTags(endpoint: EndpointSummaryDTO, fallback: string) {
  return endpoint.tags?.length ? endpoint.tags : [fallback]
}

function endpointSearchText(endpoint: EndpointSummaryDTO) {
  return [
    endpoint.method,
    endpoint.path,
    endpoint.operation_id,
    endpoint.summary,
    ...(endpoint.tags ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function changeSeverityLabel(
  severity: number,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (severity >= 3) return t('admin.diff.highSeverity')
  if (severity === 2) return t('admin.diff.mediumSeverity')
  if (severity === 1) return t('admin.diff.lowSeverity')
  return t('admin.diff.infoSeverity')
}

function changeTypeLabel(
  changeType: number,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (changeType === 1) return t('admin.diff.added')
  if (changeType === 2) return t('admin.diff.removed')
  if (changeType === 3) return t('admin.diff.modified')
  return `${t('admin.common.unknown')} ${changeType}`
}

function PageChrome({
  page,
  children,
}: {
  page: PageKey
  children: React.ReactNode
}) {
  const { t } = useLanguage()
  return (
    <>
      <Header>
        <Search />
        <LanguageSwitch />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        <section className='mb-5 grid gap-4 rounded-lg border bg-card p-5 text-card-foreground shadow-[var(--shadow-card)] panel-control md:grid-cols-[minmax(0,1fr)_21rem]'>
          <div className='grid gap-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge
                className='border-primary/20 bg-primary/8 text-primary'
                variant='outline'
              >
                {t(`admin.pages.${page}.stage`)}
              </Badge>
              <span className='font-mono text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase'>
                {t('app.consoleLabel')}
              </span>
            </div>
            <div className='grid gap-2'>
              <h1 className='text-2xl font-semibold tracking-[-0.025em] text-balance'>
                {t(`admin.pages.${page}.title`)}
              </h1>
              <p className='max-w-3xl text-sm leading-6 text-pretty text-muted-foreground'>
                {t(`admin.pages.${page}.description`)}
              </p>
            </div>
            <p className='max-w-3xl border-t pt-3 text-sm text-muted-foreground'>
              {t(`admin.pages.${page}.cue`)}
            </p>
          </div>
          <aside className='grid content-start gap-3 rounded-md border bg-[var(--surface-control)] p-4 text-sm shadow-[var(--shadow-panel)]'>
            <p className='font-mono text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase'>
              {t('admin.common.nextAction')}
            </p>
            <p className='leading-6 text-muted-foreground'>
              {t(`admin.pages.${page}.next`)}
            </p>
          </aside>
        </section>
        <div className='grid gap-5'>{children}</div>
      </Main>
    </>
  )
}

function LoadingErrorState({ state }: { state: QueryState }) {
  const { t } = useLanguage()
  if (state.isLoading) {
    return (
      <Card>
        <CardContent className='grid gap-3 py-6 text-sm text-muted-foreground'>
          <div className='flex items-center justify-between gap-3'>
            <span>{t('admin.common.loading')}</span>
            <span className='h-2 w-24 rounded-full bg-muted' />
          </div>
          <div className='grid gap-2'>
            <span className='h-2 rounded-full bg-muted/80' />
            <span className='h-2 w-2/3 rounded-full bg-muted/70' />
          </div>
        </CardContent>
      </Card>
    )
  }
  if (state.isError) {
    return (
      <Alert variant='destructive'>
        <AlertCircle />
        <AlertTitle>{t('admin.common.error')}</AlertTitle>
        <AlertDescription>
          {state.error?.message ?? t('toasts.somethingWrong')}
        </AlertDescription>
      </Alert>
    )
  }
  return null
}

function EmptyState({ preset }: { preset?: EmptyStatePreset }) {
  const { t } = useLanguage()
  const title = preset
    ? t(`admin.emptyStates.${preset}.title`)
    : t('admin.common.empty')
  const description = preset
    ? t(`admin.emptyStates.${preset}.description`)
    : t('admin.emptyStates.generic.description')
  const action = preset ? t(`admin.emptyStates.${preset}.action`) : undefined
  return (
    <div className='grid gap-4 rounded-lg border border-dashed bg-[var(--surface-control)] p-5 text-sm'>
      <div className='flex items-start gap-3'>
        <span className='mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-primary'>
          <ArrowRight className='size-4' />
        </span>
        <div className='grid gap-2'>
          <p className='font-medium'>{title}</p>
          <p className='max-w-2xl text-muted-foreground'>{description}</p>
        </div>
      </div>
      {action && (
        <div className='rounded-md border bg-background p-3'>
          <p className='font-mono text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase'>
            {t('admin.common.nextAction')}
          </p>
          <p className='mt-1 text-sm'>{action}</p>
        </div>
      )}
    </div>
  )
}

function NativeSelect({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
  name,
}: {
  id?: string
  label: string
  value?: string
  options: SelectOption[]
  placeholder: string
  onChange?: (value: string) => void
  name?: string
}) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  return (
    <div className='grid gap-2'>
      <Label htmlFor={controlId}>{label}</Label>
      <select
        id={controlId}
        name={name}
        value={value}
        onChange={(event) => onChange?.(event.currentTarget.value)}
        className='h-9 rounded-md border border-input bg-background/75 px-3 text-sm shadow-[0_1px_1px_oklch(0_0_0_/_4%)] transition-[background-color,border-color,color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-hidden dark:bg-input/25'
      >
        <option value=''>{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function SelectorGrid({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage()
  return (
    <section className='grid gap-3 rounded-lg border bg-card p-4 panel-control'>
      <p className='font-mono text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase'>
        {t('admin.common.selectedContext')}
      </p>
      <div className='grid gap-4 md:grid-cols-3 xl:grid-cols-4'>{children}</div>
    </section>
  )
}

function StatCard({
  title,
  value,
  description,
}: {
  title: string
  value: string
  description: string
}) {
  return (
    <Card className='gap-3 py-5'>
      <CardHeader className='gap-2 pb-0'>
        <CardDescription className='font-mono text-[0.68rem] font-semibold tracking-wide uppercase'>
          {title}
        </CardDescription>
        <CardTitle className='text-2xl font-semibold tracking-[-0.02em] tabular-nums'>
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className='text-sm text-muted-foreground'>
        {description}
      </CardContent>
    </Card>
  )
}

function FormCard({
  title,
  children,
  submitLabel,
  pending,
  onSubmit,
}: {
  title: string
  children: React.ReactNode
  submitLabel: string
  pending: boolean
  onSubmit: (formData: FormData) => void
}) {
  const { t } = useLanguage()
  return (
    <Card className='border-primary/25'>
      <CardHeader className='border-b pb-5'>
        <Badge
          className='w-fit border-primary/20 bg-primary/8 text-primary'
          variant='outline'
        >
          {t('admin.common.operationPanel')}
        </Badge>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {t('admin.common.operationPanelDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className='grid gap-4'
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit(new FormData(event.currentTarget))
            event.currentTarget.reset()
          }}
        >
          {children}
          <Button type='submit' className='w-fit' disabled={pending}>
            {submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function CollectionCard({
  title,
  description,
  count,
  children,
}: {
  title: string
  description?: string
  count?: number
  children: React.ReactNode
}) {
  const { t } = useLanguage()
  return (
    <Card className='overflow-hidden'>
      <CardHeader className='border-b pb-5'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='grid gap-2'>
            <Badge className='w-fit' variant='secondary'>
              {t('admin.common.resourceCollection')}
            </Badge>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {typeof count === 'number' && (
            <Badge variant='outline'>
              {t('admin.common.total')}: {count}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className='grid gap-4 p-5'>{children}</CardContent>
    </Card>
  )
}

function TextField({
  id,
  label,
  name,
  type = 'text',
  required = false,
  placeholder,
}: {
  id?: string
  label: string
  name: string
  type?: string
  required?: boolean
  placeholder?: string
}) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  return (
    <div className='grid gap-2'>
      <Label htmlFor={controlId}>{label}</Label>
      <Input
        id={controlId}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
      />
    </div>
  )
}

function TextAreaField({
  id,
  label,
  name,
  required = false,
}: {
  id?: string
  label: string
  name: string
  required?: boolean
}) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  return (
    <div className='grid gap-2'>
      <Label htmlFor={controlId}>{label}</Label>
      <Textarea
        id={controlId}
        name={name}
        required={required}
        className='min-h-32 font-mono'
      />
    </div>
  )
}

function InlineNameDescriptionForm({
  item,
  onUpdate,
  pending,
}: {
  item: { id: string; name: string; description?: string }
  onUpdate: (id: string, name: string, description: string) => void
  pending: boolean
}) {
  const { t } = useLanguage()
  return (
    <form
      className='grid gap-2 sm:grid-cols-[1fr_1fr_auto]'
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        onUpdate(
          item.id,
          fieldValue(formData, 'name'),
          fieldValue(formData, 'description')
        )
      }}
    >
      <Input
        name='name'
        defaultValue={item.name}
        aria-label={t('admin.fields.name')}
      />
      <Input
        name='description'
        defaultValue={item.description ?? ''}
        aria-label={t('admin.fields.description')}
      />
      <Button type='submit' variant='outline' size='sm' disabled={pending}>
        {t('admin.common.update')}
      </Button>
    </form>
  )
}

function StatusBadge({
  children,
  muted = false,
}: {
  children: React.ReactNode
  muted?: boolean
}) {
  return (
    <Badge
      className={
        muted
          ? 'border-input bg-secondary text-secondary-foreground'
          : 'border-primary/25 bg-primary/8 text-primary'
      }
      variant='outline'
    >
      {children}
    </Badge>
  )
}

function ContentViewer({
  title,
  content,
}: {
  title: string
  content?: string
}) {
  const { t } = useLanguage()
  return (
    <CollectionCard title={title}>
      {content ? (
        <pre className='max-h-[36rem] overflow-auto rounded-md border bg-[var(--surface-control)] p-4 text-xs leading-relaxed text-foreground'>
          {content}
        </pre>
      ) : (
        <p className='text-sm text-muted-foreground'>
          {t('admin.common.empty')}
        </p>
      )}
    </CollectionCard>
  )
}

function useProjectsAndSelection() {
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  })
  const [projectId, setProjectId] = useState('')
  const projectOptions = useMemo(
    () =>
      projectsQuery.data?.items.map((project) => ({
        value: project.id,
        label: project.name,
      })) ?? [],
    [projectsQuery.data]
  )
  const selectedProjectId = projectOptions.some(
    (project) => project.value === projectId
  )
    ? projectId
    : (projectOptions[0]?.value ?? '')
  return {
    projectsQuery,
    projectId: selectedProjectId,
    setProjectId,
    projectOptions,
  }
}

function useDocumentsAndSelection(projectId: string) {
  const documentsQuery = useQuery({
    queryKey: ['documents', projectId],
    queryFn: () => listDocuments(projectId),
    enabled: projectId.length > 0,
  })
  const [documentId, setDocumentId] = useState('')
  const documentOptions = useMemo(
    () =>
      documentsQuery.data?.items.map((document) => ({
        value: document.id,
        label: document.name,
      })) ?? [],
    [documentsQuery.data]
  )
  const selectedDocumentId = documentOptions.some(
    (document) => document.value === documentId
  )
    ? documentId
    : (documentOptions[0]?.value ?? '')
  const selectedDocument = documentsQuery.data?.items.find(
    (document) => document.id === selectedDocumentId
  )
  return {
    documentsQuery,
    documentId: selectedDocumentId,
    selectedDocument,
    setDocumentId,
    documentOptions,
  }
}

function useVersionsAndSelection(projectId: string, documentId: string) {
  const versionsQuery = useQuery({
    queryKey: ['versions', projectId, documentId],
    queryFn: () => listVersions(projectId, documentId),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const [versionId, setVersionId] = useState('')
  const versionOptions = useMemo(
    () =>
      versionsQuery.data?.items.map((version) => ({
        value: version.id,
        label: version.version_name,
      })) ?? [],
    [versionsQuery.data]
  )
  const selectedVersionId = versionOptions.some(
    (version) => version.value === versionId
  )
    ? versionId
    : (versionOptions[0]?.value ?? '')
  return {
    versionsQuery,
    versionId: selectedVersionId,
    setVersionId,
    versionOptions,
  }
}

export function DashboardPage() {
  const { t } = useLanguage()
  const healthQuery = useQuery({ queryKey: ['health'], queryFn: getHealth })
  const identityQuery = useQuery({
    queryKey: ['identity'],
    queryFn: getIdentity,
  })
  const isSuperAdmin = Boolean(identityQuery.data?.is_super_admin)
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
    enabled: isSuperAdmin,
  })
  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: listTeams })
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  })
  const firstProjectId = projectsQuery.data?.items[0]?.id ?? ''
  const documentsQuery = useQuery({
    queryKey: ['documents', firstProjectId],
    queryFn: () => listDocuments(firstProjectId),
    enabled: firstProjectId.length > 0,
  })
  const firstDocumentId = documentsQuery.data?.items[0]?.id ?? ''
  const branchesQuery = useQuery({
    queryKey: ['branches', firstProjectId, firstDocumentId],
    queryFn: () => listBranches(firstProjectId, firstDocumentId),
    enabled: firstProjectId.length > 0 && firstDocumentId.length > 0,
  })
  const draftsQuery = useQuery({
    queryKey: ['drafts', firstProjectId, firstDocumentId],
    queryFn: () => listDrafts(firstProjectId, firstDocumentId),
    enabled: firstProjectId.length > 0 && firstDocumentId.length > 0,
  })
  const tokensQuery = useQuery({
    queryKey: ['mcp-tokens'],
    queryFn: listMCPTokens,
  })
  const queryState = {
    isLoading:
      healthQuery.isLoading ||
      identityQuery.isLoading ||
      (isSuperAdmin && usersQuery.isLoading) ||
      teamsQuery.isLoading ||
      projectsQuery.isLoading ||
      documentsQuery.isLoading ||
      branchesQuery.isLoading ||
      draftsQuery.isLoading ||
      tokensQuery.isLoading,
    isError:
      healthQuery.isError ||
      identityQuery.isError ||
      (isSuperAdmin && usersQuery.isError) ||
      teamsQuery.isError ||
      projectsQuery.isError ||
      documentsQuery.isError ||
      branchesQuery.isError ||
      draftsQuery.isError ||
      tokensQuery.isError,
    error: (healthQuery.error ??
      identityQuery.error ??
      (isSuperAdmin ? usersQuery.error : null) ??
      teamsQuery.error ??
      projectsQuery.error ??
      documentsQuery.error ??
      branchesQuery.error ??
      draftsQuery.error ??
      tokensQuery.error) as Error | null,
  }
  const dependencyEntries = Object.entries(healthQuery.data?.dependencies ?? {})
  const onboardingSteps: Array<{
    key: WorkbenchStepKey
    icon: typeof UsersRound
    done: boolean
  }> = [
    {
      key: 'team',
      icon: UsersRound,
      done: Boolean((teamsQuery.data?.total ?? 0) > 0),
    },
    {
      key: 'project',
      icon: Layers3,
      done: Boolean((projectsQuery.data?.total ?? 0) > 0),
    },
    {
      key: 'document',
      icon: FileText,
      done: Boolean((documentsQuery.data?.total ?? 0) > 0),
    },
    {
      key: 'branch',
      icon: Route,
      done: Boolean((branchesQuery.data?.total ?? 0) > 0),
    },
    {
      key: 'draft',
      icon: BookOpenText,
      done: Boolean((draftsQuery.data?.total ?? 0) > 0),
    },
    {
      key: 'token',
      icon: KeyRound,
      done: Boolean((tokensQuery.data?.total ?? 0) > 0),
    },
  ]

  return (
    <PageChrome page='dashboard'>
      <LoadingErrorState state={queryState} />
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
              <StatusBadge>
                {identityQuery.data?.is_super_admin
                  ? t('admin.workbench.superAdminRole')
                  : t('admin.workbench.adminRole')}
              </StatusBadge>
            </div>
            <p className='text-sm text-muted-foreground'>
              {identityQuery.data?.is_super_admin
                ? t('admin.workbench.superAdminGuidance')
                : t('admin.workbench.adminGuidance')}
            </p>
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
          value={String(teamsQuery.data?.total ?? '-')}
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

export function UsersPage() {
  const { t } = useLanguage()
  const invalidate = useInvalidateAll()
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: listUsers })
  const [selectedUserId, setSelectedUserId] = useState('')
  const selectedUser = usersQuery.data?.items.find(
    (user) => user.id === selectedUserId
  )
  const userTokenQuery = useQuery({
    queryKey: ['user-mcp-tokens', selectedUserId],
    queryFn: () => listUserMCPTokens(selectedUserId),
    enabled: selectedUserId.length > 0,
  })
  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: invalidate,
  })
  const patchMutation = useMutation({
    mutationFn: ({
      id,
      status,
      isSuperAdmin,
    }: {
      id: string
      status?: number
      isSuperAdmin?: boolean
    }) => patchUser(id, { status, is_super_admin: isSuperAdmin }),
    onSuccess: invalidate,
  })
  const revokeMutation = useMutation({
    mutationFn: ({ userId, tokenId }: { userId: string; tokenId: string }) =>
      revokeUserMCPToken(userId, tokenId),
    onSuccess: invalidate,
  })

  return (
    <PageChrome page='users'>
      <LoadingErrorState
        state={{
          isLoading: usersQuery.isLoading,
          isError: usersQuery.isError,
          error: usersQuery.error,
        }}
      />
      <FormCard
        title={t('admin.sections.createUser')}
        submitLabel={t('admin.common.create')}
        pending={createMutation.isPending}
        onSubmit={(formData) =>
          createMutation.mutate({
            email: fieldValue(formData, 'email'),
            name: fieldValue(formData, 'name'),
            password: fieldValue(formData, 'password'),
            is_super_admin: fieldValue(formData, 'is_super_admin') === 'true',
          })
        }
      >
        <div className='grid gap-4 md:grid-cols-2'>
          <TextField
            label={t('admin.fields.email')}
            name='email'
            type='email'
            required
          />
          <TextField label={t('admin.fields.name')} name='name' required />
        </div>
        <div className='grid gap-4 md:grid-cols-2'>
          <TextField
            label={t('admin.fields.password')}
            name='password'
            type='password'
            required
          />
          <NativeSelect
            name='is_super_admin'
            label={t('admin.fields.superAdmin')}
            placeholder={t('admin.common.no')}
            options={[
              { value: 'false', label: t('admin.common.no') },
              { value: 'true', label: t('admin.common.yes') },
            ]}
          />
        </div>
      </FormCard>
      <CollectionCard
        title={t('nav.users')}
        count={usersQuery.data?.total ?? 0}
      >
        {usersQuery.data?.items.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.fields.email')}</TableHead>
                <TableHead>{t('admin.fields.status')}</TableHead>
                <TableHead>{t('admin.fields.superAdmin')}</TableHead>
                <TableHead>{t('admin.fields.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.data.items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <button
                      type='button'
                      className='text-start font-medium underline-offset-4 hover:underline'
                      onClick={() => setSelectedUserId(user.id)}
                    >
                      {user.email}
                    </button>
                    <div className='text-xs text-muted-foreground'>
                      {user.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge>{statusLabel(user.status, t)}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    {user.is_super_admin
                      ? t('admin.common.yes')
                      : t('admin.common.no')}
                  </TableCell>
                  <TableCell>
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() =>
                          patchMutation.mutate({
                            id: user.id,
                            status:
                              user.status === ACTIVE_STATUS
                                ? ARCHIVED_OR_DISABLED_STATUS
                                : ACTIVE_STATUS,
                          })
                        }
                      >
                        {user.status === ACTIVE_STATUS
                          ? t('admin.statuses.disabled')
                          : t('admin.statuses.active')}
                      </Button>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() =>
                          patchMutation.mutate({
                            id: user.id,
                            isSuperAdmin: !user.is_super_admin,
                          })
                        }
                      >
                        {t('admin.fields.superAdmin')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState preset='users' />
        )}
      </CollectionCard>
      <TokenTable
        title={t('admin.sections.userTokens')}
        description={selectedUser?.email ?? t('admin.placeholders.selectUser')}
        tokens={userTokenQuery.data?.items ?? []}
        emptyPreset='userTokens'
        onRevoke={(tokenId) =>
          selectedUserId &&
          revokeMutation.mutate({ userId: selectedUserId, tokenId })
        }
      />
    </PageChrome>
  )
}

export function TeamsPage() {
  const { t } = useLanguage()
  const invalidate = useInvalidateAll()
  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: listTeams })
  const createMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: invalidate,
  })
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      name,
      description,
    }: {
      id: string
      name: string
      description: string
    }) => updateTeam(id, { name, description }),
    onSuccess: invalidate,
  })
  const archiveMutation = useMutation({
    mutationFn: archiveTeam,
    onSuccess: invalidate,
  })
  return (
    <EntityPage
      page='teams'
      createTitle={t('admin.sections.createTeam')}
      queryState={{
        isLoading: teamsQuery.isLoading,
        isError: teamsQuery.isError,
        error: teamsQuery.error,
      }}
      onCreate={(formData) =>
        createMutation.mutate({
          name: fieldValue(formData, 'name'),
          description: fieldValue(formData, 'description'),
        })
      }
      createPending={createMutation.isPending}
    >
      <NameDescriptionTable
        emptyPreset='teams'
        items={teamsQuery.data?.items ?? []}
        onUpdate={(id, name, description) =>
          updateMutation.mutate({ id, name, description })
        }
        onArchive={(id) => archiveMutation.mutate(id)}
        pending={updateMutation.isPending || archiveMutation.isPending}
      />
    </EntityPage>
  )
}

function EntityPage({
  page,
  createTitle,
  queryState,
  children,
  onCreate,
  createPending,
}: {
  page: PageKey
  createTitle: string
  queryState: QueryState
  children: React.ReactNode
  onCreate: (formData: FormData) => void
  createPending: boolean
}) {
  const { t } = useLanguage()
  return (
    <PageChrome page={page}>
      <LoadingErrorState state={queryState} />
      <FormCard
        title={createTitle}
        submitLabel={t('admin.common.create')}
        pending={createPending}
        onSubmit={onCreate}
      >
        <div className='grid gap-4 md:grid-cols-2'>
          <TextField label={t('admin.fields.name')} name='name' required />
          <TextField label={t('admin.fields.description')} name='description' />
        </div>
      </FormCard>
      {children}
    </PageChrome>
  )
}

function NameDescriptionTable({
  items,
  onUpdate,
  onArchive,
  pending,
  emptyPreset,
}: {
  items: Array<TeamDTO | ProjectDTO>
  onUpdate: (id: string, name: string, description: string) => void
  onArchive: (id: string) => void
  pending: boolean
  emptyPreset: EmptyStatePreset
}) {
  const { t } = useLanguage()
  return (
    <CollectionCard
      title={emptyPreset === 'teams' ? t('nav.teams') : t('nav.projects')}
      count={items.length}
    >
      {items.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.fields.name')}</TableHead>
              <TableHead>{t('admin.fields.id')}</TableHead>
              <TableHead>{t('admin.fields.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className='min-w-80'>
                  <InlineNameDescriptionForm
                    item={item}
                    onUpdate={onUpdate}
                    pending={pending}
                  />
                </TableCell>
                <TableCell className='font-mono text-xs'>{item.id}</TableCell>
                <TableCell>
                  <Button
                    variant='outline'
                    size='sm'
                    disabled={pending}
                    onClick={() => onArchive(item.id)}
                  >
                    {t('admin.common.archive')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState preset={emptyPreset} />
      )}
    </CollectionCard>
  )
}

export function ProjectsPage() {
  const { t } = useLanguage()
  const invalidate = useInvalidateAll()
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  })
  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: listTeams })
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: listUsers })
  const [projectId, setProjectId] = useState('')
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => listProjectMembers(projectId),
    enabled: projectId.length > 0,
  })
  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: invalidate,
  })
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      name,
      description,
    }: {
      id: string
      name: string
      description: string
    }) => updateProject(id, { name, description }),
    onSuccess: invalidate,
  })
  const archiveMutation = useMutation({
    mutationFn: archiveProject,
    onSuccess: invalidate,
  })
  const addMemberMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: number }) =>
      addProjectMember(projectId, { user_id: userId, role }),
    onSuccess: invalidate,
  })
  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: number }) =>
      patchProjectMemberRole(projectId, userId, { role }),
    onSuccess: invalidate,
  })
  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeProjectMember(projectId, userId),
    onSuccess: invalidate,
  })
  const teamOptions =
    teamsQuery.data?.items.map((team) => ({
      value: team.id,
      label: team.name,
    })) ?? []
  const userOptions =
    usersQuery.data?.items.map((user) => ({
      value: user.id,
      label: user.email,
    })) ?? []
  const projectOptions =
    projectsQuery.data?.items.map((project) => ({
      value: project.id,
      label: project.name,
    })) ?? []
  return (
    <PageChrome page='projects'>
      <LoadingErrorState
        state={{
          isLoading: projectsQuery.isLoading,
          isError: projectsQuery.isError,
          error: projectsQuery.error,
        }}
      />
      <FormCard
        title={t('admin.sections.createProject')}
        submitLabel={t('admin.common.create')}
        pending={createMutation.isPending}
        onSubmit={(formData) =>
          createMutation.mutate({
            team_id: fieldValue(formData, 'team_id'),
            admin_user_id: fieldValue(formData, 'admin_user_id'),
            name: fieldValue(formData, 'name'),
            description: fieldValue(formData, 'description'),
          })
        }
      >
        <div className='grid gap-4 md:grid-cols-2'>
          <NativeSelect
            name='team_id'
            label={t('admin.fields.team')}
            placeholder={t('admin.placeholders.selectProject')}
            options={teamOptions}
          />
          <NativeSelect
            name='admin_user_id'
            label={t('admin.fields.user')}
            placeholder={t('admin.placeholders.selectUser')}
            options={userOptions}
          />
          <TextField label={t('admin.fields.name')} name='name' required />
          <TextField label={t('admin.fields.description')} name='description' />
        </div>
      </FormCard>
      <NameDescriptionTable
        emptyPreset='projects'
        items={projectsQuery.data?.items ?? []}
        onUpdate={(id, name, description) =>
          updateMutation.mutate({ id, name, description })
        }
        onArchive={(id) => archiveMutation.mutate(id)}
        pending={updateMutation.isPending || archiveMutation.isPending}
      />
      <CollectionCard
        title={t('admin.sections.members')}
        description={t('admin.pages.projects.next')}
        count={membersQuery.data?.items.length ?? 0}
      >
        <NativeSelect
          label={t('admin.fields.project')}
          value={projectId}
          onChange={setProjectId}
          placeholder={t('admin.placeholders.selectProject')}
          options={projectOptions}
        />
        <form
          className='grid gap-3 md:grid-cols-[1fr_12rem_auto]'
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)
            addMemberMutation.mutate({
              userId: fieldValue(formData, 'user_id'),
              role: numberValue(formData, 'role', ROLE_READER),
            })
            event.currentTarget.reset()
          }}
        >
          <NativeSelect
            name='user_id'
            label={t('admin.fields.user')}
            placeholder={t('admin.placeholders.selectUser')}
            options={userOptions}
          />
          <NativeSelect
            name='role'
            label={t('admin.fields.role')}
            placeholder={t('admin.roles.reader')}
            options={roleOptions(t)}
          />
          <Button
            type='submit'
            className='self-end'
            disabled={!projectId || addMemberMutation.isPending}
          >
            {t('admin.common.create')}
          </Button>
        </form>
        <MembersTable
          members={membersQuery.data?.items ?? []}
          users={usersQuery.data?.items ?? []}
          onRole={(userId, role) => roleMutation.mutate({ userId, role })}
          onRemove={(userId) => removeMutation.mutate(userId)}
        />
      </CollectionCard>
    </PageChrome>
  )
}

function roleOptions(t: ReturnType<typeof useLanguage>['t']) {
  return [
    { value: String(ROLE_READER), label: t('admin.roles.reader') },
    { value: String(ROLE_WRITER), label: t('admin.roles.writer') },
    { value: String(ROLE_ADMIN), label: t('admin.roles.admin') },
  ]
}

function MembersTable({
  members,
  users,
  onRole,
  onRemove,
}: {
  members: Awaited<ReturnType<typeof listProjectMembers>>['items']
  users: UserDTO[]
  onRole: (userId: string, role: number) => void
  onRemove: (userId: string) => void
}) {
  const { t } = useLanguage()
  const userEmail = (userId: string) =>
    users.find((user) => user.id === userId)?.email ?? userId
  return members.length ? (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.fields.user')}</TableHead>
          <TableHead>{t('admin.fields.role')}</TableHead>
          <TableHead>{t('admin.fields.status')}</TableHead>
          <TableHead>{t('admin.fields.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.user_id}>
            <TableCell>{userEmail(member.user_id)}</TableCell>
            <TableCell>
              <select
                className='h-9 rounded-md border border-input bg-background px-3 text-sm'
                value={String(member.role)}
                onChange={(event) =>
                  onRole(member.user_id, Number(event.currentTarget.value))
                }
              >
                {roleOptions(t).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </TableCell>
            <TableCell>
              <StatusBadge>{statusLabel(member.status, t)}</StatusBadge>
            </TableCell>
            <TableCell>
              <Button
                variant='outline'
                size='sm'
                onClick={() => onRemove(member.user_id)}
              >
                {t('admin.common.archive')}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ) : (
    <EmptyState preset='members' />
  )
}

export function DocumentsPage() {
  const { t } = useLanguage()
  const invalidate = useInvalidateAll()
  const { projectsQuery, projectId, setProjectId, projectOptions } =
    useProjectsAndSelection()
  const { documentsQuery, documentId, setDocumentId, documentOptions } =
    useDocumentsAndSelection(projectId)
  const branchesQuery = useQuery({
    queryKey: ['branches', projectId, documentId],
    queryFn: () => listBranches(projectId, documentId),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const createDocumentMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createDocument>[1]) =>
      createDocument(projectId, payload),
    onSuccess: invalidate,
  })
  const updateDocumentMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: Parameters<typeof updateDocument>[2]
    }) => updateDocument(projectId, id, payload),
    onSuccess: invalidate,
  })
  const archiveDocumentMutation = useMutation({
    mutationFn: (id: string) => archiveDocument(projectId, id),
    onSuccess: invalidate,
  })
  const createBranchMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createBranch>[2]) =>
      createBranch(projectId, documentId, payload),
    onSuccess: invalidate,
  })
  const updateBranchMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: Parameters<typeof updateBranch>[3]
    }) => updateBranch(projectId, documentId, id, payload),
    onSuccess: invalidate,
  })
  const archiveBranchMutation = useMutation({
    mutationFn: (id: string) => archiveBranch(projectId, documentId, id),
    onSuccess: invalidate,
  })
  return (
    <PageChrome page='documents'>
      <LoadingErrorState
        state={{
          isLoading: projectsQuery.isLoading || documentsQuery.isLoading,
          isError: projectsQuery.isError || documentsQuery.isError,
          error: projectsQuery.error ?? documentsQuery.error,
        }}
      />
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
      <FormCard
        title={t('admin.sections.createDocument')}
        submitLabel={t('admin.common.create')}
        pending={createDocumentMutation.isPending}
        onSubmit={(formData) =>
          createDocumentMutation.mutate({
            name: fieldValue(formData, 'name'),
            description: fieldValue(formData, 'description'),
            relative_path: fieldValue(formData, 'relative_path'),
            document_type: numberValue(
              formData,
              'document_type',
              DOCUMENT_TYPE_OPENAPI
            ),
          })
        }
      >
        <div className='grid gap-4 md:grid-cols-2'>
          <TextField label={t('admin.fields.name')} name='name' required />
          <TextField
            label={t('admin.fields.relativePath')}
            name='relative_path'
            required
          />
          <NativeSelect
            name='document_type'
            label={t('admin.fields.type')}
            placeholder={t('admin.types.openapi')}
            options={documentTypeOptions(t)}
          />
          <TextField label={t('admin.fields.description')} name='description' />
        </div>
      </FormCard>
      <DocumentsTable
        documents={documentsQuery.data?.items ?? []}
        onUpdate={(document) =>
          updateDocumentMutation.mutate({
            id: document.id,
            payload: {
              name: document.name,
              description: document.description ?? '',
              relative_path: document.relative_path ?? '',
              document_type: document.document_type,
              status: document.status,
            },
          })
        }
        onArchive={(id) => archiveDocumentMutation.mutate(id)}
      />
      <FormCard
        title={t('admin.sections.createBranch')}
        submitLabel={t('admin.common.create')}
        pending={createBranchMutation.isPending}
        onSubmit={(formData) =>
          createBranchMutation.mutate({
            name: fieldValue(formData, 'name'),
            description: fieldValue(formData, 'description'),
          })
        }
      >
        <div className='grid gap-4 md:grid-cols-2'>
          <TextField label={t('admin.fields.name')} name='name' required />
          <TextField label={t('admin.fields.description')} name='description' />
        </div>
      </FormCard>
      <BranchesTable
        branches={branchesQuery.data?.items ?? []}
        onUpdate={(branch) =>
          updateBranchMutation.mutate({
            id: branch.id,
            payload: {
              name: branch.name,
              description: branch.description ?? '',
              is_default: branch.is_default,
              is_protected: branch.is_protected,
            },
          })
        }
        onArchive={(id) => archiveBranchMutation.mutate(id)}
      />
    </PageChrome>
  )
}

function documentTypeOptions(t: ReturnType<typeof useLanguage>['t']) {
  return [
    { value: String(DOCUMENT_TYPE_OPENAPI), label: t('admin.types.openapi') },
    { value: String(DOCUMENT_TYPE_MARKDOWN), label: t('admin.types.markdown') },
  ]
}

function DocumentsTable({
  documents,
  onUpdate,
  onArchive,
}: {
  documents: DocumentDTO[]
  onUpdate: (document: DocumentDTO) => void
  onArchive: (id: string) => void
}) {
  const { t } = useLanguage()
  return (
    <CollectionCard title={t('nav.documents')} count={documents.length}>
      {documents.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.fields.name')}</TableHead>
              <TableHead>{t('admin.fields.type')}</TableHead>
              <TableHead>{t('admin.fields.status')}</TableHead>
              <TableHead>{t('admin.fields.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((document) => (
              <TableRow key={document.id}>
                <TableCell>
                  <div className='font-medium'>{document.name}</div>
                  <div className='text-xs text-muted-foreground'>
                    {document.relative_path}
                  </div>
                </TableCell>
                <TableCell>
                  {documentTypeLabel(document.document_type, t)}
                </TableCell>
                <TableCell>
                  <StatusBadge>{statusLabel(document.status, t)}</StatusBadge>
                </TableCell>
                <TableCell>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => onUpdate(document)}
                    >
                      {t('admin.common.update')}
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => onArchive(document.id)}
                    >
                      {t('admin.common.archive')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState preset='documents' />
      )}
    </CollectionCard>
  )
}

function BranchesTable({
  branches,
  onUpdate,
  onArchive,
}: {
  branches: BranchDTO[]
  onUpdate: (branch: BranchDTO) => void
  onArchive: (id: string) => void
}) {
  const { t } = useLanguage()
  return (
    <CollectionCard
      title={t('admin.sections.branches')}
      count={branches.length}
    >
      {branches.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.fields.name')}</TableHead>
              <TableHead>{t('admin.fields.status')}</TableHead>
              <TableHead>{t('admin.fields.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell>
                  <div className='font-medium'>{branch.name}</div>
                  <div className='text-xs text-muted-foreground'>
                    {branch.description}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge>{statusLabel(branch.status, t)}</StatusBadge>
                </TableCell>
                <TableCell>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => onUpdate(branch)}
                    >
                      {t('admin.common.update')}
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => onArchive(branch.id)}
                    >
                      {t('admin.common.archive')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState preset='branches' />
      )}
    </CollectionCard>
  )
}

export function DraftsPage() {
  const { t } = useLanguage()
  const invalidate = useInvalidateAll()
  const { projectId, setProjectId, projectOptions } = useProjectsAndSelection()
  const { documentId, selectedDocument, setDocumentId, documentOptions } =
    useDocumentsAndSelection(projectId)
  const branchesQuery = useQuery({
    queryKey: ['branches', projectId, documentId],
    queryFn: () => listBranches(projectId, documentId),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const draftsQuery = useQuery({
    queryKey: ['drafts', projectId, documentId],
    queryFn: () => listDrafts(projectId, documentId),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const [draftId, setDraftId] = useState('')
  const [contentKind, setContentKind] = useState('raw')
  const draftExistsInDocument = (draftsQuery.data?.items ?? []).some(
    (draft) => draft.id === draftId
  )
  const draftContentKindOptions = contentKindOptions(
    t,
    selectedDocument?.document_type === DOCUMENT_TYPE_MARKDOWN
  )
  const activeDraftContentKind = activeContentKind(
    contentKind,
    draftContentKindOptions
  )
  const contentQuery = useQuery({
    queryKey: [
      'draft-content',
      projectId,
      documentId,
      draftId,
      activeDraftContentKind,
    ],
    queryFn: () =>
      getDraftContent(projectId, documentId, draftId, activeDraftContentKind),
    enabled:
      projectId.length > 0 &&
      documentId.length > 0 &&
      draftId.length > 0 &&
      draftExistsInDocument,
  })
  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createDraft>[2]) =>
      createDraft(projectId, documentId, payload),
    onSuccess: invalidate,
  })
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: Parameters<typeof updateDraft>[3]
    }) => updateDraft(projectId, documentId, id, payload),
    onSuccess: invalidate,
  })
  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: DraftAction }) =>
      runDraftAction(projectId, documentId, id, action),
    onSuccess: invalidate,
  })
  const handleProjectChange = (value: string) => {
    setDraftId('')
    setContentKind('raw')
    setProjectId(value)
  }
  const handleDocumentChange = (value: string) => {
    setDraftId('')
    setContentKind('raw')
    setDocumentId(value)
  }
  return (
    <PageChrome page='drafts'>
      <SelectorGrid>
        <NativeSelect
          label={t('admin.fields.project')}
          value={projectId}
          onChange={handleProjectChange}
          placeholder={t('admin.placeholders.selectProject')}
          options={projectOptions}
        />
        <NativeSelect
          label={t('admin.fields.document')}
          value={documentId}
          onChange={handleDocumentChange}
          placeholder={t('admin.placeholders.selectDocument')}
          options={documentOptions}
        />
        <NativeSelect
          label={t('admin.fields.draft')}
          value={draftId}
          onChange={setDraftId}
          placeholder={t('admin.fields.draft')}
          options={
            draftsQuery.data?.items.map((draft) => ({
              value: draft.id,
              label: draft.version_name,
            })) ?? []
          }
        />
      </SelectorGrid>
      <FormCard
        title={t('admin.sections.createDraft')}
        submitLabel={
          draftId ? t('admin.common.update') : t('admin.common.create')
        }
        pending={createMutation.isPending || updateMutation.isPending}
        onSubmit={(formData) => {
          const payload = {
            branch_id: fieldValue(formData, 'branch_id'),
            version_name: fieldValue(formData, 'version_name'),
            changelog: fieldValue(formData, 'changelog'),
            source_git_commit_id: fieldValue(formData, 'source_git_commit_id'),
            content: fieldValue(formData, 'content'),
            schema_content: fieldValue(formData, 'content'),
          }
          if (draftId) updateMutation.mutate({ id: draftId, payload })
          else createMutation.mutate(payload)
        }}
      >
        <div className='grid gap-4 md:grid-cols-2'>
          <NativeSelect
            name='branch_id'
            label={t('admin.fields.branch')}
            placeholder={t('admin.placeholders.selectBranch')}
            options={
              branchesQuery.data?.items.map((branch) => ({
                value: branch.id,
                label: branch.name,
              })) ?? []
            }
          />
          <TextField
            label={t('admin.fields.versionName')}
            name='version_name'
            required
          />
          <TextField
            label={t('admin.fields.gitCommit')}
            name='source_git_commit_id'
          />
          <TextField label={t('admin.fields.changelog')} name='changelog' />
        </div>
        <TextAreaField
          label={t('admin.fields.content')}
          name='content'
          required
        />
      </FormCard>
      <DraftsTable
        drafts={draftsQuery.data?.items ?? []}
        selected={draftId}
        onSelect={setDraftId}
        onAction={(id, action) => actionMutation.mutate({ id, action })}
      />
      <SelectorGrid>
        <NativeSelect
          label={t('admin.fields.contentKind')}
          value={activeDraftContentKind}
          onChange={setContentKind}
          placeholder={t('admin.types.raw')}
          options={draftContentKindOptions}
        />
      </SelectorGrid>
      <ContentViewer
        title={t('admin.sections.contentViewer')}
        content={
          contentQuery.data?.content ??
          selectedDraftInlineContent(
            draftsQuery.data?.items,
            draftId,
            activeDraftContentKind
          )
        }
      />
    </PageChrome>
  )
}

function runDraftAction(
  projectId: string,
  documentId: string,
  draftId: string,
  action: DraftAction
) {
  if (action === 'submit') return submitDraft(projectId, documentId, draftId)
  if (action === 'approve') return approveDraft(projectId, documentId, draftId)
  if (action === 'request')
    return requestDraftChanges(projectId, documentId, draftId)
  return rejectDraft(projectId, documentId, draftId)
}

function contentKindOptions(
  t: ReturnType<typeof useLanguage>['t'],
  isMarkdownDocument: boolean
) {
  if (isMarkdownDocument) {
    return [
      { value: 'raw', label: t('admin.types.raw') },
      { value: 'stable', label: t('admin.types.stable') },
    ]
  }
  return [
    { value: 'raw', label: t('admin.types.raw') },
    { value: 'normalized', label: t('admin.types.normalized') },
  ]
}

function activeContentKind(contentKind: string, options: SelectOption[]) {
  return options.some((option) => option.value === contentKind)
    ? contentKind
    : 'raw'
}

function selectedDraftInlineContent(
  drafts: DraftDTO[] | undefined,
  draftId: string,
  contentKind: string
) {
  const draft = drafts?.find((value) => value.id === draftId)
  if (!draft) return undefined
  return contentKind === 'raw'
    ? (draft.raw_content ?? draft.raw_schema)
    : (draft.normalized_content ?? draft.normalized_schema)
}

function DraftsTable({
  drafts,
  selected,
  onSelect,
  onAction,
}: {
  drafts: DraftDTO[]
  selected: string
  onSelect: (id: string) => void
  onAction: (id: string, action: DraftAction) => void
}) {
  const { t } = useLanguage()
  return (
    <CollectionCard title={t('admin.sections.drafts')} count={drafts.length}>
      {drafts.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.fields.versionName')}</TableHead>
              <TableHead>{t('admin.fields.status')}</TableHead>
              <TableHead>{t('admin.fields.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drafts.map((draft) => (
              <TableRow
                key={draft.id}
                data-state={selected === draft.id ? 'selected' : undefined}
              >
                <TableCell>
                  <button
                    type='button'
                    className='font-medium underline-offset-4 hover:underline'
                    onClick={() => onSelect(draft.id)}
                  >
                    {draft.version_name}
                  </button>
                  <div className='text-xs text-muted-foreground'>
                    {draft.changelog}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge>{draftStatusLabel(draft.status, t)}</StatusBadge>
                </TableCell>
                <TableCell>
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => onSelect(draft.id)}
                    >
                      {t('admin.common.view')}
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => onAction(draft.id, 'submit')}
                    >
                      {t('admin.common.submit')}
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      disabled={draft.status !== DRAFT_STATUS_SUBMITTED}
                      onClick={() => onAction(draft.id, 'approve')}
                    >
                      {t('admin.common.approve')}
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => onAction(draft.id, 'request')}
                    >
                      {t('admin.common.requestChanges')}
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => onAction(draft.id, 'reject')}
                    >
                      {t('admin.common.reject')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState preset='drafts' />
      )}
    </CollectionCard>
  )
}

export function VersionsPage() {
  const { t } = useLanguage()
  const { projectId, setProjectId, projectOptions } = useProjectsAndSelection()
  const { documentId, selectedDocument, setDocumentId, documentOptions } =
    useDocumentsAndSelection(projectId)
  const { versionsQuery, versionId, setVersionId, versionOptions } =
    useVersionsAndSelection(projectId, documentId)
  const [contentKind, setContentKind] = useState('raw')
  const versionContentKindOptions = contentKindOptions(
    t,
    selectedDocument?.document_type === DOCUMENT_TYPE_MARKDOWN
  )
  const activeVersionContentKind = activeContentKind(
    contentKind,
    versionContentKindOptions
  )
  const [endpointSearchQuery, setEndpointSearchQuery] = useState('')
  const [endpointId, setEndpointId] = useState('')
  const [endpointGroupMode, setEndpointGroupMode] =
    useState<EndpointGroupMode>('tag')
  const contentQuery = useQuery({
    queryKey: [
      'version-content',
      projectId,
      documentId,
      versionId,
      activeVersionContentKind,
    ],
    queryFn: () =>
      getVersionContent(
        projectId,
        documentId,
        versionId,
        activeVersionContentKind
      ),
    enabled:
      projectId.length > 0 && documentId.length > 0 && versionId.length > 0,
  })
  const endpointsQuery = useQuery({
    queryKey: ['endpoints', projectId, documentId, versionId],
    queryFn: () => listEndpoints(projectId, documentId, versionId),
    enabled:
      projectId.length > 0 && documentId.length > 0 && versionId.length > 0,
  })
  const endpointSearch = endpointSearchQuery.trim().toLowerCase()
  const untaggedLabel = t('admin.developerPortal.untagged')
  const visibleEndpoints = (endpointsQuery.data?.items ?? []).filter(
    (endpoint) =>
      endpointSearch.length === 0 ||
      endpointSearchText(endpoint).includes(endpointSearch)
  )
  const endpointExistsInVersion = (endpointsQuery.data?.items ?? []).some(
    (endpoint) => endpoint.id === endpointId
  )
  const endpointQuery = useQuery({
    queryKey: ['endpoint', projectId, documentId, versionId, endpointId],
    queryFn: () => getEndpoint(projectId, documentId, versionId, endpointId),
    enabled:
      projectId.length > 0 &&
      documentId.length > 0 &&
      versionId.length > 0 &&
      endpointExistsInVersion,
  })
  const methodCount = new Set(
    visibleEndpoints.map((endpoint) => endpoint.method)
  ).size
  const tagCount = new Set(
    visibleEndpoints.flatMap((endpoint) =>
      endpointTags(endpoint, untaggedLabel)
    )
  ).size
  const selectedEndpointVisible = visibleEndpoints.some(
    (endpoint) => endpoint.id === endpointId
  )
  const clearEndpointSelection = () => {
    setEndpointId('')
  }
  const handleProjectChange = (value: string) => {
    clearEndpointSelection()
    setProjectId(value)
  }
  const handleDocumentChange = (value: string) => {
    clearEndpointSelection()
    setContentKind('raw')
    setDocumentId(value)
  }
  const handleVersionChange = (value: string) => {
    clearEndpointSelection()
    setVersionId(value)
  }
  return (
    <PageChrome page='versions'>
      <SelectorGrid>
        <NativeSelect
          label={t('admin.fields.project')}
          value={projectId}
          onChange={handleProjectChange}
          placeholder={t('admin.placeholders.selectProject')}
          options={projectOptions}
        />
        <NativeSelect
          label={t('admin.fields.document')}
          value={documentId}
          onChange={handleDocumentChange}
          placeholder={t('admin.placeholders.selectDocument')}
          options={documentOptions}
        />
        <NativeSelect
          label={t('admin.fields.version')}
          value={versionId}
          onChange={handleVersionChange}
          placeholder={t('admin.placeholders.selectVersion')}
          options={versionOptions}
        />
      </SelectorGrid>
      <VersionsTable
        versions={versionsQuery.data?.items ?? []}
        selected={versionId}
        onSelect={handleVersionChange}
      />
      <section className='grid gap-4 sm:grid-cols-3'>
        <StatCard
          title={t('admin.developerPortal.endpointCount')}
          value={String(endpointsQuery.data?.total ?? visibleEndpoints.length)}
          description={t('admin.developerPortal.endpointCountDescription')}
        />
        <StatCard
          title={t('admin.developerPortal.methodCount')}
          value={String(methodCount)}
          description={t('admin.developerPortal.methodCountDescription')}
        />
        <StatCard
          title={t('admin.developerPortal.tagCount')}
          value={String(tagCount)}
          description={t('admin.developerPortal.tagCountDescription')}
        />
      </section>
      <SelectorGrid>
        <NativeSelect
          label={t('admin.fields.contentKind')}
          value={activeVersionContentKind}
          onChange={setContentKind}
          placeholder={t('admin.types.raw')}
          options={versionContentKindOptions}
        />
        <div className='grid gap-2'>
          <Label htmlFor='endpoint-search'>
            {t('admin.developerPortal.searchLabel')}
          </Label>
          <div className='relative'>
            <SearchIcon className='pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              id='endpoint-search'
              value={endpointSearchQuery}
              onChange={(event) =>
                setEndpointSearchQuery(event.currentTarget.value)
              }
              placeholder={t('admin.developerPortal.searchPlaceholder')}
              className='ps-9'
            />
          </div>
        </div>
        <NativeSelect
          label={t('admin.developerPortal.groupBy')}
          value={endpointGroupMode}
          onChange={(value) =>
            setEndpointGroupMode(parseEndpointGroupMode(value))
          }
          placeholder={t('admin.developerPortal.groupByTag')}
          options={[
            { value: 'tag', label: t('admin.developerPortal.groupByTag') },
            {
              value: 'method',
              label: t('admin.developerPortal.groupByMethod'),
            },
          ]}
        />
      </SelectorGrid>
      <ContentViewer
        title={t('admin.sections.contentViewer')}
        content={
          contentQuery.data?.content ??
          selectedVersionInlineContent(
            versionsQuery.data?.items,
            versionId,
            activeVersionContentKind
          )
        }
      />
      <EndpointsCard
        endpoints={visibleEndpoints}
        selected={endpointId}
        onSelect={setEndpointId}
        detail={selectedEndpointVisible ? endpointQuery.data : undefined}
        groupMode={endpointGroupMode}
        untaggedLabel={untaggedLabel}
      />
    </PageChrome>
  )
}

function selectedVersionInlineContent(
  versions: VersionDTO[] | undefined,
  versionId: string,
  contentKind: string
) {
  const version = versions?.find((value) => value.id === versionId)
  if (!version) return undefined
  return contentKind === 'raw'
    ? (version.raw_content ?? version.raw_schema)
    : (version.normalized_content ?? version.normalized_schema)
}

function VersionsTable({
  versions,
  selected,
  onSelect,
}: {
  versions: VersionDTO[]
  selected: string
  onSelect: (id: string) => void
}) {
  const { t } = useLanguage()
  return (
    <CollectionCard
      title={t('admin.sections.versions')}
      count={versions.length}
    >
      {versions.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.fields.versionName')}</TableHead>
              <TableHead>{t('admin.fields.status')}</TableHead>
              <TableHead>{t('admin.fields.createdAt')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.map((version) => (
              <TableRow
                key={version.id}
                data-state={selected === version.id ? 'selected' : undefined}
              >
                <TableCell>
                  <button
                    type='button'
                    className='font-medium underline-offset-4 hover:underline'
                    onClick={() => onSelect(version.id)}
                  >
                    {version.version_name}
                  </button>
                  <div className='text-xs text-muted-foreground'>
                    {version.changelog}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge>{statusLabel(version.status, t)}</StatusBadge>
                </TableCell>
                <TableCell>{formatDate(version.published_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState preset='versions' />
      )}
    </CollectionCard>
  )
}

function EndpointsCard({
  endpoints,
  selected,
  onSelect,
  detail,
  groupMode,
  untaggedLabel,
}: {
  endpoints: EndpointSummaryDTO[]
  selected: string
  onSelect: (id: string) => void
  detail?: EndpointDTO
  groupMode: EndpointGroupMode
  untaggedLabel: string
}) {
  const { t } = useLanguage()
  const groupedEndpoints = useMemo(() => {
    const groups = new Map<string, EndpointSummaryDTO[]>()
    endpoints.forEach((endpoint) => {
      const keys =
        groupMode === 'method'
          ? [methodLabel(endpoint.method)]
          : endpointTags(endpoint, untaggedLabel)
      keys.forEach((key) => {
        const group = groups.get(key) ?? []
        group.push(endpoint)
        groups.set(key, group)
      })
    })
    return Array.from(groups.entries()).sort(([left], [right]) =>
      left.localeCompare(right)
    )
  }, [endpoints, groupMode, untaggedLabel])

  return (
    <CollectionCard
      title={t('admin.sections.endpoints')}
      description={t('admin.developerPortal.endpointBrowserDescription')}
      count={endpoints.length}
    >
      {groupedEndpoints.length ? (
        groupedEndpoints.map(([group, groupEndpoints]) => (
          <section
            key={group}
            className='grid gap-3 rounded-md border bg-[var(--surface-control)] p-4'
          >
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div>
                <p className='font-medium'>{group}</p>
                <p className='text-xs text-muted-foreground'>
                  {groupEndpoints.length} {t('admin.common.endpoint')}
                </p>
              </div>
              <Badge variant='secondary'>
                {groupMode === 'method'
                  ? t('admin.fields.method')
                  : t('admin.developerPortal.tag')}
              </Badge>
            </div>
            <div className='grid gap-2'>
              {groupEndpoints.map((endpoint) => (
                <button
                  key={`${group}-${endpoint.id}`}
                  type='button'
                  data-state={selected === endpoint.id ? 'selected' : undefined}
                  className='grid gap-3 rounded-md border bg-background p-3 text-start transition-colors hover:bg-muted/40 data-[state=selected]:border-primary data-[state=selected]:bg-primary/8 md:grid-cols-[7rem_1fr]'
                  onClick={() => onSelect(endpoint.id)}
                >
                  <div className='flex items-start gap-2'>
                    <Badge variant='outline'>
                      {methodLabel(endpoint.method)}
                    </Badge>
                  </div>
                  <div className='grid gap-2'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <code className='font-mono text-xs'>{endpoint.path}</code>
                      {endpoint.deprecated && (
                        <Badge variant='secondary'>
                          {t('admin.developerPortal.deprecated')}
                        </Badge>
                      )}
                    </div>
                    <p className='text-sm text-muted-foreground'>
                      {endpoint.summary ??
                        endpoint.operation_id ??
                        t('admin.developerPortal.noEndpointSummary')}
                    </p>
                    <div className='flex flex-wrap gap-1.5'>
                      {endpointTags(endpoint, untaggedLabel).map((tag) => (
                        <Badge key={tag} variant='secondary'>
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))
      ) : (
        <EmptyState preset='endpoints' />
      )}
      {detail && <EndpointDetailPanel endpoint={detail} />}
    </CollectionCard>
  )
}

function EndpointDetailPanel({ endpoint }: { endpoint: EndpointDTO }) {
  const { t } = useLanguage()
  const untaggedLabel = t('admin.developerPortal.untagged')
  return (
    <Card className='border-primary/20'>
      <CardHeader>
        <CardTitle className='flex flex-wrap items-center gap-2'>
          <Badge variant='outline'>{methodLabel(endpoint.method)}</Badge>
          <code className='font-mono text-sm'>{endpoint.path}</code>
        </CardTitle>
        <CardDescription>
          {endpoint.summary ??
            endpoint.operation_id ??
            t('admin.developerPortal.noEndpointSummary')}
        </CardDescription>
      </CardHeader>
      <CardContent className='grid gap-4'>
        <section className='grid gap-3 md:grid-cols-2'>
          <div className='rounded-lg border p-3'>
            <p className='text-xs font-medium text-muted-foreground'>
              {t('admin.developerPortal.operationId')}
            </p>
            <p className='mt-1 font-mono text-sm'>
              {endpoint.operation_id ?? t('admin.common.none')}
            </p>
          </div>
          <div className='rounded-lg border p-3'>
            <p className='text-xs font-medium text-muted-foreground'>
              {t('admin.developerPortal.tags')}
            </p>
            <div className='mt-2 flex flex-wrap gap-1.5'>
              {endpointTags(endpoint, untaggedLabel).map((tag) => (
                <Badge key={tag} variant='secondary'>
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </section>
        <EndpointJsonSection
          title={t('admin.fields.request')}
          rows={[
            [t('admin.developerPortal.parameters'), endpoint.parameters],
            [t('admin.developerPortal.requestBody'), endpoint.request_body],
          ]}
        />
        <EndpointJsonSection
          title={t('admin.fields.response')}
          rows={[[t('admin.developerPortal.responses'), endpoint.responses]]}
        />
        <EndpointJsonSection
          title={t('admin.developerPortal.runtime')}
          rows={[
            [t('admin.developerPortal.security'), endpoint.security],
            [t('admin.developerPortal.servers'), endpoint.servers],
            [t('admin.developerPortal.schemaRefs'), endpoint.schema_refs],
            [
              t('admin.developerPortal.normalizedOperation'),
              endpoint.normalized_operation,
            ],
          ]}
        />
      </CardContent>
    </Card>
  )
}

function EndpointJsonSection({
  title,
  rows,
}: {
  title: string
  rows: Array<[string, unknown]>
}) {
  return (
    <section className='grid gap-3 rounded-md border bg-[var(--surface-control)] p-4'>
      <p className='font-medium'>{title}</p>
      <div className='grid gap-3'>
        {rows.map(([label, value]) => (
          <div key={label} className='grid gap-2'>
            <p className='text-xs font-medium text-muted-foreground'>{label}</p>
            <pre className='max-h-80 overflow-auto rounded-md border bg-background p-3 text-xs leading-relaxed'>
              {jsonPreview(value)}
            </pre>
          </div>
        ))}
      </div>
    </section>
  )
}

export function DiffsPage() {
  const { t } = useLanguage()
  const { projectId, setProjectId, projectOptions } = useProjectsAndSelection()
  const { documentId, setDocumentId, documentOptions } =
    useDocumentsAndSelection(projectId)
  const { versionOptions } = useVersionsAndSelection(projectId, documentId)
  const [diff, setDiff] = useState<DiffDTO | null>(null)
  const [fromVersionId, setFromVersionId] = useState('')
  const [toVersionId, setToVersionId] = useState('')
  const [diffSearch, setDiffSearch] = useState('')
  const [diffFilterValue, setDiffFilterValue] = useState<DiffFilter>('all')
  const validVersionIds = useMemo(
    () => new Set(versionOptions.map((option) => option.value)),
    [versionOptions]
  )
  const selectedFromVersionId = validVersionIds.has(fromVersionId)
    ? fromVersionId
    : ''
  const selectedToVersionId = validVersionIds.has(toVersionId)
    ? toVersionId
    : ''
  const activeDiff =
    diff?.document_id === documentId &&
    diff.from_version_id === selectedFromVersionId &&
    diff.to_version_id === selectedToVersionId
      ? diff
      : null
  const diffMutation = useMutation({
    mutationFn: () =>
      compareDiff(projectId, documentId, {
        from_version_id: selectedFromVersionId,
        to_version_id: selectedToVersionId,
      }),
    onSuccess: setDiff,
  })
  const summaryQuery = useQuery({
    queryKey: ['diff-summary', projectId, documentId, activeDiff?.id],
    queryFn: () => getDiffSummary(projectId, documentId, activeDiff?.id ?? ''),
    enabled: Boolean(activeDiff?.id),
  })
  const summary = summaryQuery.data ?? activeDiff?.summary
  const searchText = diffSearch.trim().toLowerCase()
  const visibleItems = (activeDiff?.items ?? []).filter((item) => {
    const matchesSearch =
      searchText.length === 0 ||
      [
        item.method,
        item.path,
        item.operation_id,
        item.location,
        item.message,
        item.frontend_impact,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(searchText)
    const matchesFilter =
      diffFilterValue === 'all' ||
      (diffFilterValue === 'breaking' && item.is_breaking) ||
      (diffFilterValue === 'mustHandle' && item.must_handle) ||
      (diffFilterValue === 'high' && item.severity >= 3)
    return matchesSearch && matchesFilter
  })

  return (
    <PageChrome page='diffs'>
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
        <NativeSelect
          label={t('admin.fields.fromVersion')}
          value={selectedFromVersionId}
          onChange={setFromVersionId}
          placeholder={t('admin.placeholders.selectVersion')}
          options={versionOptions}
        />
        <NativeSelect
          label={t('admin.fields.toVersion')}
          value={selectedToVersionId}
          onChange={setToVersionId}
          placeholder={t('admin.placeholders.selectVersion')}
          options={versionOptions}
        />
      </SelectorGrid>
      <div className='flex flex-wrap items-center gap-3'>
        <Button
          className='w-fit'
          disabled={
            !selectedFromVersionId ||
            !selectedToVersionId ||
            diffMutation.isPending
          }
          onClick={() => diffMutation.mutate()}
        >
          <GitCompareArrows className='size-4' />
          {t('admin.common.compare')}
        </Button>
        <p className='text-sm text-muted-foreground'>
          {t('admin.diff.compareHint')}
        </p>
      </div>
      <CollectionCard
        title={t('admin.sections.diffResult')}
        description={activeDiff?.id ?? t('admin.diff.noDiffSelected')}
        count={visibleItems.length}
      >
        {summary && (
          <section className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <StatCard
              title={t('admin.diff.addedEndpoints')}
              value={String(summary.added_endpoints)}
              description={t('admin.diff.addedDescription')}
            />
            <StatCard
              title={t('admin.diff.removedEndpoints')}
              value={String(summary.removed_endpoints)}
              description={t('admin.diff.removedDescription')}
            />
            <StatCard
              title={t('admin.diff.modifiedEndpoints')}
              value={String(summary.modified_endpoints)}
              description={t('admin.diff.modifiedDescription')}
            />
            <StatCard
              title={t('admin.diff.breakingChanges')}
              value={String(summary.breaking_changes)}
              description={t('admin.diff.breakingDescription')}
            />
          </section>
        )}
        <SelectorGrid>
          <div className='grid gap-2'>
            <Label htmlFor='diff-search'>{t('admin.diff.searchLabel')}</Label>
            <div className='relative'>
              <SearchIcon className='pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                id='diff-search'
                value={diffSearch}
                onChange={(event) => setDiffSearch(event.currentTarget.value)}
                placeholder={t('admin.diff.searchPlaceholder')}
                className='ps-9'
              />
            </div>
          </div>
          <NativeSelect
            label={t('admin.diff.filterLabel')}
            value={diffFilterValue}
            onChange={(value) => setDiffFilterValue(diffFilter(value))}
            placeholder={t('admin.diff.filterAll')}
            options={[
              { value: 'all', label: t('admin.diff.filterAll') },
              { value: 'breaking', label: t('admin.diff.filterBreaking') },
              {
                value: 'mustHandle',
                label: t('admin.diff.filterMustHandle'),
              },
              { value: 'high', label: t('admin.diff.filterHigh') },
            ]}
          />
        </SelectorGrid>
        {visibleItems.length ? (
          <DiffReviewList items={visibleItems} />
        ) : (
          <EmptyState preset='diffs' />
        )}
      </CollectionCard>
    </PageChrome>
  )
}

function DiffReviewList({ items }: { items: DiffItemDTO[] }) {
  const { t } = useLanguage()
  const groups = useMemo(() => {
    const bySeverity = new Map<string, DiffItemDTO[]>()
    items.forEach((item) => {
      const key = changeSeverityLabel(item.severity, t)
      const group = bySeverity.get(key) ?? []
      group.push(item)
      bySeverity.set(key, group)
    })
    return Array.from(bySeverity.entries())
  }, [items, t])

  return (
    <div className='grid gap-4'>
      {groups.map(([severity, severityItems]) => (
        <section
          key={severity}
          className='grid gap-3 rounded-md border bg-[var(--surface-control)] p-4'
        >
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <p className='font-medium'>{severity}</p>
              <p className='text-xs text-muted-foreground'>
                {severityItems.length} {t('admin.diff.changeCount')}
              </p>
            </div>
            <Badge variant='secondary'>{t('admin.diff.severity')}</Badge>
          </div>
          <div className='grid gap-3'>
            {severityItems.map((item) => (
              <article
                key={item.id}
                className='grid gap-3 rounded-md border bg-background p-4'
              >
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div className='grid gap-1'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <Badge variant='outline'>
                        {methodLabel(item.method)}
                      </Badge>
                      <code className='font-mono text-xs'>
                        {item.path ?? item.location ?? t('admin.common.none')}
                      </code>
                    </div>
                    <p className='font-medium'>{item.message}</p>
                    {item.frontend_impact && (
                      <p className='text-sm text-muted-foreground'>
                        {item.frontend_impact}
                      </p>
                    )}
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    <Badge variant='secondary'>
                      {changeTypeLabel(item.change_type, t)}
                    </Badge>
                    {item.is_breaking && (
                      <Badge variant='outline'>
                        {t('admin.diff.breaking')}
                      </Badge>
                    )}
                    {item.must_handle && (
                      <Badge variant='outline'>
                        {t('admin.diff.mustHandle')}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className='grid gap-3 md:grid-cols-2'>
                  <div className='grid gap-2'>
                    <p className='text-xs font-medium text-muted-foreground'>
                      {t('admin.diff.oldValue')}
                    </p>
                    <pre className='max-h-72 overflow-auto rounded-md border bg-[var(--surface-control)] p-3 text-xs leading-relaxed'>
                      {jsonPreview(item.old_value)}
                    </pre>
                  </div>
                  <div className='grid gap-2'>
                    <p className='text-xs font-medium text-muted-foreground'>
                      {t('admin.diff.newValue')}
                    </p>
                    <pre className='max-h-72 overflow-auto rounded-md border bg-[var(--surface-control)] p-3 text-xs leading-relaxed'>
                      {jsonPreview(item.new_value)}
                    </pre>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function MCPTokensPage() {
  const { t } = useLanguage()
  const invalidate = useInvalidateAll()
  const tokensQuery = useQuery({
    queryKey: ['mcp-tokens'],
    queryFn: listMCPTokens,
  })
  const [oneTimeToken, setOneTimeToken] = useState('')
  const [redactedToken, setRedactedToken] = useState<MCPTokenDTO | null>(null)
  const createMutation = useMutation({
    mutationFn: createMCPToken,
    onSuccess: (token) => {
      setOneTimeToken(token.token ?? '')
      invalidate()
    },
  })
  const getMutation = useMutation({
    mutationFn: getMCPToken,
    onSuccess: setRedactedToken,
  })
  const revokeMutation = useMutation({
    mutationFn: revokeMCPToken,
    onSuccess: invalidate,
  })
  return (
    <PageChrome page='mcpTokens'>
      <LoadingErrorState
        state={{
          isLoading: tokensQuery.isLoading,
          isError: tokensQuery.isError,
          error: tokensQuery.error,
        }}
      />
      <FormCard
        title={t('admin.sections.createToken')}
        submitLabel={t('admin.common.create')}
        pending={createMutation.isPending}
        onSubmit={(formData) =>
          createMutation.mutate({
            name: fieldValue(formData, 'name'),
            scopes: fieldValue(formData, 'scopes')
              .split(',')
              .map((value) => Number(value.trim()))
              .filter(Number.isFinite),
            expires_at: optionalFieldValue(formData, 'expires_at') ?? null,
          })
        }
      >
        <div className='grid gap-4 md:grid-cols-3'>
          <TextField label={t('admin.fields.name')} name='name' required />
          <TextField
            label={t('admin.fields.scopes')}
            name='scopes'
            placeholder='1,2,3,4'
            required
          />
          <TextField
            label={t('admin.fields.expiresAt')}
            name='expires_at'
            placeholder={t('admin.placeholders.optionalIsoDate')}
          />
        </div>
      </FormCard>
      {oneTimeToken && (
        <Alert>
          <Copy />
          <AlertTitle>{t('admin.common.generated')}</AlertTitle>
          <AlertDescription>
            <p>{t('admin.common.tokenWarning')}</p>
            <code className='mt-2 block rounded-md border bg-muted p-3 text-xs'>
              {oneTimeToken}
            </code>
          </AlertDescription>
        </Alert>
      )}
      <TokenTable
        tokens={tokensQuery.data?.items ?? []}
        onView={(tokenId) => getMutation.mutate(tokenId)}
        onRevoke={(tokenId) => revokeMutation.mutate(tokenId)}
      />
      {redactedToken && (
        <ContentViewer
          title={t('admin.sections.tokenDetails')}
          content={stringify(redactedMCPToken(redactedToken))}
        />
      )}
    </PageChrome>
  )
}

function redactedMCPToken(token: MCPTokenDTO) {
  return {
    id: token.id,
    user_id: token.user_id,
    name: token.name,
    scopes: token.scopes,
    status: token.status,
    created_at: token.created_at,
    updated_at: token.updated_at,
    expires_at: token.expires_at,
    revoked_at: token.revoked_at,
    revoked_by: token.revoked_by,
    last_used_at: token.last_used_at,
  }
}

function TokenTable({
  tokens,
  onView,
  onRevoke,
  title,
  description,
  emptyPreset = 'tokens',
}: {
  tokens: MCPTokenDTO[]
  onView?: (tokenId: string) => void
  onRevoke: (tokenId: string) => void
  title?: string
  description?: string
  emptyPreset?: EmptyStatePreset
}) {
  const { t } = useLanguage()
  return (
    <CollectionCard
      title={title ?? t('nav.mcpTokens')}
      description={description}
      count={tokens.length}
    >
      {tokens.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.fields.name')}</TableHead>
              <TableHead>{t('admin.fields.status')}</TableHead>
              <TableHead>{t('admin.fields.expiresAt')}</TableHead>
              <TableHead>{t('admin.fields.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((token) => (
              <TableRow key={token.id}>
                <TableCell>
                  <div className='font-medium'>{token.name}</div>
                  <div className='text-xs text-muted-foreground'>
                    {token.id}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge>
                    {token.status === ACTIVE_STATUS
                      ? t('admin.common.active')
                      : t('admin.common.revoked')}
                  </StatusBadge>
                </TableCell>
                <TableCell>{formatDate(token.expires_at)}</TableCell>
                <TableCell>
                  <div className='flex gap-2'>
                    {onView && (
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => onView(token.id)}
                      >
                        {t('admin.common.view')}
                      </Button>
                    )}
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => onRevoke(token.id)}
                    >
                      {t('admin.common.revoke')}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState preset={emptyPreset} />
      )}
    </CollectionCard>
  )
}

export function SettingsPage() {
  const { t, language } = useLanguage()
  const { theme, resolvedTheme } = useTheme()
  const authUser = useAuthStore((state) => state.auth.user)
  const identityQuery = useQuery({
    queryKey: ['identity'],
    queryFn: getIdentity,
  })
  const healthQuery = useQuery({ queryKey: ['health'], queryFn: getHealth })
  const identity = identityQuery.data ?? authUser
  return (
    <PageChrome page='settings'>
      <section className='grid gap-4 md:grid-cols-2'>
        <SettingsCard
          title={t('admin.fields.identity')}
          rows={[
            [t('admin.fields.name'), identity?.name ?? '-'],
            [t('admin.fields.email'), identity?.email ?? '-'],
            [
              t('admin.fields.superAdmin'),
              identity?.is_super_admin
                ? t('admin.common.yes')
                : t('admin.common.no'),
            ],
          ]}
        />
        <SettingsCard
          title={t('admin.fields.request')}
          rows={[
            [t('admin.fields.apiBaseUrl'), apiBaseUrl],
            [t('admin.fields.health'), healthQuery.data?.status ?? '-'],
            [
              t('admin.fields.session'),
              authUser ? t('admin.statuses.active') : t('admin.common.none'),
            ],
          ]}
        />
        <SettingsCard
          title={t('admin.fields.theme')}
          rows={[
            [t('admin.fields.theme'), `${theme} / ${resolvedTheme}`],
            [t('admin.fields.language'), language],
          ]}
        />
      </section>
      <Alert>
        <CheckCircle2 />
        <AlertTitle>satnaing/shadcn-admin</AlertTitle>
        <AlertDescription>{t('admin.common.attribution')}</AlertDescription>
      </Alert>
    </PageChrome>
  )
}

function SettingsCard({
  title,
  rows,
}: {
  title: string
  rows: Array<[string, string]>
}) {
  return (
    <CollectionCard title={title}>
      {rows.map(([label, value]) => (
        <div
          key={label}
          className='flex justify-between gap-4 rounded-lg border p-3 text-sm'
        >
          <span className='text-muted-foreground'>{label}</span>
          <span className='text-end font-medium'>{value}</span>
        </div>
      ))}
    </CollectionCard>
  )
}
