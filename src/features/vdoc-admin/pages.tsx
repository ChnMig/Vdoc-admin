import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Server,
  ShieldCheck,
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
  promoteDraft,
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
  type DocumentDTO,
  type DraftDTO,
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
        <section className='mb-6 grid gap-2'>
          <p className='text-sm font-medium text-muted-foreground'>
            {t('app.consoleLabel')}
          </p>
          <h1 className='text-2xl font-bold tracking-tight'>
            {t(`admin.pages.${page}.title`)}
          </h1>
          <p className='max-w-3xl text-muted-foreground'>
            {t(`admin.pages.${page}.description`)}
          </p>
        </section>
        <div className='grid gap-6'>{children}</div>
      </Main>
    </>
  )
}

function LoadingErrorState({ state }: { state: QueryState }) {
  const { t } = useLanguage()
  if (state.isLoading) {
    return (
      <Card>
        <CardContent className='py-8 text-sm text-muted-foreground'>
          {t('admin.common.loading')}
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

function EmptyState() {
  const { t } = useLanguage()
  return (
    <p className='py-6 text-sm text-muted-foreground'>
      {t('admin.common.empty')}
    </p>
  )
}

function NativeSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
  name,
}: {
  label: string
  value?: string
  options: SelectOption[]
  placeholder: string
  onChange?: (value: string) => void
  name?: string
}) {
  return (
    <div className='grid gap-2'>
      <Label>{label}</Label>
      <select
        name={name}
        value={value}
        onChange={(event) => onChange?.(event.currentTarget.value)}
        className='h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden dark:bg-input/30'
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
  return <div className='grid gap-4 md:grid-cols-3'>{children}</div>
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
    <Card className='overflow-hidden'>
      <CardHeader className='pb-2'>
        <CardDescription>{title}</CardDescription>
        <CardTitle className='text-3xl'>{value}</CardTitle>
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
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

function TextField({
  label,
  name,
  type = 'text',
  required = false,
  placeholder,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <div className='grid gap-2'>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
      />
    </div>
  )
}

function TextAreaField({
  label,
  name,
  required = false,
}: {
  label: string
  name: string
  required?: boolean
}) {
  return (
    <div className='grid gap-2'>
      <Label htmlFor={name}>{label}</Label>
      <Textarea
        id={name}
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
  return <Badge variant={muted ? 'secondary' : 'outline'}>{children}</Badge>
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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {content ? (
          <pre className='max-h-[36rem] overflow-auto rounded-lg border bg-muted/40 p-4 text-xs leading-relaxed'>
            {content}
          </pre>
        ) : (
          <p className='text-sm text-muted-foreground'>
            {t('admin.common.empty')}
          </p>
        )}
      </CardContent>
    </Card>
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
  return {
    documentsQuery,
    documentId: selectedDocumentId,
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
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: listUsers })
  const teamsQuery = useQuery({ queryKey: ['teams'], queryFn: listTeams })
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  })
  const tokensQuery = useQuery({
    queryKey: ['mcp-tokens'],
    queryFn: listMCPTokens,
  })
  const queryState = {
    isLoading: healthQuery.isLoading || identityQuery.isLoading,
    isError: healthQuery.isError || identityQuery.isError,
    error: (healthQuery.error ?? identityQuery.error) as Error | null,
  }
  const dependencyEntries = Object.entries(healthQuery.data?.dependencies ?? {})

  return (
    <PageChrome page='dashboard'>
      <LoadingErrorState state={queryState} />
      <section className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <StatCard
          title={t('nav.users')}
          value={String(usersQuery.data?.total ?? '-')}
          description='/api/v1/private/system/users'
        />
        <StatCard
          title={t('nav.teams')}
          value={String(teamsQuery.data?.total ?? '-')}
          description='/api/v1/private/teams'
        />
        <StatCard
          title={t('nav.projects')}
          value={String(projectsQuery.data?.total ?? '-')}
          description='/api/v1/private/projects'
        />
        <StatCard
          title={t('nav.mcpTokens')}
          value={String(tokensQuery.data?.total ?? '-')}
          description='/api/v1/private/mcp-tokens'
        />
      </section>
      <section className='grid gap-4 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <Server className='size-4' />
              {t('admin.pages.dashboard.health')}
            </CardTitle>
            <CardDescription>/api/v1/open/health</CardDescription>
          </CardHeader>
          <CardContent className='grid gap-3 text-sm'>
            <div className='flex flex-wrap gap-2'>
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
              {dependencyEntries.map(([name, dependency]) => (
                <div
                  key={name}
                  className='flex items-center justify-between rounded-lg border p-3'
                >
                  <span className='font-medium'>{name}</span>
                  <StatusBadge muted={!dependency.ready}>
                    {dependency.status}
                  </StatusBadge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <ShieldCheck className='size-4' />
              {t('admin.pages.dashboard.identity')}
            </CardTitle>
            <CardDescription>/api/v1/private/identity/me</CardDescription>
          </CardHeader>
          <CardContent className='grid gap-2 text-sm'>
            <p className='font-medium'>{identityQuery.data?.name ?? '-'}</p>
            <p className='text-muted-foreground'>
              {identityQuery.data?.email ?? '-'}
            </p>
            <StatusBadge>
              {identityQuery.data?.is_super_admin
                ? t('admin.fields.superAdmin')
                : t('admin.roles.admin')}
            </StatusBadge>
          </CardContent>
        </Card>
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
      <Card>
        <CardHeader>
          <CardTitle>{t('nav.users')}</CardTitle>
          <CardDescription>
            {t('admin.common.total')}: {usersQuery.data?.total ?? 0}
          </CardDescription>
        </CardHeader>
        <CardContent>
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
            <EmptyState />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.sections.userTokens')}</CardTitle>
          <CardDescription>
            {selectedUser?.email ?? t('admin.placeholders.selectUser')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userTokenQuery.data?.items.length ? (
            <TokenTable
              tokens={userTokenQuery.data.items}
              onRevoke={(tokenId) =>
                selectedUserId &&
                revokeMutation.mutate({ userId: selectedUserId, tokenId })
              }
            />
          ) : (
            <EmptyState />
          )}
        </CardContent>
      </Card>
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
}: {
  items: Array<TeamDTO | ProjectDTO>
  onUpdate: (id: string, name: string, description: string) => void
  onArchive: (id: string) => void
  pending: boolean
}) {
  const { t } = useLanguage()
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t('admin.common.total')}: {items.length}
        </CardTitle>
      </CardHeader>
      <CardContent>
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
          <EmptyState />
        )}
      </CardContent>
    </Card>
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
        items={projectsQuery.data?.items ?? []}
        onUpdate={(id, name, description) =>
          updateMutation.mutate({ id, name, description })
        }
        onArchive={(id) => archiveMutation.mutate(id)}
        pending={updateMutation.isPending || archiveMutation.isPending}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.sections.members')}</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-4'>
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
        </CardContent>
      </Card>
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
    <EmptyState />
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
    <Card>
      <CardHeader>
        <CardTitle>{t('nav.documents')}</CardTitle>
      </CardHeader>
      <CardContent>
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
          <EmptyState />
        )}
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.sections.branches')}</CardTitle>
      </CardHeader>
      <CardContent>
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
          <EmptyState />
        )}
      </CardContent>
    </Card>
  )
}

export function DraftsPage() {
  const { t } = useLanguage()
  const invalidate = useInvalidateAll()
  const { projectId, setProjectId, projectOptions } = useProjectsAndSelection()
  const { documentId, setDocumentId, documentOptions } =
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
  const contentQuery = useQuery({
    queryKey: ['draft-content', projectId, documentId, draftId, contentKind],
    queryFn: () => getDraftContent(projectId, documentId, draftId, contentKind),
    enabled:
      projectId.length > 0 && documentId.length > 0 && draftId.length > 0,
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
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      runDraftAction(projectId, documentId, id, action),
    onSuccess: invalidate,
  })
  return (
    <PageChrome page='drafts'>
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
          value={contentKind}
          onChange={setContentKind}
          placeholder={t('admin.types.raw')}
          options={contentKindOptions(t)}
        />
      </SelectorGrid>
      <ContentViewer
        title={t('admin.sections.contentViewer')}
        content={
          contentQuery.data?.content ??
          selectedDraftInlineContent(
            draftsQuery.data?.items,
            draftId,
            contentKind
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
  action: string
) {
  if (action === 'submit') return submitDraft(projectId, documentId, draftId)
  if (action === 'approve') return approveDraft(projectId, documentId, draftId)
  if (action === 'request')
    return requestDraftChanges(projectId, documentId, draftId)
  if (action === 'reject') return rejectDraft(projectId, documentId, draftId)
  return promoteDraft(projectId, documentId, draftId)
}

function contentKindOptions(t: ReturnType<typeof useLanguage>['t']) {
  return [
    { value: 'raw', label: t('admin.types.raw') },
    { value: 'stable', label: t('admin.types.stable') },
    { value: 'normalized', label: t('admin.types.normalized') },
  ]
}

function selectedDraftInlineContent(
  drafts: DraftDTO[] | undefined,
  draftId: string,
  contentKind: string
) {
  const draft = drafts?.find((value) => value.id === draftId)
  if (!draft) return undefined
  if (contentKind === 'normalized')
    return draft.normalized_content ?? draft.normalized_schema
  return draft.raw_content ?? draft.raw_schema
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
  onAction: (id: string, action: string) => void
}) {
  const { t } = useLanguage()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.sections.drafts')}</CardTitle>
      </CardHeader>
      <CardContent>
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
                    <StatusBadge>
                      {draftStatusLabel(draft.status, t)}
                    </StatusBadge>
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
          <EmptyState />
        )}
      </CardContent>
    </Card>
  )
}

export function VersionsPage() {
  const { t } = useLanguage()
  const { projectId, setProjectId, projectOptions } = useProjectsAndSelection()
  const { documentId, setDocumentId, documentOptions } =
    useDocumentsAndSelection(projectId)
  const { versionsQuery, versionId, setVersionId, versionOptions } =
    useVersionsAndSelection(projectId, documentId)
  const [contentKind, setContentKind] = useState('raw')
  const [endpointPath, setEndpointPath] = useState('')
  const [endpointId, setEndpointId] = useState('')
  const contentQuery = useQuery({
    queryKey: [
      'version-content',
      projectId,
      documentId,
      versionId,
      contentKind,
    ],
    queryFn: () =>
      getVersionContent(projectId, documentId, versionId, contentKind),
    enabled:
      projectId.length > 0 && documentId.length > 0 && versionId.length > 0,
  })
  const endpointsQuery = useQuery({
    queryKey: ['endpoints', projectId, documentId, versionId, endpointPath],
    queryFn: () =>
      listEndpoints(projectId, documentId, versionId, endpointPath),
    enabled: versionId.length > 0,
  })
  const endpointQuery = useQuery({
    queryKey: ['endpoint', projectId, documentId, versionId, endpointId],
    queryFn: () => getEndpoint(projectId, documentId, versionId, endpointId),
    enabled: endpointId.length > 0,
  })
  return (
    <PageChrome page='versions'>
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
          label={t('admin.fields.version')}
          value={versionId}
          onChange={setVersionId}
          placeholder={t('admin.placeholders.selectVersion')}
          options={versionOptions}
        />
      </SelectorGrid>
      <VersionsTable
        versions={versionsQuery.data?.items ?? []}
        selected={versionId}
        onSelect={setVersionId}
      />
      <SelectorGrid>
        <NativeSelect
          label={t('admin.fields.contentKind')}
          value={contentKind}
          onChange={setContentKind}
          placeholder={t('admin.types.raw')}
          options={contentKindOptions(t)}
        />
        <div className='grid gap-2'>
          <Label>{t('admin.placeholders.endpointPath')}</Label>
          <Input
            value={endpointPath}
            onChange={(event) => setEndpointPath(event.currentTarget.value)}
            placeholder={t('admin.placeholders.endpointPath')}
          />
        </div>
      </SelectorGrid>
      <ContentViewer
        title={t('admin.sections.contentViewer')}
        content={
          contentQuery.data?.content ??
          selectedVersionInlineContent(
            versionsQuery.data?.items,
            versionId,
            contentKind
          )
        }
      />
      <EndpointsCard
        endpoints={endpointsQuery.data?.items ?? []}
        selected={endpointId}
        onSelect={setEndpointId}
        detail={endpointQuery.data ? stringify(endpointQuery.data) : undefined}
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
  if (contentKind === 'normalized')
    return version.normalized_content ?? version.normalized_schema
  return version.raw_content ?? version.raw_schema
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
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.sections.versions')}</CardTitle>
      </CardHeader>
      <CardContent>
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
          <EmptyState />
        )}
      </CardContent>
    </Card>
  )
}

function EndpointsCard({
  endpoints,
  selected,
  onSelect,
  detail,
}: {
  endpoints: EndpointSummaryDTO[]
  selected: string
  onSelect: (id: string) => void
  detail?: string
}) {
  const { t } = useLanguage()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.sections.endpoints')}</CardTitle>
      </CardHeader>
      <CardContent className='grid gap-4'>
        {endpoints.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.fields.method')}</TableHead>
                <TableHead>{t('admin.fields.path')}</TableHead>
                <TableHead>{t('admin.fields.summary')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.map((endpoint) => (
                <TableRow
                  key={endpoint.id}
                  data-state={selected === endpoint.id ? 'selected' : undefined}
                >
                  <TableCell>
                    <Badge variant='secondary'>{endpoint.method}</Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      type='button'
                      className='font-mono text-xs underline-offset-4 hover:underline'
                      onClick={() => onSelect(endpoint.id)}
                    >
                      {endpoint.path}
                    </button>
                  </TableCell>
                  <TableCell>
                    {endpoint.summary ?? endpoint.operation_id}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState />
        )}
        {detail && (
          <ContentViewer title={t('admin.common.endpoint')} content={detail} />
        )}
      </CardContent>
    </Card>
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
  const diffMutation = useMutation({
    mutationFn: () =>
      compareDiff(projectId, documentId, {
        from_version_id: fromVersionId,
        to_version_id: toVersionId,
      }),
    onSuccess: setDiff,
  })
  const summaryQuery = useQuery({
    queryKey: ['diff-summary', projectId, documentId, diff?.id],
    queryFn: () => getDiffSummary(projectId, documentId, diff?.id ?? ''),
    enabled: Boolean(diff?.id),
  })
  const summary = summaryQuery.data ?? diff?.summary
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
          value={fromVersionId}
          onChange={setFromVersionId}
          placeholder={t('admin.placeholders.selectVersion')}
          options={versionOptions}
        />
        <NativeSelect
          label={t('admin.fields.toVersion')}
          value={toVersionId}
          onChange={setToVersionId}
          placeholder={t('admin.placeholders.selectVersion')}
          options={versionOptions}
        />
      </SelectorGrid>
      <Button
        className='w-fit'
        disabled={!fromVersionId || !toVersionId || diffMutation.isPending}
        onClick={() => diffMutation.mutate()}
      >
        {t('admin.common.compare')}
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.sections.diffResult')}</CardTitle>
          <CardDescription>
            {diff?.id ?? t('admin.common.none')}
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4'>
          {summary && (
            <section className='grid gap-4 sm:grid-cols-4'>
              <StatCard
                title='added_endpoints'
                value={String(summary.added_endpoints)}
                description={t('admin.fields.summary')}
              />
              <StatCard
                title='removed_endpoints'
                value={String(summary.removed_endpoints)}
                description={t('admin.fields.summary')}
              />
              <StatCard
                title='modified_endpoints'
                value={String(summary.modified_endpoints)}
                description={t('admin.fields.summary')}
              />
              <StatCard
                title='breaking_changes'
                value={String(summary.breaking_changes)}
                description={t('admin.fields.summary')}
              />
            </section>
          )}
          {diff?.items.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.fields.method')}</TableHead>
                  <TableHead>{t('admin.fields.path')}</TableHead>
                  <TableHead>{t('admin.fields.summary')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diff.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.method}</TableCell>
                    <TableCell>{item.path}</TableCell>
                    <TableCell>{item.message}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState />
          )}
        </CardContent>
      </Card>
    </PageChrome>
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
          title={t('admin.common.revoke')}
          content={stringify(redactedToken)}
        />
      )}
    </PageChrome>
  )
}

function TokenTable({
  tokens,
  onView,
  onRevoke,
}: {
  tokens: MCPTokenDTO[]
  onView?: (tokenId: string) => void
  onRevoke: (tokenId: string) => void
}) {
  const { t } = useLanguage()
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('nav.mcpTokens')}</CardTitle>
      </CardHeader>
      <CardContent>
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
          <EmptyState />
        )}
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className='grid gap-3'>
        {rows.map(([label, value]) => (
          <div
            key={label}
            className='flex justify-between gap-4 rounded-lg border p-3 text-sm'
          >
            <span className='text-muted-foreground'>{label}</span>
            <span className='text-end font-medium'>{value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
