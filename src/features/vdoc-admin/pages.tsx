import { useEffect, useId, useMemo, useRef, useState } from 'react'
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
  RefreshCw,
  Route,
  SearchIcon,
  Server,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useVdocContextStore } from '@/stores/vdoc-context-store'
import {
  type NativeSelectOption,
  withNativeSelectPlaceholder,
} from '@/lib/native-select-options'
import { userPasswordError } from '@/lib/user-password'
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
  listAuditLogs,
  listDiffs,
  listDocuments,
  listDrafts,
  listEndpoints,
  listMCPUsage,
  listMCPTokens,
  listProjectMembers,
  listProjectMemberCandidates,
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
  type AISummaryTarget,
  type AuditLogDTO,
  type DraftReviewPayload,
  type BranchDTO,
  type DiffDTO,
  type DiffItemDTO,
  type DiffSummaryDTO,
  type DocumentDTO,
  type DraftDTO,
  type EndpointDTO,
  type EndpointSummaryDTO,
  type MCPTokenDTO,
  type ProjectMemberDTO,
  type ProjectDTO,
  type TeamDTO,
  type UserDTO,
  type VersionDTO,
} from '@/lib/vdoc-api'
import { type VdocPageDeepLinkProps } from '@/lib/vdoc-route-search'
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
import { ConfirmDialog } from '@/components/confirm-dialog'
import { LanguageSwitch } from '@/components/language-switch'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { MarkdownDocumentViewer } from '@/features/public-share/markdown-document-viewer'
import { AIContextPanel } from './ai-panels'
import { AISettingsPanel } from './ai-settings'
import { DocumentSharePanel } from './document-share-panel'
import { MarkdownFactsCard } from './markdown-facts-card'

const vdocMcpSource =
  'github:ChnMig/Vdoc-mcp#b65f346453525a3f35a6ce466cf47a4488d5c8f8'
const vdocSkillCommit = '9f3a1807e7cd09c677475b4a2397faff2a985829'
const vdocSkillInstallSnippet = `# Personal install; use .agents/skills/vdoc for repository scope instead.
VDOC_SKILL_DIR="$HOME/.agents/skills/vdoc"
VDOC_SKILL_COMMIT=${vdocSkillCommit}
test ! -e "$VDOC_SKILL_DIR"
mkdir -p "$(dirname -- "$VDOC_SKILL_DIR")"
git init "$VDOC_SKILL_DIR"
git -C "$VDOC_SKILL_DIR" remote add origin https://github.com/ChnMig/Vdoc-skill.git
git -C "$VDOC_SKILL_DIR" fetch --depth 1 origin "$VDOC_SKILL_COMMIT"
git -C "$VDOC_SKILL_DIR" checkout --detach FETCH_HEAD
test "$(git -C "$VDOC_SKILL_DIR" rev-parse HEAD)" = "$VDOC_SKILL_COMMIT"
test -f "$VDOC_SKILL_DIR/SKILL.md"`

const ACTIVE_STATUS = 1
const ARCHIVED_OR_DISABLED_STATUS = 2
const DOCUMENT_TYPE_OPENAPI = 1
const DOCUMENT_TYPE_MARKDOWN = 2
const DOCUMENT_FORMAT_MARKDOWN = 3
const ROLE_READER = 1
const ROLE_WRITER = 2
const ROLE_ADMIN = 3
const DRAFT_STATUS_DRAFT = 1
const DRAFT_STATUS_SUBMITTED = 2
const DRAFT_STATUS_CHANGES_REQUESTED = 3
const DRAFT_STATUS_REJECTED = 4
const DRAFT_STATUS_PUBLISHED = 5
const MCP_TOKEN_STATUS_REVOKED = 2
const MCP_TOKEN_STATUS_EXPIRED = 3
const SCOPE_API_READ = 1
const SCOPE_DOC_READ = 3

type PageKey =
  | 'dashboard'
  | 'users'
  | 'teams'
  | 'projects'
  | 'documents'
  | 'drafts'
  | 'versions'
  | 'diffs'
  | 'audit'
  | 'mcpTokens'
  | 'skill'
  | 'settings'

type QueryState = {
  isLoading: boolean
  isError: boolean
  error: Error | null
}

type SelectOption = NativeSelectOption

type PageGuidance = {
  title: string
  description: string
  action?: {
    href: string
    label: string
  }
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
  | 'audit'
  | 'tokens'
  | 'userTokens'

type EndpointGroupMode = 'tag' | 'method'
type DraftAction = 'submit' | 'approve' | 'request' | 'reject'
type DraftReviewAction = Exclude<DraftAction, 'submit'>
type DraftActionRequest = {
  readonly projectId: string
  readonly documentId: string
  readonly draftId: string
  readonly action: DraftAction
  readonly comment?: string
}
type DiffFilter = 'all' | 'breaking' | 'mustHandle' | 'high'
type WorkbenchStepKey =
  | 'team'
  | 'project'
  | 'document'
  | 'branch'
  | 'draft'
  | 'version'
  | 'token'
  | 'connection'

const pageNextRoute: Record<PageKey, string> = {
  dashboard: '/projects',
  users: '/teams',
  teams: '/projects',
  projects: '/documents',
  documents: '/drafts',
  drafts: '/versions',
  versions: '/diffs',
  diffs: '/mcp-tokens',
  audit: '/settings',
  mcpTokens: '/skill',
  skill: '/mcp-tokens',
  settings: '/',
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

function activeFirstId(items: Array<{ id: string; status: number }>) {
  return items.find((item) => item.status === ACTIVE_STATUS)?.id ?? ''
}

function contextualHref(href: string, projectId?: string, documentId?: string) {
  const params = new URLSearchParams()
  if (projectId) params.set('project_id', projectId)
  if (documentId) params.set('document_id', documentId)
  const query = params.toString()
  return query ? `${href}?${query}` : href
}

function entityOptionLabel(
  name: string,
  status: number,
  t: ReturnType<typeof useLanguage>['t']
) {
  return status === ACTIVE_STATUS
    ? name
    : `${name} — ${t('admin.statuses.archived')}`
}

function tokenIsActive(token: MCPTokenDTO, now = Date.now()) {
  if (token.status !== ACTIVE_STATUS) return false
  if (!token.expires_at) return true
  const expiresAt = Date.parse(token.expires_at)
  return Number.isFinite(expiresAt) && expiresAt > now
}

function tokenHasReadScope(token: MCPTokenDTO, documentType?: number) {
  if (documentType === DOCUMENT_TYPE_MARKDOWN) {
    return token.scopes.includes(SCOPE_DOC_READ)
  }
  if (documentType === DOCUMENT_TYPE_OPENAPI) {
    return token.scopes.includes(SCOPE_API_READ)
  }
  return false
}

function tokenHasAnyReadScope(token: MCPTokenDTO) {
  return (
    token.scopes.includes(SCOPE_API_READ) ||
    token.scopes.includes(SCOPE_DOC_READ)
  )
}

function tokenStatusLabel(
  token: MCPTokenDTO,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (tokenIsActive(token)) return t('admin.statuses.active')
  if (
    token.status === MCP_TOKEN_STATUS_EXPIRED ||
    (token.expires_at && Date.parse(token.expires_at) <= Date.now())
  ) {
    return t('admin.statuses.expired')
  }
  if (token.status === MCP_TOKEN_STATUS_REVOKED) {
    return t('admin.statuses.revoked')
  }
  return `${t('admin.common.unknown')} ${token.status}`
}

function activeProjectRole(
  members: readonly ProjectMemberDTO[] | undefined,
  userId: string | undefined
) {
  if (!userId) return undefined
  return members?.find(
    (member) => member.user_id === userId && member.status === ACTIVE_STATUS
  )?.role
}

function stringify(value: unknown) {
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

function resourceStatusLabel(
  status: number,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (status === ACTIVE_STATUS) return t('admin.statuses.active')
  if (status === ARCHIVED_OR_DISABLED_STATUS)
    return t('admin.statuses.archived')
  return `${t('admin.common.unknown')} ${status}`
}

function accountStatusLabel(
  status: number,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (status === ACTIVE_STATUS) return t('admin.statuses.active')
  if (status === ARCHIVED_OR_DISABLED_STATUS)
    return t('admin.statuses.disabled')
  return `${t('admin.common.unknown')} ${status}`
}

function versionStatusLabel(
  status: number,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (status === ACTIVE_STATUS) return t('admin.statuses.published')
  return `${t('admin.common.unknown')} ${status}`
}

function draftStatusLabel(
  status: number,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (status === DRAFT_STATUS_DRAFT) return t('admin.statuses.draft')
  if (status === DRAFT_STATUS_SUBMITTED) return t('admin.statuses.submitted')
  if (status === DRAFT_STATUS_CHANGES_REQUESTED)
    return t('admin.statuses.changesRequested')
  if (status === DRAFT_STATUS_REJECTED) return t('admin.statuses.rejected')
  if (status === DRAFT_STATUS_PUBLISHED) return t('admin.statuses.published')
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
  if (changeType === 1) return t('admin.diff.changeTypes.endpointAdded')
  if (changeType === 2) return t('admin.diff.changeTypes.endpointRemoved')
  if (changeType === 3) return t('admin.diff.changeTypes.endpointModified')
  if (changeType === 4) return t('admin.diff.changeTypes.parameterAdded')
  if (changeType === 5) return t('admin.diff.changeTypes.parameterRemoved')
  if (changeType === 6) return t('admin.diff.changeTypes.parameterChanged')
  if (changeType === 7) return t('admin.diff.changeTypes.requestBodyChanged')
  if (changeType === 8) return t('admin.diff.changeTypes.responseChanged')
  if (changeType === 9) return t('admin.diff.changeTypes.securityChanged')
  if (changeType === 10) return t('admin.diff.changeTypes.deprecatedChanged')
  return `${t('admin.common.unknown')} ${changeType}`
}

function diffMessageLabel(
  message: string,
  t: ReturnType<typeof useLanguage>['t']
) {
  const keys = {
    'Endpoint added': 'admin.diff.messages.endpointAdded',
    'Endpoint removed': 'admin.diff.messages.endpointRemoved',
    'Endpoint metadata changed': 'admin.diff.messages.endpointMetadataChanged',
    'Parameter added': 'admin.diff.messages.parameterAdded',
    'Parameter removed': 'admin.diff.messages.parameterRemoved',
    'Parameter location changed':
      'admin.diff.messages.parameterLocationChanged',
    'Parameter type changed': 'admin.diff.messages.parameterTypeChanged',
    'Parameter required flag changed':
      'admin.diff.messages.parameterRequiredChanged',
    'Parameter enum value removed': 'admin.diff.messages.parameterEnumRemoved',
    'Request body required flag changed':
      'admin.diff.messages.requestBodyRequiredChanged',
    'Request body media type added':
      'admin.diff.messages.requestBodyMediaAdded',
    'Request body media type removed':
      'admin.diff.messages.requestBodyMediaRemoved',
    'Request body field added': 'admin.diff.messages.requestBodyFieldAdded',
    'Request body field removed': 'admin.diff.messages.requestBodyFieldRemoved',
    'Request body field type changed':
      'admin.diff.messages.requestBodyFieldTypeChanged',
    'Request body field required flag changed':
      'admin.diff.messages.requestBodyFieldRequiredChanged',
    'Request body schema type changed':
      'admin.diff.messages.requestBodySchemaTypeChanged',
    'Response status added': 'admin.diff.messages.responseStatusAdded',
    'Response status removed': 'admin.diff.messages.responseStatusRemoved',
    'Response body added': 'admin.diff.messages.responseBodyAdded',
    'Response body removed': 'admin.diff.messages.responseBodyRemoved',
    'Response field added': 'admin.diff.messages.responseFieldAdded',
    'Response field removed': 'admin.diff.messages.responseFieldRemoved',
    'Response field type changed':
      'admin.diff.messages.responseFieldTypeChanged',
    'Response field required flag changed':
      'admin.diff.messages.responseFieldRequiredChanged',
    'Response schema type changed':
      'admin.diff.messages.responseSchemaTypeChanged',
    'Enum value removed': 'admin.diff.messages.enumValueRemoved',
    'Security requirements changed':
      'admin.diff.messages.securityRequirementsChanged',
    'Deprecated status changed': 'admin.diff.messages.deprecatedStatusChanged',
    'Markdown line added': 'admin.diff.messages.markdownLineAdded',
    'Markdown line removed': 'admin.diff.messages.markdownLineRemoved',
    'Markdown line changed': 'admin.diff.messages.markdownLineChanged',
  } as const
  const key = keys[message as keyof typeof keys]
  return key ? t(key) : message
}

function PageChrome({
  page,
  children,
  guidance,
}: {
  page: PageKey
  children: React.ReactNode
  guidance?: PageGuidance
}) {
  const { t } = useLanguage()
  const projectId = useVdocContextStore((state) => state.projectId)
  const documentId = useVdocContextStore((state) => state.documentId)
  const resolvedGuidance =
    guidance ??
    ({
      title: t('admin.common.nextAction'),
      description: t(`admin.pages.${page}.next`),
      action: {
        href: pageNextRoute[page],
        label: t('admin.common.openNextAction'),
      },
    } satisfies PageGuidance)
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
              {resolvedGuidance.title}
            </p>
            <p className='leading-6 text-muted-foreground'>
              {resolvedGuidance.description}
            </p>
            {resolvedGuidance.action && (
              <Button asChild size='sm' variant='outline' className='w-fit'>
                <a
                  href={contextualHref(
                    resolvedGuidance.action.href,
                    projectId,
                    documentId
                  )}
                >
                  {resolvedGuidance.action.label}
                  <ArrowRight />
                </a>
              </Button>
            )}
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

function DeepLinkAlert({ targets }: { targets: string[] }) {
  const { t } = useLanguage()
  if (targets.length === 0) return null
  return (
    <Alert variant='destructive' aria-live='polite'>
      <AlertCircle />
      <AlertTitle>{t('admin.deepLink.invalidTitle')}</AlertTitle>
      <AlertDescription>
        {t('admin.deepLink.invalidDescription', {
          targets: targets.join(', '),
        })}
      </AlertDescription>
    </Alert>
  )
}

function AccessDeniedPage({ page }: { page: PageKey }) {
  const { t } = useLanguage()
  return (
    <PageChrome page={page}>
      <Alert variant='destructive'>
        <ShieldCheck />
        <AlertTitle>{t('errors.forbiddenTitle')}</AlertTitle>
        <AlertDescription>
          {t('admin.permissions.superAdminOnly')}
        </AlertDescription>
      </Alert>
    </PageChrome>
  )
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
  defaultValue,
  hint,
  disabled = false,
  required = false,
}: {
  id?: string
  label: string
  value?: string
  options: SelectOption[]
  placeholder: string
  onChange?: (value: string) => void
  name?: string
  defaultValue?: string
  hint?: string
  disabled?: boolean
  required?: boolean
}) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const selectOptions = withNativeSelectPlaceholder(options, placeholder)
  return (
    <div className='grid gap-2'>
      <Label htmlFor={controlId}>{label}</Label>
      <select
        id={controlId}
        name={name}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        disabled={disabled}
        required={required}
        aria-describedby={hint ? `${controlId}-hint` : undefined}
        onChange={(event) => onChange?.(event.currentTarget.value)}
        className='h-9 rounded-md border border-input bg-background/75 px-3 text-sm shadow-[0_1px_1px_oklch(0_0_0_/_4%)] transition-[background-color,border-color,color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-hidden dark:bg-input/25'
      >
        {selectOptions.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={required && option.value === ''}
          >
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={`${controlId}-hint`} className='text-sm text-muted-foreground'>
          {hint}
        </p>
      )}
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
  resetOnSuccess = true,
  disabled = false,
}: {
  title: string
  children: React.ReactNode
  submitLabel: string
  pending: boolean
  onSubmit: (formData: FormData) => Promise<unknown>
  resetOnSuccess?: boolean
  disabled?: boolean
}) {
  const { t } = useLanguage()
  const [submitError, setSubmitError] = useState<Error | null>(null)
  const submitLockedRef = useRef(false)
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
          onSubmit={async (event) => {
            event.preventDefault()
            if (submitLockedRef.current) return
            submitLockedRef.current = true
            const form = event.currentTarget
            setSubmitError(null)
            try {
              await onSubmit(new FormData(form))
              if (resetOnSuccess) form.reset()
            } catch (error) {
              setSubmitError(
                error instanceof Error
                  ? error
                  : new Error(t('toasts.somethingWrong'))
              )
            } finally {
              submitLockedRef.current = false
            }
          }}
        >
          {children}
          {submitError && (
            <Alert variant='destructive' aria-live='polite'>
              <AlertCircle />
              <AlertTitle>{t('admin.common.error')}</AlertTitle>
              <AlertDescription>{submitError.message}</AlertDescription>
            </Alert>
          )}
          <Button
            type='submit'
            className='w-fit'
            disabled={pending || disabled}
          >
            {submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

type ConfirmedAction = {
  readonly label: React.ReactNode
  readonly title: React.ReactNode
  readonly description: string
  readonly onConfirm: () => Promise<unknown>
  readonly destructive: boolean
}

export function ConfirmActionButton({
  label,
  title,
  description,
  onConfirm,
  disabled = false,
  pending = false,
  destructive = true,
  variant = 'outline',
  size = 'sm',
}: {
  label: React.ReactNode
  title: React.ReactNode
  description: string
  onConfirm: () => Promise<unknown>
  disabled?: boolean
  pending?: boolean
  destructive?: boolean
  variant?: React.ComponentProps<typeof Button>['variant']
  size?: React.ComponentProps<typeof Button>['size']
}) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<Error>()
  const [confirmedAction, setConfirmedAction] = useState<ConfirmedAction>()
  const submitLockedRef = useRef(false)

  return (
    <>
      <Button
        type='button'
        variant={variant}
        size={size}
        disabled={disabled || pending || submitting}
        onClick={() => {
          setError(undefined)
          setConfirmedAction({
            label,
            title,
            description,
            onConfirm,
            destructive,
          })
          setOpen(true)
        }}
      >
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!submitting) {
            setOpen(nextOpen)
            if (!nextOpen) {
              setError(undefined)
              setConfirmedAction(undefined)
            }
          }
        }}
        title={confirmedAction?.title ?? ''}
        desc={confirmedAction?.description ?? ''}
        confirmText={confirmedAction?.label}
        destructive={confirmedAction?.destructive}
        isLoading={submitting}
        handleConfirm={() => {
          if (submitLockedRef.current || !confirmedAction) return
          submitLockedRef.current = true
          setSubmitting(true)
          setError(undefined)
          void Promise.resolve()
            .then(confirmedAction.onConfirm)
            .then(() => {
              setOpen(false)
              setConfirmedAction(undefined)
            })
            .catch((cause: unknown) =>
              setError(
                cause instanceof Error
                  ? cause
                  : new Error(t('toasts.somethingWrong'))
              )
            )
            .finally(() => {
              submitLockedRef.current = false
              setSubmitting(false)
            })
        }}
      >
        {error && (
          <Alert variant='destructive' aria-live='polite'>
            <AlertCircle />
            <AlertTitle>{t('admin.common.error')}</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
      </ConfirmDialog>
    </>
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
  value,
  onChange,
  defaultValue,
  disabled = false,
  readOnly = false,
  description,
}: {
  id?: string
  label: string
  name: string
  type?: string
  required?: boolean
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  defaultValue?: string
  disabled?: boolean
  readOnly?: boolean
  description?: string
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
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        disabled={disabled}
        readOnly={readOnly}
        aria-describedby={description ? `${controlId}-description` : undefined}
        onChange={
          onChange ? (event) => onChange(event.currentTarget.value) : undefined
        }
      />
      {description && (
        <p
          id={`${controlId}-description`}
          className='text-xs text-muted-foreground'
        >
          {description}
        </p>
      )}
    </div>
  )
}

function TextAreaField({
  id,
  label,
  name,
  required = false,
  defaultValue,
  disabled = false,
}: {
  id?: string
  label: string
  name: string
  required?: boolean
  defaultValue?: string
  disabled?: boolean
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
        defaultValue={defaultValue}
        disabled={disabled}
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
  onUpdate: (id: string, name: string, description: string) => Promise<unknown>
  pending: boolean
}) {
  const { t } = useLanguage()
  const [error, setError] = useState<Error>()
  const submitLockedRef = useRef(false)
  return (
    <form
      className='grid gap-2 sm:grid-cols-[1fr_1fr_auto]'
      onSubmit={async (event) => {
        event.preventDefault()
        if (submitLockedRef.current) return
        submitLockedRef.current = true
        const formData = new FormData(event.currentTarget)
        setError(undefined)
        try {
          await onUpdate(
            item.id,
            fieldValue(formData, 'name'),
            fieldValue(formData, 'description')
          )
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause
              : new Error(t('toasts.somethingWrong'))
          )
        } finally {
          submitLockedRef.current = false
        }
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
      {error && (
        <Alert
          className='sm:col-span-full'
          variant='destructive'
          aria-live='polite'
        >
          <AlertCircle />
          <AlertTitle>{t('admin.common.error')}</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
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

function useRouteControlledString(
  routeValue: string | undefined,
  routeControlled: boolean
) {
  const [localValue, setLocalValue] = useState(routeValue ?? '')
  return [
    routeControlled ? (routeValue ?? '') : localValue,
    setLocalValue,
  ] as const
}

function useProjectsAndSelection(
  preferredProjectId?: string,
  onProjectChange?: (projectId: string) => void
) {
  const { t } = useLanguage()
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  })
  const projectId = useVdocContextStore((state) => state.projectId)
  const setProjectId = useVdocContextStore((state) => state.setProjectId)
  const projectOptions = useMemo(
    () =>
      projectsQuery.data?.items.map((project) => ({
        value: project.id,
        label: entityOptionLabel(project.name, project.status, t),
      })) ?? [],
    [projectsQuery.data, t]
  )
  const hasPreferredProject = preferredProjectId !== undefined
  const preferredProjectExists = projectOptions.some(
    (project) => project.value === preferredProjectId
  )
  const selectedProjectId = hasPreferredProject
    ? preferredProjectExists
      ? preferredProjectId
      : ''
    : projectOptions.some((project) => project.value === projectId)
      ? projectId
      : activeFirstId(projectsQuery.data?.items ?? [])
  const onProjectChangeRef = useRef(onProjectChange)
  useEffect(() => {
    onProjectChangeRef.current = onProjectChange
  }, [onProjectChange])
  useEffect(() => {
    if (!projectsQuery.data) return
    if (selectedProjectId !== projectId) setProjectId(selectedProjectId)
    if (!hasPreferredProject && selectedProjectId) {
      onProjectChangeRef.current?.(selectedProjectId)
    }
  }, [
    hasPreferredProject,
    projectId,
    projectsQuery.data,
    selectedProjectId,
    setProjectId,
  ])
  const selectProjectId = (value: string) => {
    setProjectId(value)
    onProjectChangeRef.current?.(value)
  }
  return {
    projectsQuery,
    projectId: selectedProjectId,
    setProjectId: selectProjectId,
    projectOptions,
    invalidProjectDeepLink: Boolean(
      projectsQuery.data && hasPreferredProject && !preferredProjectExists
    ),
  }
}

function useDocumentsAndSelection(
  projectId: string,
  documentType?: number,
  preferredDocumentId?: string,
  onDocumentChange?: (documentId: string) => void
) {
  const { t } = useLanguage()
  const documentsQuery = useQuery({
    queryKey: ['documents', projectId, documentType ?? 'all'],
    queryFn: () =>
      documentType === undefined
        ? listDocuments(projectId)
        : listDocuments(projectId, documentType),
    enabled: projectId.length > 0,
  })
  const documentId = useVdocContextStore((state) => state.documentId)
  const setDocumentId = useVdocContextStore((state) => state.setDocumentId)
  const documentOptions = useMemo(
    () =>
      documentsQuery.data?.items.map((document) => ({
        value: document.id,
        label: entityOptionLabel(document.name, document.status, t),
      })) ?? [],
    [documentsQuery.data, t]
  )
  const hasPreferredDocument = preferredDocumentId !== undefined
  const preferredDocumentExists = documentOptions.some(
    (document) => document.value === preferredDocumentId
  )
  const selectedDocumentId = hasPreferredDocument
    ? preferredDocumentExists
      ? preferredDocumentId
      : ''
    : documentOptions.some((document) => document.value === documentId)
      ? documentId
      : activeFirstId(documentsQuery.data?.items ?? [])
  const onDocumentChangeRef = useRef(onDocumentChange)
  useEffect(() => {
    onDocumentChangeRef.current = onDocumentChange
  }, [onDocumentChange])
  useEffect(() => {
    if (!documentsQuery.data) return
    if (selectedDocumentId !== documentId) setDocumentId(selectedDocumentId)
    if (!hasPreferredDocument && selectedDocumentId) {
      onDocumentChangeRef.current?.(selectedDocumentId)
    }
  }, [
    documentId,
    documentsQuery.data,
    hasPreferredDocument,
    selectedDocumentId,
    setDocumentId,
  ])
  const selectDocumentId = (value: string) => {
    setDocumentId(value)
    onDocumentChangeRef.current?.(value)
  }
  const selectedDocument = documentsQuery.data?.items.find(
    (document) => document.id === selectedDocumentId
  )
  return {
    documentsQuery,
    documentId: selectedDocumentId,
    selectedDocument,
    setDocumentId: selectDocumentId,
    documentOptions,
    invalidDocumentDeepLink: Boolean(
      documentsQuery.data && hasPreferredDocument && !preferredDocumentExists
    ),
  }
}

function useVersionsAndSelection(
  projectId: string,
  documentId: string,
  branchId?: string,
  preferredVersionId?: string,
  onVersionChange?: (versionId: string) => void
) {
  const versionsQuery = useQuery({
    queryKey: ['versions', projectId, documentId, branchId ?? 'all'],
    queryFn: () =>
      branchId === undefined
        ? listVersions(projectId, documentId)
        : listVersions(projectId, documentId, branchId),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const versionId = useVdocContextStore((state) => state.versionId)
  const setVersionId = useVdocContextStore((state) => state.setVersionId)
  const versionOptions = useMemo(
    () =>
      versionsQuery.data?.items.map((version) => ({
        value: version.id,
        label: version.version_name,
      })) ?? [],
    [versionsQuery.data]
  )
  const hasPreferredVersion = preferredVersionId !== undefined
  const preferredVersionExists = versionOptions.some(
    (version) => version.value === preferredVersionId
  )
  const selectedVersionId = hasPreferredVersion
    ? preferredVersionExists
      ? preferredVersionId
      : ''
    : versionOptions.some((version) => version.value === versionId)
      ? versionId
      : (versionOptions[0]?.value ?? '')
  const onVersionChangeRef = useRef(onVersionChange)
  useEffect(() => {
    onVersionChangeRef.current = onVersionChange
  }, [onVersionChange])
  useEffect(() => {
    if (!versionsQuery.data) return
    if (selectedVersionId !== versionId) setVersionId(selectedVersionId)
    if (!hasPreferredVersion && selectedVersionId) {
      onVersionChangeRef.current?.(selectedVersionId)
    }
  }, [
    hasPreferredVersion,
    selectedVersionId,
    setVersionId,
    versionId,
    versionsQuery.data,
  ])
  const selectVersionId = (value: string) => {
    setVersionId(value)
    onVersionChangeRef.current?.(value)
  }
  return {
    versionsQuery,
    versionId: selectedVersionId,
    setVersionId: selectVersionId,
    versionOptions,
    invalidVersionDeepLink: Boolean(
      versionsQuery.data && hasPreferredVersion && !preferredVersionExists
    ),
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
  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: listTeams,
    enabled: isSuperAdmin,
  })
  const { projectsQuery, projectId, setProjectId, projectOptions } =
    useProjectsAndSelection()
  const selectedProject = projectsQuery.data?.items.find(
    (project) => project.id === projectId
  )
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => listProjectMembers(projectId),
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
    queryFn: () => listBranches(projectId, documentId),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const draftsQuery = useQuery({
    queryKey: ['drafts', projectId, documentId],
    queryFn: () => listDrafts(projectId, documentId),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const versionsQuery = useQuery({
    queryKey: ['versions', projectId, documentId, 'dashboard-readiness'],
    queryFn: () => listVersions(projectId, documentId),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const tokensQuery = useQuery({
    queryKey: ['mcp-tokens'],
    queryFn: listMCPTokens,
  })
  const mcpUsageQuery = useQuery({
    queryKey: ['mcp-usage', 'dashboard'],
    queryFn: () => listMCPUsage({ limit: 200 }),
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
      draftsQuery.isLoading ||
      versionsQuery.isLoading ||
      tokensQuery.isLoading ||
      mcpUsageQuery.isLoading,
    isError:
      healthQuery.isError ||
      identityQuery.isError ||
      (isSuperAdmin && usersQuery.isError) ||
      (isSuperAdmin && teamsQuery.isError) ||
      projectsQuery.isError ||
      documentsQuery.isError ||
      branchesQuery.isError ||
      draftsQuery.isError ||
      versionsQuery.isError ||
      tokensQuery.isError ||
      mcpUsageQuery.isError,
    error: (healthQuery.error ??
      identityQuery.error ??
      (isSuperAdmin ? usersQuery.error : null) ??
      (isSuperAdmin ? teamsQuery.error : null) ??
      projectsQuery.error ??
      documentsQuery.error ??
      branchesQuery.error ??
      draftsQuery.error ??
      versionsQuery.error ??
      tokensQuery.error ??
      mcpUsageQuery.error) as Error | null,
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
  const activeReadableTokenIds = new Set(
    activeReadableTokens.map((token) => token.id)
  )
  const hasPublishedReadEvidence = (mcpUsageQuery.data?.items ?? []).some(
    (usage) =>
      activeReadableTokenIds.has(usage.actor_token_id ?? '') &&
      usage.metadata.evidence_kind === 'published_content_read' &&
      usage.metadata.result === 'success' &&
      (usage.project_id ?? usage.metadata.project_id) === projectId &&
      (usage.document_id ?? usage.metadata.document_id) === documentId
  )
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
      done: Boolean(
        draftsQuery.data?.items.some(
          (draft) =>
            activeDocumentContext &&
            activeBranchIds.has(draft.branch_id) &&
            (draft.status === DRAFT_STATUS_SUBMITTED ||
              draft.status === DRAFT_STATUS_PUBLISHED)
        )
      ),
      href: '/drafts',
    },
    {
      key: 'version',
      icon: GitCompareArrows,
      done: Boolean(
        versionsQuery.data?.items.some(
          (version) =>
            activeDocumentContext &&
            activeBranchIds.has(version.branch_id) &&
            version.status === ACTIVE_STATUS
        )
      ),
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

export function UsersPage() {
  const { t } = useLanguage()
  const isSuperAdmin = Boolean(
    useAuthStore((state) => state.auth.user?.is_super_admin)
  )
  const invalidate = useInvalidateAll()
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
    enabled: isSuperAdmin,
  })
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

  if (!isSuperAdmin) {
    return <AccessDeniedPage page='users' />
  }

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
        onSubmit={(formData) => {
          const password = fieldValue(formData, 'password')
          if (userPasswordError(password) !== undefined) {
            throw new Error(t('auth.validation.passwordPolicy'))
          }
          return createMutation.mutateAsync({
            email: fieldValue(formData, 'email'),
            name: fieldValue(formData, 'name'),
            password,
            is_super_admin: fieldValue(formData, 'is_super_admin') === 'true',
          })
        }}
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
            description={t('auth.validation.passwordPolicy')}
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
                    <StatusBadge>
                      {accountStatusLabel(user.status, t)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    {user.is_super_admin
                      ? t('admin.common.yes')
                      : t('admin.common.no')}
                  </TableCell>
                  <TableCell>
                    <div className='flex flex-wrap gap-2'>
                      {user.status === ACTIVE_STATUS ? (
                        <ConfirmActionButton
                          label={t('admin.actions.disableUser')}
                          title={t('admin.confirm.disableUserTitle', {
                            email: user.email,
                          })}
                          description={t(
                            'admin.confirm.disableUserDescription'
                          )}
                          pending={patchMutation.isPending}
                          onConfirm={() =>
                            patchMutation.mutateAsync({
                              id: user.id,
                              status: ARCHIVED_OR_DISABLED_STATUS,
                            })
                          }
                        />
                      ) : (
                        <ConfirmActionButton
                          label={t('admin.actions.enableUser')}
                          title={t('admin.confirm.enableUserTitle', {
                            email: user.email,
                          })}
                          description={t('admin.confirm.enableUserDescription')}
                          destructive={false}
                          pending={patchMutation.isPending}
                          onConfirm={() =>
                            patchMutation.mutateAsync({
                              id: user.id,
                              status: ACTIVE_STATUS,
                            })
                          }
                        />
                      )}
                      <ConfirmActionButton
                        label={t(
                          user.is_super_admin
                            ? 'admin.actions.revokeSuperAdmin'
                            : 'admin.actions.grantSuperAdmin'
                        )}
                        title={t(
                          user.is_super_admin
                            ? 'admin.confirm.revokeSuperAdminTitle'
                            : 'admin.confirm.grantSuperAdminTitle',
                          { email: user.email }
                        )}
                        description={t(
                          user.is_super_admin
                            ? 'admin.confirm.revokeSuperAdminDescription'
                            : 'admin.confirm.grantSuperAdminDescription'
                        )}
                        destructive={user.is_super_admin}
                        pending={patchMutation.isPending}
                        onConfirm={() =>
                          patchMutation.mutateAsync({
                            id: user.id,
                            isSuperAdmin: !user.is_super_admin,
                          })
                        }
                      />
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
          revokeMutation.mutateAsync({ userId: selectedUserId, tokenId })
        }
        pending={revokeMutation.isPending}
      />
    </PageChrome>
  )
}

export function TeamsPage() {
  const { t } = useLanguage()
  const isSuperAdmin = Boolean(
    useAuthStore((state) => state.auth.user?.is_super_admin)
  )
  const invalidate = useInvalidateAll()
  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: listTeams,
    enabled: isSuperAdmin,
  })
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
  if (!isSuperAdmin) {
    return <AccessDeniedPage page='teams' />
  }

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
        createMutation.mutateAsync({
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
          updateMutation.mutateAsync({ id, name, description })
        }
        onArchive={(id) => archiveMutation.mutateAsync(id)}
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
  onCreate: (formData: FormData) => Promise<unknown>
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
  readOnly = false,
  canEdit,
}: {
  items: Array<TeamDTO | ProjectDTO>
  onUpdate: (id: string, name: string, description: string) => Promise<unknown>
  onArchive: (id: string) => Promise<unknown>
  pending: boolean
  emptyPreset: EmptyStatePreset
  readOnly?: boolean
  canEdit?: (id: string) => boolean
}) {
  const { t } = useLanguage()
  const hasEditableItem =
    !readOnly &&
    items.some(
      (item) =>
        ('status' in item ? item.status === ACTIVE_STATUS : true) &&
        (canEdit?.(item.id) ?? true)
    )
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
              {hasEditableItem && (
                <TableHead>{t('admin.fields.actions')}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className='min-w-80'>
                  {readOnly ||
                  ('status' in item && item.status !== ACTIVE_STATUS) ||
                  (canEdit && !canEdit(item.id)) ? (
                    <div className='grid gap-1'>
                      <span className='font-medium'>{item.name}</span>
                      <span className='text-sm text-muted-foreground'>
                        {item.description || t('admin.common.none')}
                      </span>
                    </div>
                  ) : (
                    <InlineNameDescriptionForm
                      item={item}
                      onUpdate={onUpdate}
                      pending={pending}
                    />
                  )}
                </TableCell>
                <TableCell className='font-mono text-xs'>{item.id}</TableCell>
                {hasEditableItem && (
                  <TableCell>
                    {(!('status' in item) || item.status === ACTIVE_STATUS) &&
                      (!canEdit || canEdit(item.id)) && (
                        <ConfirmActionButton
                          label={t('admin.common.archive')}
                          title={t(
                            emptyPreset === 'teams'
                              ? 'admin.confirm.archiveTeamTitle'
                              : 'admin.confirm.archiveProjectTitle',
                            { name: item.name }
                          )}
                          description={t(
                            emptyPreset === 'teams'
                              ? 'admin.confirm.archiveTeamDescription'
                              : 'admin.confirm.archiveProjectDescription'
                          )}
                          pending={pending}
                          onConfirm={() => onArchive(item.id)}
                        />
                      )}
                  </TableCell>
                )}
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
  const authUser = useAuthStore((state) => state.auth.user)
  const isSuperAdmin = Boolean(authUser?.is_super_admin)
  const invalidate = useInvalidateAll()
  const { projectsQuery, projectId, setProjectId, projectOptions } =
    useProjectsAndSelection()
  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: listTeams,
    enabled: isSuperAdmin,
  })
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: listUsers,
    enabled: isSuperAdmin,
  })
  const selectedProject = projectsQuery.data?.items.find(
    (project) => project.id === projectId
  )
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => listProjectMembers(projectId),
    enabled: projectId.length > 0,
  })
  const selectedRole = activeProjectRole(membersQuery.data?.items, authUser?.id)
  const canManageSelectedProject = Boolean(
    selectedProject?.status === ACTIVE_STATUS &&
    (isSuperAdmin || selectedRole === ROLE_ADMIN)
  )
  const memberCandidatesQuery = useQuery({
    queryKey: ['project-member-candidates', projectId],
    queryFn: () => listProjectMemberCandidates(projectId),
    enabled: projectId.length > 0 && canManageSelectedProject,
  })
  const memberCandidatesLoading = isSuperAdmin
    ? usersQuery.isLoading || membersQuery.isLoading
    : memberCandidatesQuery.isLoading
  const memberCandidatesIsError = isSuperAdmin
    ? usersQuery.isError || membersQuery.isError
    : memberCandidatesQuery.isError
  const memberCandidatesError = isSuperAdmin
    ? (usersQuery.error ?? membersQuery.error)
    : memberCandidatesQuery.error
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
  const projectAdminOptions =
    usersQuery.data?.items
      .filter((user) => user.status === ACTIVE_STATUS && !user.is_super_admin)
      .map((user) => ({
        value: user.id,
        label: user.name ? `${user.name} · ${user.email}` : user.email,
      })) ?? []
  const memberCandidateOptions = memberCandidatesLoading
    ? []
    : ((isSuperAdmin
        ? usersQuery.data?.items.filter(
            (user) =>
              user.status === ACTIVE_STATUS &&
              !user.is_super_admin &&
              !membersQuery.data?.items.some(
                (member) =>
                  member.user_id === user.id && member.status === ACTIVE_STATUS
              )
          )
        : memberCandidatesQuery.data?.items
      )?.map((user) => ({
        value: user.id,
        label: user.name ? `${user.name} · ${user.email}` : user.email,
      })) ?? [])
  return (
    <PageChrome page='projects'>
      <LoadingErrorState
        state={{
          isLoading: projectsQuery.isLoading,
          isError: projectsQuery.isError,
          error: projectsQuery.error,
        }}
      />
      {isSuperAdmin && (
        <FormCard
          title={t('admin.sections.createProject')}
          submitLabel={t('admin.common.create')}
          pending={createMutation.isPending}
          onSubmit={(formData) =>
            createMutation.mutateAsync({
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
              placeholder={t('admin.placeholders.selectTeam')}
              options={teamOptions}
              required
            />
            <NativeSelect
              name='admin_user_id'
              label={t('admin.fields.initialAdmin')}
              placeholder={t('admin.placeholders.useCurrentUser')}
              options={projectAdminOptions}
              hint={t('admin.projects.initialAdminHint')}
            />
            <TextField label={t('admin.fields.name')} name='name' required />
            <TextField
              label={t('admin.fields.description')}
              name='description'
            />
          </div>
        </FormCard>
      )}
      <NameDescriptionTable
        emptyPreset='projects'
        items={projectsQuery.data?.items ?? []}
        canEdit={(id) =>
          projectsQuery.data?.items.find((project) => project.id === id)
            ?.status === ACTIVE_STATUS &&
          (isSuperAdmin || (id === projectId && canManageSelectedProject))
        }
        onUpdate={(id, name, description) =>
          updateMutation.mutateAsync({ id, name, description })
        }
        onArchive={(id) => archiveMutation.mutateAsync(id)}
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
        {canManageSelectedProject && (
          <>
            <LoadingErrorState
              state={{
                isLoading: memberCandidatesLoading,
                isError: memberCandidatesIsError,
                error: memberCandidatesError,
              }}
            />
            {memberCandidateOptions.length ? (
              <form
                className='grid gap-3 md:grid-cols-[1fr_12rem_auto]'
                onSubmit={(event) => {
                  event.preventDefault()
                  const form = event.currentTarget
                  const formData = new FormData(form)
                  addMemberMutation.mutate(
                    {
                      userId: fieldValue(formData, 'user_id'),
                      role: numberValue(formData, 'role', ROLE_READER),
                    },
                    { onSuccess: () => form.reset() }
                  )
                }}
              >
                <NativeSelect
                  name='user_id'
                  label={t('admin.fields.user')}
                  placeholder={t('admin.placeholders.selectUser')}
                  options={memberCandidateOptions}
                  required
                />
                <NativeSelect
                  name='role'
                  label={t('admin.fields.role')}
                  placeholder={t('admin.roles.reader')}
                  options={roleOptions(t)}
                  defaultValue={String(ROLE_READER)}
                />
                <Button
                  type='submit'
                  className='self-end'
                  disabled={
                    !projectId ||
                    memberCandidatesLoading ||
                    addMemberMutation.isPending
                  }
                >
                  {t('admin.common.add')}
                </Button>
                {addMemberMutation.isError && (
                  <Alert
                    className='md:col-span-3'
                    variant='destructive'
                    aria-live='polite'
                  >
                    <AlertCircle />
                    <AlertTitle>{t('admin.common.error')}</AlertTitle>
                    <AlertDescription>
                      {addMemberMutation.error.message}
                    </AlertDescription>
                  </Alert>
                )}
              </form>
            ) : (
              !memberCandidatesLoading && (
                <p className='text-sm text-muted-foreground'>
                  {t('admin.emptyStates.memberCandidates.description')}
                </p>
              )
            )}
          </>
        )}
        <MembersTable
          members={membersQuery.data?.items ?? []}
          users={[
            ...(usersQuery.data?.items ?? []),
            ...(memberCandidatesQuery.data?.items ?? []),
          ]}
          onRole={(userId, role) => roleMutation.mutateAsync({ userId, role })}
          onRemove={(userId) => removeMutation.mutateAsync(userId)}
          pending={roleMutation.isPending || removeMutation.isPending}
          readOnly={!canManageSelectedProject}
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

function MemberRoleControl({
  userLabel,
  role,
  pending,
  onRole,
}: {
  userLabel: string
  role: number
  pending: boolean
  onRole: (role: number) => Promise<unknown>
}) {
  const { t } = useLanguage()
  const [nextRole, setNextRole] = useState(role)
  const currentRoleLabel =
    roleOptions(t).find((option) => option.value === String(role))?.label ??
    `${t('admin.common.unknown')} ${role}`
  const nextRoleLabel =
    roleOptions(t).find((option) => option.value === String(nextRole))?.label ??
    `${t('admin.common.unknown')} ${nextRole}`
  const changed = nextRole !== role

  return (
    <div className='flex min-w-56 flex-wrap items-center gap-2'>
      <select
        className='h-9 rounded-md border border-input bg-background px-3 text-sm'
        value={String(nextRole)}
        aria-label={`${t('admin.fields.role')}: ${userLabel}`}
        disabled={pending}
        onChange={(event) => setNextRole(Number(event.currentTarget.value))}
      >
        {roleOptions(t).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {changed && (
        <ConfirmActionButton
          label={t('admin.common.save')}
          title={t('admin.confirm.changeMemberRoleTitle', {
            user: userLabel,
            from: currentRoleLabel,
            to: nextRoleLabel,
          })}
          description={t('admin.confirm.changeMemberRoleDescription')}
          destructive={role === ROLE_ADMIN && nextRole !== ROLE_ADMIN}
          pending={pending}
          onConfirm={() => onRole(nextRole)}
        />
      )}
    </div>
  )
}

function MembersTable({
  members,
  users,
  onRole,
  onRemove,
  pending = false,
  readOnly = false,
}: {
  members: Awaited<ReturnType<typeof listProjectMembers>>['items']
  users: UserDTO[]
  onRole: (userId: string, role: number) => Promise<unknown>
  onRemove: (userId: string) => Promise<unknown>
  pending?: boolean
  readOnly?: boolean
}) {
  const { t } = useLanguage()
  const userEmail = (userId: string) =>
    users.find((user) => user.id === userId)?.email
  return members.length ? (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.fields.user')}</TableHead>
          <TableHead>{t('admin.fields.role')}</TableHead>
          <TableHead>{t('admin.fields.status')}</TableHead>
          {!readOnly && <TableHead>{t('admin.fields.actions')}</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => {
          const memberUserLabel =
            member.user_email ?? userEmail(member.user_id) ?? member.user_id
          const memberReadOnly = readOnly || member.status !== ACTIVE_STATUS
          const protectsLastAdmin =
            member.status === ACTIVE_STATUS &&
            member.role === ROLE_ADMIN &&
            !members.some(
              (other) =>
                other.user_id !== member.user_id &&
                other.status === ACTIVE_STATUS &&
                other.user_status === ACTIVE_STATUS &&
                other.role === ROLE_ADMIN
            )
          return (
            <TableRow key={member.user_id}>
              <TableCell>
                <div className='grid gap-1'>
                  <span className='font-medium'>{memberUserLabel}</span>
                  {member.user_name && (
                    <span className='text-xs text-muted-foreground'>
                      {member.user_name}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {memberReadOnly || protectsLastAdmin ? (
                  <div className='grid gap-1'>
                    <span>
                      {
                        roleOptions(t).find(
                          (option) => option.value === String(member.role)
                        )?.label
                      }
                    </span>
                    {protectsLastAdmin && (
                      <span className='max-w-72 text-xs text-muted-foreground'>
                        {t('admin.projects.lastAdminProtected')}
                      </span>
                    )}
                  </div>
                ) : (
                  <MemberRoleControl
                    key={`${member.user_id}:${member.role}`}
                    userLabel={memberUserLabel}
                    role={member.role}
                    pending={pending}
                    onRole={(role) => onRole(member.user_id, role)}
                  />
                )}
              </TableCell>
              <TableCell>
                <StatusBadge>
                  {member.status === ACTIVE_STATUS
                    ? accountStatusLabel(member.user_status, t)
                    : accountStatusLabel(member.status, t)}
                </StatusBadge>
              </TableCell>
              {!readOnly && (
                <TableCell>
                  {!memberReadOnly && !protectsLastAdmin && (
                    <ConfirmActionButton
                      label={t('admin.actions.removeMember')}
                      title={t('admin.confirm.removeMemberTitle', {
                        user: memberUserLabel,
                      })}
                      description={t('admin.confirm.removeMemberDescription')}
                      pending={pending}
                      onConfirm={() => onRemove(member.user_id)}
                    />
                  )}
                </TableCell>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  ) : (
    <EmptyState preset='members' />
  )
}

export function DocumentsPage({
  search,
  onSearchChange,
}: VdocPageDeepLinkProps = {}) {
  const { t } = useLanguage()
  const invalidate = useInvalidateAll()
  const authUser = useAuthStore((state) => state.auth.user)
  const [documentTypeFilter, setDocumentTypeFilter] = useState(0)
  const {
    projectsQuery,
    projectId,
    setProjectId,
    projectOptions,
    invalidProjectDeepLink,
  } = useProjectsAndSelection(search?.project_id, (value) =>
    onSearchChange?.({
      project_id: value || undefined,
      document_id: undefined,
      branch_id: undefined,
      draft_id: undefined,
      version_id: undefined,
      endpoint_id: undefined,
      from_version_id: undefined,
      to_version_id: undefined,
      diff_id: undefined,
    })
  )
  const {
    documentsQuery,
    documentId,
    setDocumentId,
    documentOptions,
    invalidDocumentDeepLink,
  } = useDocumentsAndSelection(
    projectId,
    documentTypeFilter > 0 ? documentTypeFilter : undefined,
    search?.document_id,
    (value) =>
      onSearchChange?.({
        document_id: value || undefined,
        branch_id: undefined,
        draft_id: undefined,
        version_id: undefined,
        endpoint_id: undefined,
        from_version_id: undefined,
        to_version_id: undefined,
        diff_id: undefined,
      })
  )
  const branchesQuery = useQuery({
    queryKey: ['branches', projectId, documentId],
    queryFn: () => listBranches(projectId, documentId),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => listProjectMembers(projectId),
    enabled: projectId.length > 0 && !authUser?.is_super_admin,
  })
  const canManageShares = Boolean(
    authUser?.is_super_admin ||
    activeProjectRole(membersQuery.data?.items, authUser?.id) === ROLE_ADMIN
  )
  const canManageDocuments = canManageShares
  const selectedProject = projectsQuery.data?.items.find(
    (project) => project.id === projectId
  )
  const selectedDocument = documentsQuery.data?.items.find(
    (document) => document.id === documentId
  )
  const canMutateProject = Boolean(
    canManageDocuments && selectedProject?.status === ACTIVE_STATUS
  )
  const canMutateDocument = Boolean(
    canMutateProject && selectedDocument?.status === ACTIVE_STATUS
  )
  const documentVersionsQuery = useQuery({
    queryKey: ['versions', projectId, documentId, 'document-summary'],
    queryFn: () => listVersions(projectId, documentId),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const latestDocumentVersion = documentVersionsQuery.data?.items[0]
  const documentEndpointsQuery = useQuery({
    queryKey: [
      'endpoints',
      projectId,
      documentId,
      latestDocumentVersion?.id,
      'document-summary',
    ],
    queryFn: () =>
      listEndpoints(projectId, documentId, latestDocumentVersion?.id ?? ''),
    enabled:
      latestDocumentVersion !== undefined &&
      documentsQuery.data?.items.find((item) => item.id === documentId)
        ?.document_type === DOCUMENT_TYPE_OPENAPI,
  })
  const markdownContentQuery = useQuery({
    queryKey: [
      'version-content',
      projectId,
      documentId,
      latestDocumentVersion?.id,
      'raw',
      'document-summary',
    ],
    queryFn: () =>
      getVersionContent(
        projectId,
        documentId,
        latestDocumentVersion?.id ?? '',
        'raw'
      ),
    enabled:
      latestDocumentVersion !== undefined &&
      documentsQuery.data?.items.find((item) => item.id === documentId)
        ?.document_type === DOCUMENT_TYPE_MARKDOWN,
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
      <DeepLinkAlert
        targets={[
          ...(invalidProjectDeepLink
            ? [`${t('admin.fields.project')}: ${search?.project_id}`]
            : []),
          ...(!invalidProjectDeepLink && invalidDocumentDeepLink
            ? [`${t('admin.fields.document')}: ${search?.document_id}`]
            : []),
        ]}
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
        <NativeSelect
          label={t('admin.fields.type')}
          value={String(documentTypeFilter)}
          onChange={(value) => {
            setDocumentTypeFilter(Number(value))
            setDocumentId('')
          }}
          placeholder={t('admin.common.all')}
          options={[
            { value: '0', label: t('admin.common.all') },
            ...documentTypeOptions(t),
          ]}
        />
      </SelectorGrid>
      {canMutateProject && (
        <FormCard
          title={t('admin.sections.createDocument')}
          submitLabel={t('admin.common.create')}
          pending={createDocumentMutation.isPending}
          onSubmit={(formData) =>
            createDocumentMutation.mutateAsync({
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
            <TextField
              label={t('admin.fields.description')}
              name='description'
            />
          </div>
        </FormCard>
      )}
      <DocumentsTable
        documents={documentsQuery.data?.items ?? []}
        pending={
          updateDocumentMutation.isPending || archiveDocumentMutation.isPending
        }
        onUpdate={(document) =>
          updateDocumentMutation.mutateAsync({
            id: document.id,
            payload: {
              name: document.name,
              description: document.description ?? '',
              relative_path: document.relative_path ?? '',
            },
          })
        }
        onArchive={(id) => archiveDocumentMutation.mutateAsync(id)}
        readOnly={!canMutateProject}
      />
      {documentId && (
        <section className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <StatCard
            title={t('admin.sections.versions')}
            value={String(documentVersionsQuery.data?.total ?? 0)}
            description={t('admin.pages.versions.cue')}
          />
          <StatCard
            title={t('admin.fields.versionName')}
            value={latestDocumentVersion?.version_name ?? '—'}
            description={t('admin.pages.versions.next')}
          />
          <StatCard
            title={
              documentsQuery.data?.items.find((item) => item.id === documentId)
                ?.document_type === DOCUMENT_TYPE_MARKDOWN
                ? t('admin.markdownFacts.lineCount', {
                    count: String(
                      markdownContentQuery.data?.content.split('\n').length ?? 0
                    ),
                  })
                : t('admin.sections.endpoints')
            }
            value={
              documentsQuery.data?.items.find((item) => item.id === documentId)
                ?.document_type === DOCUMENT_TYPE_MARKDOWN
                ? `${new TextEncoder().encode(markdownContentQuery.data?.content ?? '').length} B`
                : String(documentEndpointsQuery.data?.total ?? 0)
            }
            description={t('admin.pages.documents.cue')}
          />
          <StatCard
            title={t('admin.sections.branches')}
            value={String(branchesQuery.data?.total ?? 0)}
            description={t('admin.pages.documents.next')}
          />
        </section>
      )}
      {canMutateDocument && (
        <FormCard
          title={t('admin.sections.createBranch')}
          submitLabel={t('admin.common.create')}
          pending={createBranchMutation.isPending}
          onSubmit={(formData) =>
            createBranchMutation.mutateAsync({
              name: fieldValue(formData, 'name'),
              description: fieldValue(formData, 'description'),
            })
          }
        >
          <div className='grid gap-4 md:grid-cols-2'>
            <TextField label={t('admin.fields.name')} name='name' required />
            <TextField
              label={t('admin.fields.description')}
              name='description'
            />
          </div>
        </FormCard>
      )}
      <BranchesTable
        branches={branchesQuery.data?.items ?? []}
        pending={
          updateBranchMutation.isPending || archiveBranchMutation.isPending
        }
        onUpdate={(branch) =>
          updateBranchMutation.mutateAsync({
            id: branch.id,
            payload: {
              name: branch.name,
              description: branch.description ?? '',
              is_default: branch.is_default,
              is_protected: branch.is_protected,
            },
          })
        }
        onArchive={(id) => archiveBranchMutation.mutateAsync(id)}
        readOnly={!canMutateDocument}
      />
      <DocumentSharePanel
        key={`${projectId}:${documentId}`}
        projectId={projectId}
        documentId={documentId}
        documentName={selectedDocument?.name ?? ''}
        branches={branchesQuery.data?.items ?? []}
        versions={documentVersionsQuery.data?.items ?? []}
        canManage={canManageShares}
        interactive={canMutateDocument}
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
  pending,
  readOnly = false,
}: {
  documents: DocumentDTO[]
  onUpdate: (document: DocumentDTO) => Promise<unknown>
  onArchive: (id: string) => Promise<unknown>
  pending: boolean
  readOnly?: boolean
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
              {!readOnly && <TableHead>{t('admin.fields.actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((document) => (
              <TableRow key={document.id}>
                <TableCell className='min-w-96'>
                  {readOnly || document.status !== ACTIVE_STATUS ? (
                    <div className='grid gap-1'>
                      <span className='font-medium'>{document.name}</span>
                      <span className='text-xs text-muted-foreground'>
                        {document.relative_path}
                      </span>
                    </div>
                  ) : (
                    <DocumentEditForm
                      document={document}
                      pending={pending}
                      onUpdate={onUpdate}
                    />
                  )}
                </TableCell>
                <TableCell>
                  {documentTypeLabel(document.document_type, t)}
                </TableCell>
                <TableCell>
                  <StatusBadge>
                    {resourceStatusLabel(document.status, t)}
                  </StatusBadge>
                </TableCell>
                {!readOnly && (
                  <TableCell>
                    {document.status === ACTIVE_STATUS && (
                      <ConfirmActionButton
                        label={t('admin.common.archive')}
                        title={t('admin.confirm.archiveDocumentTitle', {
                          name: document.name,
                        })}
                        description={t(
                          'admin.confirm.archiveDocumentDescription'
                        )}
                        pending={pending}
                        onConfirm={() => onArchive(document.id)}
                      />
                    )}
                  </TableCell>
                )}
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

function DocumentEditForm({
  document,
  pending,
  onUpdate,
}: {
  document: DocumentDTO
  pending: boolean
  onUpdate: (document: DocumentDTO) => Promise<unknown>
}) {
  const { t } = useLanguage()
  const [error, setError] = useState<Error>()
  const submitLockedRef = useRef(false)
  return (
    <form
      className='grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_auto]'
      onSubmit={async (event) => {
        event.preventDefault()
        if (submitLockedRef.current) return
        submitLockedRef.current = true
        const formData = new FormData(event.currentTarget)
        setError(undefined)
        try {
          await onUpdate({
            ...document,
            name: fieldValue(formData, 'name'),
            description: fieldValue(formData, 'description'),
            relative_path: fieldValue(formData, 'relative_path'),
          })
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause
              : new Error(t('toasts.somethingWrong'))
          )
        } finally {
          submitLockedRef.current = false
        }
      }}
    >
      <Input
        name='name'
        defaultValue={document.name}
        aria-label={t('admin.fields.name')}
        required
      />
      <Input
        name='relative_path'
        defaultValue={document.relative_path ?? ''}
        aria-label={t('admin.fields.relativePath')}
        required
      />
      <Input
        name='description'
        defaultValue={document.description ?? ''}
        aria-label={t('admin.fields.description')}
      />
      <Button type='submit' variant='outline' size='sm' disabled={pending}>
        {t('admin.common.save')}
      </Button>
      {error && (
        <Alert
          className='md:col-span-2 xl:col-span-4'
          variant='destructive'
          aria-live='polite'
        >
          <AlertCircle />
          <AlertTitle>{t('admin.common.error')}</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
    </form>
  )
}

function BranchesTable({
  branches,
  onUpdate,
  onArchive,
  pending,
  readOnly = false,
}: {
  branches: BranchDTO[]
  onUpdate: (branch: BranchDTO) => Promise<unknown>
  onArchive: (id: string) => Promise<unknown>
  pending: boolean
  readOnly?: boolean
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
              {!readOnly && <TableHead>{t('admin.fields.actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell className='min-w-96'>
                  {readOnly || branch.status !== ACTIVE_STATUS ? (
                    <div className='grid gap-1'>
                      <span className='font-medium'>{branch.name}</span>
                      <span className='text-xs text-muted-foreground'>
                        {branch.description || t('admin.common.none')}
                      </span>
                    </div>
                  ) : (
                    <BranchEditForm
                      branch={branch}
                      pending={pending}
                      onUpdate={onUpdate}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge>
                    {resourceStatusLabel(branch.status, t)}
                  </StatusBadge>
                </TableCell>
                {!readOnly && (
                  <TableCell>
                    {branch.status === ACTIVE_STATUS && (
                      <ConfirmActionButton
                        label={t('admin.common.archive')}
                        title={t('admin.confirm.archiveBranchTitle', {
                          name: branch.name,
                        })}
                        description={t(
                          'admin.confirm.archiveBranchDescription'
                        )}
                        pending={pending}
                        disabled={branch.is_default}
                        onConfirm={() => onArchive(branch.id)}
                      />
                    )}
                  </TableCell>
                )}
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

function BranchEditForm({
  branch,
  pending,
  onUpdate,
}: {
  branch: BranchDTO
  pending: boolean
  onUpdate: (branch: BranchDTO) => Promise<unknown>
}) {
  const { t } = useLanguage()
  const [error, setError] = useState<Error>()
  const submitLockedRef = useRef(false)
  return (
    <form
      className='grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_1.2fr_auto]'
      onSubmit={async (event) => {
        event.preventDefault()
        if (submitLockedRef.current) return
        submitLockedRef.current = true
        const formData = new FormData(event.currentTarget)
        setError(undefined)
        try {
          await onUpdate({
            ...branch,
            name: fieldValue(formData, 'name'),
            description: fieldValue(formData, 'description'),
            is_default:
              branch.is_default || formData.get('is_default') === 'on',
            is_protected: formData.get('is_protected') === 'on',
          })
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause
              : new Error(t('toasts.somethingWrong'))
          )
        } finally {
          submitLockedRef.current = false
        }
      }}
    >
      <Input
        name='name'
        defaultValue={branch.name}
        aria-label={t('admin.fields.name')}
        required
      />
      <Input
        name='description'
        defaultValue={branch.description ?? ''}
        aria-label={t('admin.fields.description')}
      />
      <div className='flex flex-wrap items-center gap-3 xl:col-span-2'>
        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            name='is_default'
            defaultChecked={branch.is_default}
            disabled={branch.is_default}
          />
          {t('admin.fields.defaultBranch')}
        </label>
        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            name='is_protected'
            defaultChecked={branch.is_protected}
          />
          {t('admin.fields.protectedBranch')}
        </label>
        <Button type='submit' variant='outline' size='sm' disabled={pending}>
          {t('admin.common.save')}
        </Button>
      </div>
      {error && (
        <Alert
          className='md:col-span-2 xl:col-span-3'
          variant='destructive'
          aria-live='polite'
        >
          <AlertCircle />
          <AlertTitle>{t('admin.common.error')}</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
    </form>
  )
}

export function DraftsPage({
  search,
  onSearchChange,
}: VdocPageDeepLinkProps = {}) {
  const { t } = useLanguage()
  const invalidate = useInvalidateAll()
  const authUser = useAuthStore((state) => state.auth.user)
  const {
    projectsQuery,
    projectId,
    setProjectId,
    projectOptions,
    invalidProjectDeepLink,
  } = useProjectsAndSelection(search?.project_id, (value) =>
    onSearchChange?.({
      project_id: value || undefined,
      document_id: undefined,
      branch_id: undefined,
      draft_id: undefined,
      version_id: undefined,
      endpoint_id: undefined,
      from_version_id: undefined,
      to_version_id: undefined,
      diff_id: undefined,
    })
  )
  const {
    documentId,
    selectedDocument,
    setDocumentId,
    documentOptions,
    invalidDocumentDeepLink,
  } = useDocumentsAndSelection(
    projectId,
    undefined,
    search?.document_id,
    (value) =>
      onSearchChange?.({
        document_id: value || undefined,
        branch_id: undefined,
        draft_id: undefined,
        version_id: undefined,
        endpoint_id: undefined,
        from_version_id: undefined,
        to_version_id: undefined,
        diff_id: undefined,
      })
  )
  const branchesQuery = useQuery({
    queryKey: ['branches', projectId, documentId],
    queryFn: () => listBranches(projectId, documentId),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const [branchFilter, setBranchFilter] = useRouteControlledString(
    search?.branch_id,
    onSearchChange !== undefined
  )
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => listProjectMembers(projectId),
    enabled: projectId.length > 0 && !authUser?.is_super_admin,
  })
  const canPublishForRole = Boolean(
    authUser?.is_super_admin ||
    activeProjectRole(membersQuery.data?.items, authUser?.id) === ROLE_ADMIN
  )
  const canDraftForRole = Boolean(
    authUser?.is_super_admin ||
    (activeProjectRole(membersQuery.data?.items, authUser?.id) ?? 0) >=
      ROLE_WRITER
  )
  const draftsQuery = useQuery({
    queryKey: ['drafts', projectId, documentId, branchFilter || 'all'],
    queryFn: () =>
      branchFilter
        ? listDrafts(projectId, documentId, branchFilter)
        : listDrafts(projectId, documentId),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const [draftId, setDraftId] = useRouteControlledString(
    search?.draft_id,
    onSearchChange !== undefined
  )
  const [contentKind, setContentKind] = useState('raw')
  const [reviewNote, setReviewNote] = useState('')
  const [pendingReviewAction, setPendingReviewAction] = useState<{
    projectId: string
    documentId: string
    draftId: string
    draftName: string
    action: DraftReviewAction
    comment?: string
  }>()
  const reviewActionLockedRef = useRef(false)
  const [promoteSourceBranchId, setPromoteSourceBranchId] = useState('')
  const [promoteTargetBranchId, setPromoteTargetBranchId] = useState('')
  const draftExistsInDocument = (draftsQuery.data?.items ?? []).some(
    (draft) => draft.id === draftId
  )
  const selectedDraft = draftsQuery.data?.items.find(
    (draft) => draft.id === draftId
  )
  const selectedProject = projectsQuery.data?.items.find(
    (project) => project.id === projectId
  )
  const activeBranches = (branchesQuery.data?.items ?? []).filter(
    (branch) => branch.status === ACTIVE_STATUS
  )
  const activeBranchIds = new Set(activeBranches.map((branch) => branch.id))
  const invalidBranchDeepLink = Boolean(
    branchesQuery.data &&
    search?.branch_id &&
    !branchesQuery.data.items.some((branch) => branch.id === search.branch_id)
  )
  const invalidDraftDeepLink = Boolean(
    !invalidBranchDeepLink &&
    draftsQuery.data &&
    search?.draft_id &&
    !draftsQuery.data.items.some((draft) => draft.id === search.draft_id)
  )
  const activeDocumentContext = Boolean(
    selectedProject?.status === ACTIVE_STATUS &&
    selectedDocument?.status === ACTIVE_STATUS
  )
  const selectedDraftBranchActive = Boolean(
    selectedDraft && activeBranchIds.has(selectedDraft.branch_id)
  )
  const selectedDraftAIInteractive = Boolean(
    selectedDraft && activeDocumentContext && selectedDraftBranchActive
  )
  const canDraft = canDraftForRole && activeDocumentContext
  const canPublish = canPublishForRole && activeDocumentContext
  const canReviewSelectedDraft = Boolean(
    canPublish &&
    selectedDraft &&
    activeBranchIds.has(selectedDraft.branch_id) &&
    selectedDraft.status === DRAFT_STATUS_SUBMITTED
  )
  const selectedDraftAITarget: AISummaryTarget | undefined = selectedDraft
    ? {
        projectId,
        documentId,
        ownerType: 'draft',
        ownerId: selectedDraft.id,
      }
    : undefined
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
  const editorRawContentQuery = useQuery({
    queryKey: ['draft-content', projectId, documentId, draftId, 'raw'],
    queryFn: () => getDraftContent(projectId, documentId, draftId, 'raw'),
    enabled:
      selectedDraft !== undefined &&
      (selectedDraft.status === DRAFT_STATUS_DRAFT ||
        selectedDraft.status === DRAFT_STATUS_CHANGES_REQUESTED),
  })
  const versionsQuery = useQuery({
    queryKey: ['versions', projectId, documentId, 'promote-sources'],
    queryFn: () => listVersions(projectId, documentId),
    enabled: canPublish,
  })
  const publishedBranchIds = new Set(
    versionsQuery.data?.items.map((version) => version.branch_id) ?? []
  )
  const promoteSourceOptions = activeBranches
    .filter((branch) => publishedBranchIds.has(branch.id))
    .map((branch) => ({ value: branch.id, label: branch.name }))
  const promoteTargetOptions = activeBranches
    .filter((branch) => branch.id !== promoteSourceBranchId)
    .map((branch) => ({ value: branch.id, label: branch.name }))
  const promotionAvailable = promoteSourceOptions.some((source) =>
    activeBranches.some((target) => target.id !== source.value)
  )
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
  const promoteMutation = useMutation({
    mutationFn: (payload: Parameters<typeof promoteDraft>[2]) =>
      promoteDraft(projectId, documentId, payload),
    onSuccess: invalidate,
  })
  const actionMutation = useMutation({
    mutationFn: (request: DraftActionRequest) => runDraftAction(request),
    onSuccess: (_data, variables) => {
      if (variables.action !== 'submit') {
        setReviewNote('')
        setPendingReviewAction(undefined)
      }
      invalidate()
    },
    onSettled: () => {
      reviewActionLockedRef.current = false
    },
  })
  const handleProjectChange = (value: string) => {
    setDraftId('')
    setBranchFilter('')
    setContentKind('raw')
    setReviewNote('')
    setPendingReviewAction(undefined)
    setPromoteSourceBranchId('')
    setPromoteTargetBranchId('')
    setProjectId(value)
  }
  const handleDocumentChange = (value: string) => {
    setDraftId('')
    setBranchFilter('')
    setContentKind('raw')
    setReviewNote('')
    setPendingReviewAction(undefined)
    setPromoteSourceBranchId('')
    setPromoteTargetBranchId('')
    setDocumentId(value)
  }
  const handleDraftSelect = (value: string) => {
    setDraftId(value)
    setReviewNote('')
    setPendingReviewAction(undefined)
    const draft = draftsQuery.data?.items.find((item) => item.id === value)
    if (draft && branchFilter !== draft.branch_id) {
      setBranchFilter(draft.branch_id)
    }
    onSearchChange?.({
      branch_id: draft?.branch_id || branchFilter || undefined,
      draft_id: value || undefined,
    })
  }
  const reviewConfirmation = pendingReviewAction
    ? draftReviewConfirmation(pendingReviewAction, t)
    : undefined
  const selectedDraftContent = contentQuery.data?.content
  return (
    <PageChrome page='drafts'>
      <DeepLinkAlert
        targets={[
          ...(invalidProjectDeepLink
            ? [`${t('admin.fields.project')}: ${search?.project_id}`]
            : []),
          ...(!invalidProjectDeepLink && invalidDocumentDeepLink
            ? [`${t('admin.fields.document')}: ${search?.document_id}`]
            : []),
          ...(!invalidProjectDeepLink &&
          !invalidDocumentDeepLink &&
          invalidBranchDeepLink
            ? [`${t('admin.fields.branch')}: ${search?.branch_id}`]
            : []),
          ...(!invalidProjectDeepLink &&
          !invalidDocumentDeepLink &&
          invalidDraftDeepLink
            ? [`${t('admin.fields.draft')}: ${search?.draft_id}`]
            : []),
        ]}
      />
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
          label={t('admin.fields.branch')}
          value={branchFilter}
          onChange={(value) => {
            setDraftId('')
            setReviewNote('')
            setPendingReviewAction(undefined)
            setBranchFilter(value)
            onSearchChange?.({
              branch_id: value || undefined,
              draft_id: undefined,
            })
          }}
          placeholder={t('admin.common.all')}
          options={[
            { value: '', label: t('admin.common.all') },
            ...(branchesQuery.data?.items.map((branch) => ({
              value: branch.id,
              label: entityOptionLabel(branch.name, branch.status, t),
            })) ?? []),
          ]}
        />
        <NativeSelect
          label={t('admin.fields.draft')}
          value={draftExistsInDocument ? draftId : ''}
          onChange={handleDraftSelect}
          placeholder={t('admin.fields.draft')}
          options={
            draftsQuery.data?.items.map((draft) => ({
              value: draft.id,
              label: draft.version_name,
            })) ?? []
          }
        />
      </SelectorGrid>
      {canDraftForRole && (
        <DraftEditorCard
          selectedDraft={selectedDraft}
          rawContent={editorRawContentQuery.data?.content}
          rawContentState={{
            isLoading: editorRawContentQuery.isLoading,
            isError: editorRawContentQuery.isError,
            error: editorRawContentQuery.error,
          }}
          branches={activeBranches}
          contextActive={activeDocumentContext}
          pending={createMutation.isPending || updateMutation.isPending}
          onClear={() => handleDraftSelect('')}
          onCreate={(payload) => createMutation.mutateAsync(payload)}
          onUpdate={(id, payload) =>
            updateMutation.mutateAsync({ id, payload })
          }
        />
      )}
      {canPublish && (
        <>
          {promotionAvailable ? (
            <FormCard
              title={t('admin.sections.promoteDraft')}
              submitLabel={t('admin.common.createPromotionDraft')}
              pending={promoteMutation.isPending}
              onSubmit={async (formData) => {
                await promoteMutation.mutateAsync({
                  source_branch_id: fieldValue(formData, 'source_branch_id'),
                  target_branch_id: fieldValue(formData, 'target_branch_id'),
                  version_name: fieldValue(formData, 'version_name'),
                  changelog: fieldValue(formData, 'changelog'),
                })
                setPromoteSourceBranchId('')
                setPromoteTargetBranchId('')
              }}
            >
              <div className='grid gap-4 md:grid-cols-2'>
                <NativeSelect
                  name='source_branch_id'
                  label={t('admin.fields.sourceBranch')}
                  placeholder={t('admin.placeholders.selectPublishedBranch')}
                  options={promoteSourceOptions}
                  value={promoteSourceBranchId}
                  onChange={(value) => {
                    setPromoteSourceBranchId(value)
                    setPromoteTargetBranchId('')
                  }}
                  required
                />
                <NativeSelect
                  name='target_branch_id'
                  label={t('admin.fields.targetBranch')}
                  placeholder={t('admin.placeholders.selectBranch')}
                  options={promoteTargetOptions}
                  value={promoteTargetBranchId}
                  onChange={setPromoteTargetBranchId}
                  disabled={!promoteSourceBranchId}
                  required
                />
                <TextField
                  label={t('admin.fields.versionName')}
                  name='version_name'
                  required
                />
                <TextField
                  label={t('admin.fields.changelog')}
                  name='changelog'
                />
              </div>
            </FormCard>
          ) : (
            !versionsQuery.isLoading && (
              <Alert>
                <Route />
                <AlertTitle>{t('admin.promote.unavailableTitle')}</AlertTitle>
                <AlertDescription>
                  {t('admin.promote.unavailableDescription')}
                </AlertDescription>
              </Alert>
            )
          )}
        </>
      )}
      <DraftsTable
        drafts={draftsQuery.data?.items ?? []}
        selected={draftId}
        onSelect={handleDraftSelect}
        onAction={(id, action) =>
          actionMutation.mutate({
            projectId,
            documentId,
            draftId: id,
            action,
          })
        }
        canDraft={canDraft}
        pending={actionMutation.isPending}
        activeBranchIds={activeBranchIds}
      />
      {actionMutation.isError &&
        actionMutation.variables?.action === 'submit' && (
          <Alert variant='destructive' aria-live='polite'>
            <AlertCircle />
            <AlertTitle>{t('admin.common.error')}</AlertTitle>
            <AlertDescription>{actionMutation.error.message}</AlertDescription>
          </Alert>
        )}
      {selectedDraft?.review_comment && (
        <Alert>
          <BookOpenText />
          <AlertTitle>{t('admin.fields.reviewNote')}</AlertTitle>
          <AlertDescription>{selectedDraft.review_comment}</AlertDescription>
        </Alert>
      )}
      {selectedDraft?.diff_preview && (
        <CollectionCard
          title={t('admin.sections.diffPreview')}
          count={selectedDraft.diff_preview.items.length}
        >
          <DiffSummaryCards
            summary={selectedDraft.diff_preview.summary}
            isMarkdown={
              selectedDocument?.document_type === DOCUMENT_TYPE_MARKDOWN
            }
          />
          <DiffReviewList
            items={selectedDraft.diff_preview.items}
            isMarkdown={
              selectedDocument?.document_type === DOCUMENT_TYPE_MARKDOWN
            }
          />
        </CollectionCard>
      )}
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
        content={selectedDraftContent}
      />
      {selectedDocument?.document_type === DOCUMENT_TYPE_MARKDOWN &&
        selectedDraftContent && (
          <MarkdownDocumentViewer content={selectedDraftContent} />
        )}
      <AIContextPanel
        target={selectedDraftAITarget}
        interactive={selectedDraftAIInteractive}
        canRegenerate={canPublishForRole && selectedDraftAIInteractive}
      />
      {canPublish && (
        <ReviewNotePanel
          selectedDraftName={selectedDraft?.version_name}
          value={reviewNote}
          onChange={setReviewNote}
          pending={actionMutation.isPending}
          reviewable={canReviewSelectedDraft}
          onReview={(action) => {
            if (!selectedDraft || !canReviewSelectedDraft) return
            actionMutation.reset()
            setPendingReviewAction({
              projectId,
              documentId,
              draftId: selectedDraft.id,
              draftName: selectedDraft.version_name,
              action,
              comment: reviewComment(reviewNote)?.comment,
            })
          }}
        />
      )}
      <ConfirmDialog
        open={pendingReviewAction !== undefined}
        onOpenChange={(open) => {
          if (!open && !actionMutation.isPending) {
            setPendingReviewAction(undefined)
            actionMutation.reset()
          }
        }}
        title={reviewConfirmation?.title ?? ''}
        desc={reviewConfirmation?.description ?? ''}
        confirmText={reviewConfirmation?.confirmText}
        destructive={reviewConfirmation?.destructive}
        isLoading={actionMutation.isPending}
        handleConfirm={() => {
          if (!pendingReviewAction || reviewActionLockedRef.current) return
          reviewActionLockedRef.current = true
          actionMutation.mutate({
            projectId: pendingReviewAction.projectId,
            documentId: pendingReviewAction.documentId,
            draftId: pendingReviewAction.draftId,
            action: pendingReviewAction.action,
            comment: pendingReviewAction.comment,
          })
        }}
      >
        {actionMutation.isError && (
          <Alert variant='destructive' aria-live='polite'>
            <AlertCircle />
            <AlertTitle>{t('admin.common.error')}</AlertTitle>
            <AlertDescription>
              {actionMutation.error instanceof Error
                ? actionMutation.error.message
                : t('toasts.somethingWrong')}
            </AlertDescription>
          </Alert>
        )}
      </ConfirmDialog>
    </PageChrome>
  )
}

type CreateDraftPayload = Parameters<typeof createDraft>[2]
type UpdateDraftPayload = Parameters<typeof updateDraft>[3]

function DraftEditorCard({
  selectedDraft,
  rawContent,
  rawContentState,
  branches,
  contextActive,
  pending,
  onClear,
  onCreate,
  onUpdate,
}: {
  selectedDraft?: DraftDTO
  rawContent?: string
  rawContentState: QueryState
  branches: BranchDTO[]
  contextActive: boolean
  pending: boolean
  onClear: () => void
  onCreate: (payload: CreateDraftPayload) => Promise<unknown>
  onUpdate: (id: string, payload: UpdateDraftPayload) => Promise<unknown>
}) {
  const { t } = useLanguage()
  const editable = Boolean(
    selectedDraft &&
    (selectedDraft.status === DRAFT_STATUS_DRAFT ||
      selectedDraft.status === DRAFT_STATUS_CHANGES_REQUESTED)
  )
  const selectedBranchActive = selectedDraft
    ? branches.some((branch) => branch.id === selectedDraft.branch_id)
    : true
  const formKey = selectedDraft
    ? `${selectedDraft.id}:${rawContent ?? 'loading'}`
    : 'new'

  if (selectedDraft && !editable) {
    return (
      <Card className='border-primary/20'>
        <CardHeader className='border-b pb-5'>
          <Badge variant='outline' className='w-fit'>
            {draftStatusLabel(selectedDraft.status, t)}
          </Badge>
          <CardTitle>{t('admin.draftEditor.readOnlyTitle')}</CardTitle>
          <CardDescription>
            {t('admin.draftEditor.readOnlyDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type='button' variant='outline' onClick={onClear}>
            {t('admin.draftEditor.newDraft')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (editable && rawContentState.isLoading) {
    return <LoadingErrorState state={rawContentState} />
  }

  return (
    <FormCard
      key={formKey}
      title={
        editable
          ? t('admin.draftEditor.editTitle')
          : t('admin.draftEditor.createTitle')
      }
      submitLabel={
        editable ? t('admin.common.update') : t('admin.common.create')
      }
      pending={pending}
      resetOnSuccess={!editable}
      disabled={!contextActive || !selectedBranchActive}
      onSubmit={async (formData) => {
        const file = formData.get('schema_file')
        const uploadedContent =
          file instanceof File && file.size > 0 ? await file.text() : ''
        const content = uploadedContent || fieldValue(formData, 'content')
        const payload = {
          version_name: fieldValue(formData, 'version_name'),
          changelog: fieldValue(formData, 'changelog'),
          source_git_commit_id: fieldValue(formData, 'source_git_commit_id'),
          content,
          schema_content: content,
        }
        if (editable && selectedDraft) {
          await onUpdate(selectedDraft.id, payload)
        } else {
          await onCreate({
            ...payload,
            branch_id: fieldValue(formData, 'branch_id'),
          })
        }
      }}
    >
      {editable && (
        <div className='flex flex-wrap items-center justify-between gap-3 rounded-md border bg-[var(--surface-control)] p-3'>
          <p className='text-sm text-muted-foreground'>
            {t('admin.draftEditor.branchImmutable')}
          </p>
          <Button type='button' variant='outline' size='sm' onClick={onClear}>
            {t('admin.draftEditor.newDraft')}
          </Button>
        </div>
      )}
      {(!contextActive || !selectedBranchActive) && (
        <Alert>
          <AlertCircle />
          <AlertTitle>{t('admin.draftEditor.archivedTitle')}</AlertTitle>
          <AlertDescription>
            {t('admin.draftEditor.archivedDescription')}
          </AlertDescription>
        </Alert>
      )}
      {rawContentState.isError && <LoadingErrorState state={rawContentState} />}
      <div className='grid gap-4 md:grid-cols-2'>
        {editable ? (
          <TextField
            label={t('admin.fields.branch')}
            name='branch_display'
            defaultValue={
              branches.find((branch) => branch.id === selectedDraft?.branch_id)
                ?.name ?? selectedDraft?.branch_id
            }
            readOnly
          />
        ) : (
          <NativeSelect
            name='branch_id'
            label={t('admin.fields.branch')}
            placeholder={t('admin.placeholders.selectBranch')}
            options={branches.map((branch) => ({
              value: branch.id,
              label: branch.name,
            }))}
            required
          />
        )}
        <TextField
          label={t('admin.fields.versionName')}
          name='version_name'
          defaultValue={selectedDraft?.version_name}
          required
        />
        <TextField
          label={t('admin.fields.gitCommit')}
          name='source_git_commit_id'
          defaultValue={selectedDraft?.source_git_commit_id}
        />
        <TextField
          label={t('admin.fields.changelog')}
          name='changelog'
          defaultValue={selectedDraft?.changelog}
        />
      </div>
      <TextAreaField
        label={t('admin.fields.content')}
        name='content'
        defaultValue={editable ? rawContent : ''}
      />
      <div className='grid gap-2'>
        <Label htmlFor={`schema-file-${selectedDraft?.id ?? 'new'}`}>
          {t('admin.fields.schemaFile')}
        </Label>
        <Input
          id={`schema-file-${selectedDraft?.id ?? 'new'}`}
          name='schema_file'
          type='file'
          accept='.yaml,.yml,.json,.md,text/markdown,application/json,application/yaml,text/yaml'
        />
      </div>
    </FormCard>
  )
}

function reviewComment(value: string): DraftReviewPayload | undefined {
  const comment = value.trim()
  return comment.length > 0 ? { comment } : undefined
}

function runDraftAction(request: DraftActionRequest) {
  if (request.action === 'submit') {
    return submitDraft(request.projectId, request.documentId, request.draftId)
  }
  const payload = reviewComment(request.comment ?? '')
  if (request.action === 'approve') {
    return approveDraft(
      request.projectId,
      request.documentId,
      request.draftId,
      payload
    )
  }
  if (request.action === 'request') {
    return requestDraftChanges(
      request.projectId,
      request.documentId,
      request.draftId,
      payload
    )
  }
  return rejectDraft(
    request.projectId,
    request.documentId,
    request.draftId,
    payload
  )
}

function draftReviewConfirmation(
  review: {
    readonly draftName: string
    readonly action: DraftReviewAction
  },
  t: ReturnType<typeof useLanguage>['t']
) {
  if (review.action === 'approve') {
    return {
      title: t('admin.review.confirmApproveTitle', {
        draft: review.draftName,
      }),
      description: t('admin.review.confirmApproveDescription'),
      confirmText: t('admin.common.approve'),
      destructive: false,
    }
  }
  if (review.action === 'request') {
    return {
      title: t('admin.review.confirmRequestTitle', {
        draft: review.draftName,
      }),
      description: t('admin.review.confirmRequestDescription'),
      confirmText: t('admin.common.requestChanges'),
      destructive: false,
    }
  }
  return {
    title: t('admin.review.confirmRejectTitle', { draft: review.draftName }),
    description: t('admin.review.confirmRejectDescription'),
    confirmText: t('admin.common.reject'),
    destructive: true,
  }
}

function ReviewNotePanel({
  selectedDraftName,
  value,
  onChange,
  pending,
  reviewable,
  onReview,
}: {
  readonly selectedDraftName?: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly pending: boolean
  readonly reviewable: boolean
  readonly onReview: (action: DraftReviewAction) => void
}) {
  const { t } = useLanguage()
  const noteId = useId()
  return (
    <Card className='border-primary/20'>
      <CardHeader className='border-b pb-5'>
        <Badge
          className='w-fit border-primary/20 bg-primary/8 text-primary'
          variant='outline'
        >
          {t('admin.review.noteTitle')}
        </Badge>
        <CardTitle>{t('admin.fields.reviewNote')}</CardTitle>
        <CardDescription>{t('admin.review.noteDescription')}</CardDescription>
      </CardHeader>
      <CardContent className='grid gap-3'>
        <p className='text-sm text-muted-foreground'>
          {selectedDraftName
            ? t('admin.review.selectedDraft', { draft: selectedDraftName })
            : t('admin.review.noDraftSelected')}
        </p>
        <div className='grid gap-2'>
          <Label htmlFor={noteId}>{t('admin.fields.reviewNote')}</Label>
          <Textarea
            id={noteId}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            placeholder={t('admin.placeholders.reviewNote')}
            disabled={pending || !reviewable}
            className='min-h-24'
          />
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            disabled={pending || !reviewable}
            onClick={() => onReview('approve')}
          >
            {t('admin.common.approve')}
          </Button>
          <Button
            type='button'
            variant='outline'
            disabled={pending || !reviewable}
            onClick={() => onReview('request')}
          >
            {t('admin.common.requestChanges')}
          </Button>
          <Button
            type='button'
            variant='destructive'
            disabled={pending || !reviewable}
            onClick={() => onReview('reject')}
          >
            {t('admin.common.reject')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
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

function DraftsTable({
  drafts,
  selected,
  onSelect,
  onAction,
  canDraft,
  pending,
  activeBranchIds,
}: {
  drafts: DraftDTO[]
  selected: string
  onSelect: (id: string) => void
  onAction: (id: string, action: DraftAction) => void
  canDraft: boolean
  pending: boolean
  activeBranchIds: ReadonlySet<string>
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
            {drafts.map((draft) => {
              const canSubmit =
                canDraft &&
                activeBranchIds.has(draft.branch_id) &&
                (draft.status === DRAFT_STATUS_DRAFT ||
                  draft.status === DRAFT_STATUS_CHANGES_REQUESTED)
              return (
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
                      {canDraft && (
                        <Button
                          variant='outline'
                          size='sm'
                          disabled={pending || !canSubmit}
                          onClick={() => onAction(draft.id, 'submit')}
                        >
                          {t('admin.common.submit')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyState preset='drafts' />
      )}
    </CollectionCard>
  )
}

export function VersionsPage({
  search,
  onSearchChange,
}: VdocPageDeepLinkProps = {}) {
  const { t } = useLanguage()
  const authUser = useAuthStore((state) => state.auth.user)
  const {
    projectsQuery,
    projectId,
    setProjectId,
    projectOptions,
    invalidProjectDeepLink,
  } = useProjectsAndSelection(search?.project_id, (value) =>
    onSearchChange?.({
      project_id: value || undefined,
      document_id: undefined,
      branch_id: undefined,
      draft_id: undefined,
      version_id: undefined,
      endpoint_id: undefined,
      from_version_id: undefined,
      to_version_id: undefined,
      diff_id: undefined,
    })
  )
  const {
    documentId,
    selectedDocument,
    setDocumentId,
    documentOptions,
    invalidDocumentDeepLink,
  } = useDocumentsAndSelection(
    projectId,
    undefined,
    search?.document_id,
    (value) =>
      onSearchChange?.({
        document_id: value || undefined,
        branch_id: undefined,
        draft_id: undefined,
        version_id: undefined,
        endpoint_id: undefined,
        from_version_id: undefined,
        to_version_id: undefined,
        diff_id: undefined,
      })
  )
  const branchesQuery = useQuery({
    queryKey: ['branches', projectId, documentId],
    queryFn: () => listBranches(projectId, documentId),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => listProjectMembers(projectId),
    enabled: projectId.length > 0 && !authUser?.is_super_admin,
  })
  const [branchFilter, setBranchFilter] = useRouteControlledString(
    search?.branch_id,
    onSearchChange !== undefined
  )
  const {
    versionsQuery,
    versionId,
    setVersionId,
    versionOptions,
    invalidVersionDeepLink,
  } = useVersionsAndSelection(
    projectId,
    documentId,
    branchFilter || undefined,
    search?.version_id,
    (value) =>
      onSearchChange?.({
        version_id: value || undefined,
        endpoint_id: undefined,
      })
  )
  const [contentKind, setContentKind] = useState('raw')
  const isMarkdownDocument =
    selectedDocument?.document_type === DOCUMENT_TYPE_MARKDOWN
  const versionContentKindOptions = contentKindOptions(t, isMarkdownDocument)
  const activeVersionContentKind = activeContentKind(
    contentKind,
    versionContentKindOptions
  )
  const [endpointSearchQuery, setEndpointSearchQuery] = useState('')
  const [endpointId, setEndpointId] = useRouteControlledString(
    search?.endpoint_id,
    onSearchChange !== undefined
  )
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
      projectId.length > 0 &&
      documentId.length > 0 &&
      versionId.length > 0 &&
      !isMarkdownDocument,
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
      endpointExistsInVersion &&
      !isMarkdownDocument,
  })
  const invalidBranchDeepLink = Boolean(
    branchesQuery.data &&
    search?.branch_id &&
    !branchesQuery.data.items.some((branch) => branch.id === search.branch_id)
  )
  const invalidEndpointDeepLink = Boolean(
    !invalidVersionDeepLink &&
    endpointsQuery.data &&
    search?.endpoint_id &&
    !endpointsQuery.data.items.some(
      (endpoint) => endpoint.id === search.endpoint_id
    )
  )
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
    setBranchFilter('')
    setProjectId(value)
  }
  const handleDocumentChange = (value: string) => {
    clearEndpointSelection()
    setBranchFilter('')
    setContentKind('raw')
    setDocumentId(value)
  }
  const handleVersionChange = (value: string) => {
    clearEndpointSelection()
    setVersionId(value)
  }
  const selectedVersionContent = contentQuery.data?.content
  const selectedProject = projectsQuery.data?.items.find(
    (project) => project.id === projectId
  )
  const selectedVersion = versionsQuery.data?.items.find(
    (version) => version.id === versionId
  )
  const selectedVersionBranchActive = Boolean(
    selectedVersion &&
    branchesQuery.data?.items.some(
      (branch) =>
        branch.id === selectedVersion.branch_id &&
        branch.status === ACTIVE_STATUS
    )
  )
  const selectedVersionAIInteractive = Boolean(
    selectedVersion &&
    selectedProject?.status === ACTIVE_STATUS &&
    selectedDocument?.status === ACTIVE_STATUS &&
    selectedVersionBranchActive
  )
  const canRegenerateVersionSummary = Boolean(
    selectedVersionAIInteractive &&
    (authUser?.is_super_admin ||
      activeProjectRole(membersQuery.data?.items, authUser?.id) === ROLE_ADMIN)
  )
  const selectedVersionAITarget: AISummaryTarget | undefined = versionId
    ? {
        projectId,
        documentId,
        ownerType: 'version',
        ownerId: versionId,
      }
    : undefined
  return (
    <PageChrome page='versions'>
      <DeepLinkAlert
        targets={[
          ...(invalidProjectDeepLink
            ? [`${t('admin.fields.project')}: ${search?.project_id}`]
            : []),
          ...(!invalidProjectDeepLink && invalidDocumentDeepLink
            ? [`${t('admin.fields.document')}: ${search?.document_id}`]
            : []),
          ...(!invalidProjectDeepLink &&
          !invalidDocumentDeepLink &&
          invalidBranchDeepLink
            ? [`${t('admin.fields.branch')}: ${search?.branch_id}`]
            : []),
          ...(!invalidProjectDeepLink &&
          !invalidDocumentDeepLink &&
          !invalidBranchDeepLink &&
          invalidVersionDeepLink
            ? [`${t('admin.fields.version')}: ${search?.version_id}`]
            : []),
          ...(!invalidProjectDeepLink &&
          !invalidDocumentDeepLink &&
          !invalidBranchDeepLink &&
          !invalidVersionDeepLink &&
          invalidEndpointDeepLink
            ? [`${t('admin.common.endpoint')}: ${search?.endpoint_id}`]
            : []),
        ]}
      />
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
          label={t('admin.fields.branch')}
          value={branchFilter}
          onChange={(value) => {
            setVersionId('')
            clearEndpointSelection()
            setBranchFilter(value)
            onSearchChange?.({
              branch_id: value || undefined,
              version_id: undefined,
              endpoint_id: undefined,
            })
          }}
          placeholder={t('admin.common.all')}
          options={[
            { value: '', label: t('admin.common.all') },
            ...(branchesQuery.data?.items.map((branch) => ({
              value: branch.id,
              label: entityOptionLabel(branch.name, branch.status, t),
            })) ?? []),
          ]}
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
      {!isMarkdownDocument && (
        <section className='grid gap-4 sm:grid-cols-3'>
          <StatCard
            title={t('admin.developerPortal.endpointCount')}
            value={String(
              endpointsQuery.data?.total ?? visibleEndpoints.length
            )}
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
      )}
      <SelectorGrid>
        <NativeSelect
          label={t('admin.fields.contentKind')}
          value={activeVersionContentKind}
          onChange={setContentKind}
          placeholder={t('admin.types.raw')}
          options={versionContentKindOptions}
        />
        {!isMarkdownDocument && (
          <>
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
          </>
        )}
      </SelectorGrid>
      <ContentViewer
        title={t('admin.sections.contentViewer')}
        content={selectedVersionContent}
      />
      {isMarkdownDocument ? (
        <>
          {selectedVersionContent && (
            <MarkdownDocumentViewer content={selectedVersionContent} />
          )}
          <MarkdownFactsCard content={selectedVersionContent} />
        </>
      ) : (
        <EndpointsCard
          endpoints={visibleEndpoints}
          selected={endpointId}
          onSelect={(value) => {
            setEndpointId(value)
            onSearchChange?.({ endpoint_id: value || undefined })
          }}
          detail={selectedEndpointVisible ? endpointQuery.data : undefined}
          groupMode={endpointGroupMode}
          untaggedLabel={untaggedLabel}
        />
      )}
      <AIContextPanel
        target={selectedVersionAITarget}
        interactive={selectedVersionAIInteractive}
        canRegenerate={canRegenerateVersionSummary}
      />
    </PageChrome>
  )
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
                  <StatusBadge>
                    {versionStatusLabel(version.status, t)}
                  </StatusBadge>
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

export function DiffsPage({
  search,
  onSearchChange,
}: VdocPageDeepLinkProps = {}) {
  const { t } = useLanguage()
  const authUser = useAuthStore((state) => state.auth.user)
  const {
    projectsQuery,
    projectId,
    setProjectId,
    projectOptions,
    invalidProjectDeepLink,
  } = useProjectsAndSelection(search?.project_id, (value) =>
    onSearchChange?.({
      project_id: value || undefined,
      document_id: undefined,
      branch_id: undefined,
      draft_id: undefined,
      version_id: undefined,
      endpoint_id: undefined,
      from_version_id: undefined,
      to_version_id: undefined,
      diff_id: undefined,
    })
  )
  const {
    documentId,
    selectedDocument,
    setDocumentId,
    documentOptions,
    invalidDocumentDeepLink,
  } = useDocumentsAndSelection(
    projectId,
    undefined,
    search?.document_id,
    (value) =>
      onSearchChange?.({
        document_id: value || undefined,
        branch_id: undefined,
        draft_id: undefined,
        version_id: undefined,
        endpoint_id: undefined,
        from_version_id: undefined,
        to_version_id: undefined,
        diff_id: undefined,
      })
  )
  const branchesQuery = useQuery({
    queryKey: ['branches', projectId, documentId],
    queryFn: () => listBranches(projectId, documentId),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => listProjectMembers(projectId),
    enabled: projectId.length > 0 && !authUser?.is_super_admin,
  })
  const { versionsQuery, versionOptions } = useVersionsAndSelection(
    projectId,
    documentId
  )
  const [diff, setDiff] = useState<DiffDTO | null>(null)
  const [fromVersionId, setFromVersionId] = useRouteControlledString(
    search?.from_version_id,
    onSearchChange !== undefined
  )
  const [toVersionId, setToVersionId] = useRouteControlledString(
    search?.to_version_id,
    onSearchChange !== undefined
  )
  const [diffSearch, setDiffSearch] = useState('')
  const [diffFilterValue, setDiffFilterValue] = useState<DiffFilter>('all')
  const validVersionIds = useMemo(
    () => new Set(versionOptions.map((option) => option.value)),
    [versionOptions]
  )
  const versionLabelById = useMemo(
    () => new Map(versionOptions.map((option) => [option.value, option.label])),
    [versionOptions]
  )
  const requestedFromVersionId = validVersionIds.has(fromVersionId)
    ? fromVersionId
    : ''
  const requestedToVersionId = validVersionIds.has(toVersionId)
    ? toVersionId
    : ''
  const resolveDiffById = Boolean(search?.diff_id)
  const diffHistoryQuery = useQuery({
    queryKey: [
      'diffs',
      projectId,
      documentId,
      resolveDiffById ? 'resolve-id' : requestedFromVersionId,
      resolveDiffById ? search?.diff_id : requestedToVersionId,
    ],
    queryFn: () =>
      listDiffs(
        projectId,
        documentId,
        resolveDiffById ? undefined : requestedFromVersionId || undefined,
        resolveDiffById ? undefined : requestedToVersionId || undefined
      ),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const requestedDiff = search?.diff_id
    ? diffHistoryQuery.data?.items.find((item) => item.id === search.diff_id)
    : undefined
  const selectedFromVersionId = requestedDiff?.from_version_id
    ? requestedDiff.from_version_id
    : requestedFromVersionId
  const selectedToVersionId = requestedDiff?.to_version_id
    ? requestedDiff.to_version_id
    : requestedToVersionId
  const persistedDiff =
    selectedFromVersionId && selectedToVersionId
      ? diffHistoryQuery.data?.items.find(
          (item) =>
            item.from_version_id === selectedFromVersionId &&
            item.to_version_id === selectedToVersionId
        )
      : undefined
  useEffect(() => {
    if (!requestedDiff) return
    const requestedFromVersionId = requestedDiff.from_version_id ?? ''
    const requestedToVersionId = requestedDiff.to_version_id ?? ''
    if (
      search?.from_version_id !== requestedFromVersionId ||
      search?.to_version_id !== requestedToVersionId
    ) {
      onSearchChange?.({
        from_version_id: requestedFromVersionId || undefined,
        to_version_id: requestedToVersionId || undefined,
      })
    }
  }, [
    onSearchChange,
    requestedDiff,
    search?.from_version_id,
    search?.to_version_id,
  ])
  useEffect(() => {
    if (!search?.diff_id && persistedDiff) {
      onSearchChange?.({ diff_id: persistedDiff.id })
    }
  }, [onSearchChange, persistedDiff, search?.diff_id])
  const activeDiff =
    search?.diff_id !== undefined
      ? (requestedDiff ?? null)
      : diff?.document_id === documentId &&
          diff.from_version_id === selectedFromVersionId &&
          diff.to_version_id === selectedToVersionId
        ? diff
        : (persistedDiff ?? null)
  const invalidFromVersionDeepLink = Boolean(
    versionsQuery.data &&
    search?.from_version_id &&
    !validVersionIds.has(search.from_version_id)
  )
  const invalidToVersionDeepLink = Boolean(
    versionsQuery.data &&
    search?.to_version_id &&
    !validVersionIds.has(search.to_version_id)
  )
  const invalidDiffDeepLink = Boolean(
    diffHistoryQuery.data && search?.diff_id && !requestedDiff
  )
  const activeDiffAITarget: AISummaryTarget | undefined = activeDiff
    ? {
        projectId,
        documentId,
        ownerType: 'diff',
        ownerId: activeDiff.id,
      }
    : undefined
  const selectedProject = projectsQuery.data?.items.find(
    (project) => project.id === projectId
  )
  const selectedToVersion = versionsQuery.data?.items.find(
    (version) => version.id === activeDiff?.to_version_id
  )
  const activeDiffBranchActive = Boolean(
    selectedToVersion &&
    branchesQuery.data?.items.some(
      (branch) =>
        branch.id === selectedToVersion.branch_id &&
        branch.status === ACTIVE_STATUS
    )
  )
  const activeDocumentContext = Boolean(
    selectedProject?.status === ACTIVE_STATUS &&
    selectedDocument?.status === ACTIVE_STATUS
  )
  const activeDiffAIInteractive = Boolean(
    activeDiff && activeDocumentContext && activeDiffBranchActive
  )
  const canRegenerateDiffSummary = Boolean(
    activeDiffAIInteractive &&
    (authUser?.is_super_admin ||
      activeProjectRole(membersQuery.data?.items, authUser?.id) === ROLE_ADMIN)
  )
  const diffMutation = useMutation({
    mutationFn: () =>
      compareDiff(projectId, documentId, {
        from_version_id: selectedFromVersionId,
        to_version_id: selectedToVersionId,
      }),
    onSuccess: (result) => {
      setDiff(result)
      onSearchChange?.({
        from_version_id: result.from_version_id || undefined,
        to_version_id: result.to_version_id || undefined,
        diff_id: result.id,
      })
      void diffHistoryQuery.refetch()
    },
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
      <DeepLinkAlert
        targets={[
          ...(invalidProjectDeepLink
            ? [`${t('admin.fields.project')}: ${search?.project_id}`]
            : []),
          ...(!invalidProjectDeepLink && invalidDocumentDeepLink
            ? [`${t('admin.fields.document')}: ${search?.document_id}`]
            : []),
          ...(!invalidProjectDeepLink &&
          !invalidDocumentDeepLink &&
          invalidFromVersionDeepLink
            ? [`${t('admin.fields.fromVersion')}: ${search?.from_version_id}`]
            : []),
          ...(!invalidProjectDeepLink &&
          !invalidDocumentDeepLink &&
          invalidToVersionDeepLink
            ? [`${t('admin.fields.toVersion')}: ${search?.to_version_id}`]
            : []),
          ...(!invalidProjectDeepLink &&
          !invalidDocumentDeepLink &&
          invalidDiffDeepLink
            ? [`${t('admin.sections.diffResult')}: ${search?.diff_id}`]
            : []),
        ]}
      />
      <SelectorGrid>
        <NativeSelect
          label={t('admin.fields.project')}
          value={projectId}
          onChange={(value) => {
            setDiff(null)
            setFromVersionId('')
            setToVersionId('')
            setProjectId(value)
          }}
          placeholder={t('admin.placeholders.selectProject')}
          options={projectOptions}
        />
        <NativeSelect
          label={t('admin.fields.document')}
          value={documentId}
          onChange={(value) => {
            setDiff(null)
            setFromVersionId('')
            setToVersionId('')
            setDocumentId(value)
          }}
          placeholder={t('admin.placeholders.selectDocument')}
          options={documentOptions}
        />
        <NativeSelect
          label={t('admin.fields.fromVersion')}
          value={selectedFromVersionId}
          onChange={(value) => {
            setDiff(null)
            setFromVersionId(value)
            onSearchChange?.({
              from_version_id: value || undefined,
              diff_id: undefined,
            })
          }}
          placeholder={t('admin.placeholders.selectVersion')}
          options={versionOptions}
        />
        <NativeSelect
          label={t('admin.fields.toVersion')}
          value={selectedToVersionId}
          onChange={(value) => {
            setDiff(null)
            setToVersionId(value)
            onSearchChange?.({
              to_version_id: value || undefined,
              diff_id: undefined,
            })
          }}
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
            selectedFromVersionId === selectedToVersionId ||
            !activeDocumentContext ||
            Boolean(persistedDiff) ||
            diffMutation.isPending
          }
          onClick={() => diffMutation.mutate()}
        >
          <GitCompareArrows className='size-4' />
          {persistedDiff
            ? t('admin.diff.existingLoaded')
            : t('admin.common.compare')}
        </Button>
        <p className='text-sm text-muted-foreground'>
          {t('admin.diff.compareHint')}
        </p>
      </div>
      <LoadingErrorState
        state={{
          isLoading: diffHistoryQuery.isLoading,
          isError: diffHistoryQuery.isError,
          error: diffHistoryQuery.error,
        }}
      />
      {diffMutation.isError && (
        <Alert variant='destructive' aria-live='polite'>
          <AlertCircle />
          <AlertTitle>{t('admin.common.error')}</AlertTitle>
          <AlertDescription>{diffMutation.error.message}</AlertDescription>
        </Alert>
      )}
      <CollectionCard
        title={t('admin.diff.historyTitle')}
        description={t('admin.diff.historyDescription')}
        count={diffHistoryQuery.data?.total ?? 0}
      >
        {diffHistoryQuery.data?.items.length ? (
          <div className='grid gap-2'>
            {diffHistoryQuery.data.items.map((item) => {
              const fromVersionLabel =
                versionLabelById.get(item.from_version_id ?? '') ??
                item.from_version_id ??
                '-'
              const toVersionLabel =
                versionLabelById.get(item.to_version_id ?? '') ??
                item.to_version_id ??
                '-'
              return (
                <button
                  key={item.id}
                  type='button'
                  className='grid min-w-0 gap-1 rounded-md border bg-[var(--surface-control)] p-3 text-start hover:bg-muted/50'
                  onClick={() => {
                    setFromVersionId(item.from_version_id ?? '')
                    setToVersionId(item.to_version_id ?? '')
                    setDiff(item)
                    onSearchChange?.({
                      from_version_id: item.from_version_id || undefined,
                      to_version_id: item.to_version_id || undefined,
                      diff_id: item.id,
                    })
                  }}
                >
                  <span className='text-sm font-medium'>
                    {fromVersionLabel} → {toVersionLabel}
                  </span>
                  <span className='font-mono text-[0.68rem] leading-5 break-all text-muted-foreground'>
                    {t('admin.diff.historyIdentifiers', {
                      from: item.from_version_id ?? '-',
                      to: item.to_version_id ?? '-',
                      diff: item.id,
                    })}
                  </span>
                  <span className='text-xs text-muted-foreground'>
                    {formatDate(item.created_at)}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <EmptyState preset='diffs' />
        )}
      </CollectionCard>
      <CollectionCard
        title={t('admin.sections.diffResult')}
        description={activeDiff?.id ?? t('admin.diff.noDiffSelected')}
        count={visibleItems.length}
      >
        {summary && (
          <DiffSummaryCards
            summary={summary}
            isMarkdown={
              summary.document_format === DOCUMENT_FORMAT_MARKDOWN ||
              selectedDocument?.document_type === DOCUMENT_TYPE_MARKDOWN
            }
          />
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
          <DiffReviewList
            items={visibleItems}
            isMarkdown={
              summary?.document_format === DOCUMENT_FORMAT_MARKDOWN ||
              selectedDocument?.document_type === DOCUMENT_TYPE_MARKDOWN
            }
          />
        ) : (
          <EmptyState preset='diffs' />
        )}
      </CollectionCard>
      <AIContextPanel
        target={activeDiffAITarget}
        interactive={activeDiffAIInteractive}
        canRegenerate={canRegenerateDiffSummary}
      />
    </PageChrome>
  )
}

export function AuditPage() {
  const { t } = useLanguage()
  const authUser = useAuthStore((state) => state.auth.user)
  const isSuperAdmin = Boolean(authUser?.is_super_admin)
  const { projectId, setProjectId, projectOptions } = useProjectsAndSelection()
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => listProjectMembers(projectId),
    enabled: projectId.length > 0 && !isSuperAdmin,
  })
  const isProjectAdmin = Boolean(
    activeProjectRole(membersQuery.data?.items, authUser?.id) === ROLE_ADMIN
  )
  const [action, setAction] = useState('')
  const [resourceType, setResourceType] = useState('')
  const auditQuery = useQuery({
    queryKey: ['audit-logs', projectId, action, resourceType, isSuperAdmin],
    queryFn: () =>
      listAuditLogs({
        project_id: projectId || undefined,
        action: action || undefined,
        resource_type: resourceType || undefined,
        limit: 200,
      }),
    enabled: isSuperAdmin || (projectId.length > 0 && isProjectAdmin),
  })

  return (
    <PageChrome page='audit'>
      <SelectorGrid>
        <NativeSelect
          label={t('admin.fields.project')}
          value={projectId}
          onChange={setProjectId}
          placeholder={
            isSuperAdmin
              ? t('admin.audit.allProjects')
              : t('admin.placeholders.selectProject')
          }
          options={projectOptions}
        />
        <TextField
          id='audit-action'
          label={t('admin.audit.action')}
          name='audit_action'
          placeholder={t('admin.audit.actionPlaceholder')}
          value={action}
          onChange={setAction}
        />
        <TextField
          id='audit-resource-type'
          label={t('admin.audit.resourceType')}
          name='audit_resource_type'
          placeholder={t('admin.audit.resourceTypePlaceholder')}
          value={resourceType}
          onChange={setResourceType}
        />
      </SelectorGrid>
      {!isSuperAdmin &&
      projectId &&
      !membersQuery.isLoading &&
      !isProjectAdmin ? (
        <Alert variant='destructive'>
          <ShieldCheck />
          <AlertTitle>{t('errors.forbiddenTitle')}</AlertTitle>
          <AlertDescription>
            {t('admin.audit.projectAdminRequired')}
          </AlertDescription>
        </Alert>
      ) : (
        <LoadingErrorState
          state={{
            isLoading: membersQuery.isLoading || auditQuery.isLoading,
            isError: membersQuery.isError || auditQuery.isError,
            error: (membersQuery.error ?? auditQuery.error) as Error | null,
          }}
        />
      )}
      <CollectionCard
        title={t('admin.audit.title')}
        description={t('admin.audit.description')}
        count={auditQuery.data?.total ?? 0}
      >
        {auditQuery.data?.items.length ? (
          <AuditLogTable logs={auditQuery.data.items} />
        ) : (
          <EmptyState preset='audit' />
        )}
      </CollectionCard>
    </PageChrome>
  )
}

function AuditLogTable({ logs }: { logs: AuditLogDTO[] }) {
  const { t } = useLanguage()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.audit.time')}</TableHead>
          <TableHead>{t('admin.audit.action')}</TableHead>
          <TableHead>{t('admin.audit.actor')}</TableHead>
          <TableHead>{t('admin.audit.resource')}</TableHead>
          <TableHead>{t('admin.fields.project')}</TableHead>
          <TableHead>{t('admin.audit.result')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell className='text-xs whitespace-nowrap'>
              {formatDate(log.created_at)}
            </TableCell>
            <TableCell className='font-mono text-xs'>{log.action}</TableCell>
            <TableCell className='max-w-44 truncate font-mono text-xs'>
              {log.actor_user_id ?? log.actor_token_id ?? '-'}
            </TableCell>
            <TableCell className='max-w-56'>
              <div className='font-mono text-xs'>{log.resource_type}</div>
              <div className='truncate font-mono text-xs text-muted-foreground'>
                {log.resource_id ?? log.document_id ?? '-'}
              </div>
            </TableCell>
            <TableCell className='max-w-40 truncate font-mono text-xs'>
              {log.project_id ?? '-'}
            </TableCell>
            <TableCell>
              <StatusBadge muted={log.metadata.result !== 'success'}>
                {log.metadata.result ?? t('admin.common.unknown')}
              </StatusBadge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function DiffSummaryCards({
  summary,
  isMarkdown,
}: {
  summary: DiffSummaryDTO
  isMarkdown: boolean
}) {
  const { t } = useLanguage()
  const cards = isMarkdown
    ? [
        [
          t('admin.diff.addedLines'),
          summary.added_lines ?? 0,
          t('admin.diff.addedLinesDescription'),
        ],
        [
          t('admin.diff.removedLines'),
          summary.removed_lines ?? 0,
          t('admin.diff.removedLinesDescription'),
        ],
        [
          t('admin.diff.modifiedLines'),
          summary.modified_lines ?? 0,
          t('admin.diff.modifiedLinesDescription'),
        ],
        [
          t('admin.diff.modifiedBlocks'),
          summary.modified_blocks ?? 0,
          t('admin.diff.modifiedBlocksDescription'),
        ],
      ]
    : [
        [
          t('admin.diff.addedEndpoints'),
          summary.added_endpoints,
          t('admin.diff.addedDescription'),
        ],
        [
          t('admin.diff.removedEndpoints'),
          summary.removed_endpoints,
          t('admin.diff.removedDescription'),
        ],
        [
          t('admin.diff.modifiedEndpoints'),
          summary.modified_endpoints,
          t('admin.diff.modifiedDescription'),
        ],
        [
          t('admin.diff.breakingChanges'),
          summary.breaking_changes,
          t('admin.diff.breakingDescription'),
        ],
      ]
  return (
    <section className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      {cards.map(([title, value, description]) => (
        <StatCard
          key={String(title)}
          title={String(title)}
          value={String(value)}
          description={String(description)}
        />
      ))}
    </section>
  )
}

function DiffReviewList({
  items,
  isMarkdown = false,
}: {
  items: DiffItemDTO[]
  isMarkdown?: boolean
}) {
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

  if (isMarkdown) {
    return (
      <section className='grid gap-3 rounded-md border bg-[var(--surface-control)] p-4'>
        <div>
          <p className='font-medium'>{t('admin.diff.unifiedDiff')}</p>
          <p className='text-xs text-muted-foreground'>
            {items.length} {t('admin.diff.changeCount')}
          </p>
        </div>
        <div className='overflow-hidden rounded-md border bg-background font-mono text-xs'>
          {items.map((item) => (
            <div key={item.id} className='border-b last:border-b-0'>
              <div className='bg-muted/50 px-3 py-2 text-muted-foreground'>
                @@ {item.location ?? diffMessageLabel(item.message, t)} @@
              </div>
              <pre className='overflow-x-auto px-3 py-2 leading-6'>
                {(item.frontend_impact ?? item.message)
                  .split('\n')
                  .map((line, index) => (
                    <span
                      key={`${item.id}-${index}`}
                      className={`block px-2 ${
                        line.startsWith('+')
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : line.startsWith('-')
                            ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                            : ''
                      }`}
                    >
                      {line || ' '}
                    </span>
                  ))}
              </pre>
            </div>
          ))}
        </div>
      </section>
    )
  }

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
                    <p className='font-medium'>
                      {diffMessageLabel(item.message, t)}
                    </p>
                    {item.frontend_impact && (
                      <p className='text-sm text-muted-foreground'>
                        {item.frontend_impact === item.message
                          ? diffMessageLabel(item.frontend_impact, t)
                          : item.frontend_impact}
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

export function MCPTokensPage({
  search,
  onSearchChange,
}: VdocPageDeepLinkProps = {}) {
  const { t } = useLanguage()
  const invalidate = useInvalidateAll()
  const tokensQuery = useQuery({
    queryKey: ['mcp-tokens'],
    queryFn: listMCPTokens,
  })
  const selectedTokenId = search?.token_id ?? ''
  const selectedTokenExists = Boolean(
    selectedTokenId &&
    tokensQuery.data?.items.some((token) => token.id === selectedTokenId)
  )
  const canLoadUsage = Boolean(
    tokensQuery.data && (!selectedTokenId || selectedTokenExists)
  )
  const usageQuery = useQuery({
    queryKey: ['mcp-usage', selectedTokenId || 'all-owned'],
    queryFn: () =>
      listMCPUsage({
        token_id: selectedTokenId || undefined,
        limit: 200,
      }),
    enabled: canLoadUsage,
  })
  const [tokenSelection, setTokenSelection] = useState<{
    routeTokenId: string
    token: MCPTokenDTO | null
    copyStatus?: 'success' | 'failure'
  }>(() => ({ routeTokenId: selectedTokenId, token: null }))
  if (tokenSelection.routeTokenId !== selectedTokenId) {
    setTokenSelection({
      routeTokenId: selectedTokenId,
      token:
        tokenSelection.token?.id === selectedTokenId
          ? tokenSelection.token
          : null,
      copyStatus: undefined,
    })
  }
  const listedSelectedToken = tokensQuery.data?.items.find(
    (item) => item.id === selectedTokenId
  )
  const interactionToken =
    tokenSelection.token &&
    (onSearchChange === undefined ||
      tokenSelection.token.id === selectedTokenId)
      ? tokenSelection.token
      : null
  const selectedToken = interactionToken ?? listedSelectedToken ?? null
  const visibleToken = interactionToken?.token ?? ''
  const copyStatus = tokenSelection.copyStatus
  const latestTokenOperationRequestId = useRef(0)
  const [activeTokenOperationRequestId, setActiveTokenOperationRequestId] =
    useState(0)
  const latestTokenCopyRequestId = useRef(0)
  const activeTokenSelectionRef = useRef(selectedTokenId)
  useEffect(() => {
    activeTokenSelectionRef.current = selectedTokenId
  }, [selectedTokenId])
  const invalidTokenDeepLink = Boolean(
    tokensQuery.data && selectedTokenId && !selectedTokenExists
  )
  const publishedReadEvidence = usageQuery.data?.items.find((usage) => {
    const token = tokensQuery.data?.items.find(
      (item) => item.id === usage.actor_token_id
    )
    return (
      token !== undefined &&
      tokenIsActive(token) &&
      tokenHasAnyReadScope(token) &&
      usage.metadata.evidence_kind === 'published_content_read' &&
      usage.metadata.result === 'success'
    )
  })
  const connectedToken = tokensQuery.data?.items.find(
    (token) => token.id === publishedReadEvidence?.actor_token_id
  )
  function beginTokenOperation() {
    const requestId = latestTokenOperationRequestId.current + 1
    latestTokenOperationRequestId.current = requestId
    setActiveTokenOperationRequestId(requestId)
    return requestId
  }
  function clearTokenInteraction() {
    setTokenSelection((current) => ({
      ...current,
      token: null,
      copyStatus: undefined,
    }))
  }
  const getMutation = useMutation({
    mutationFn: ({ tokenId }: { tokenId: string; requestId: number }) =>
      getMCPToken(tokenId),
    onSuccess: (token, variables) => {
      if (
        variables.requestId !== latestTokenOperationRequestId.current ||
        activeTokenSelectionRef.current !== variables.tokenId
      )
        return
      setTokenSelection((current) => ({
        ...current,
        token,
        copyStatus: undefined,
      }))
      latestTokenCopyRequestId.current += 1
    },
  })
  const revokeMutation = useMutation({
    mutationFn: ({ tokenId }: { tokenId: string; requestId: number }) =>
      revokeMCPToken(tokenId),
    onSuccess: (token, variables) => {
      if (
        variables.requestId === latestTokenOperationRequestId.current &&
        activeTokenSelectionRef.current === variables.tokenId
      ) {
        setTokenSelection((current) => ({
          ...current,
          token,
          copyStatus: undefined,
        }))
      }
      invalidate()
    },
  })
  const createMutation = useMutation({
    mutationFn: ({
      payload,
    }: {
      payload: Parameters<typeof createMCPToken>[0]
      requestId: number
    }) => createMCPToken(payload),
    onMutate: () => {
      latestTokenCopyRequestId.current += 1
      clearTokenInteraction()
      getMutation.reset()
      revokeMutation.reset()
    },
    onSuccess: (token, variables) => {
      if (variables.requestId === latestTokenOperationRequestId.current) {
        activeTokenSelectionRef.current = token.id
        setTokenSelection((current) => ({
          ...current,
          token,
          copyStatus: undefined,
        }))
        onSearchChange?.({ token_id: token.id })
      }
      invalidate()
    },
  })
  async function copyVisibleToken() {
    if (!visibleToken) return
    const requestId = latestTokenCopyRequestId.current + 1
    latestTokenCopyRequestId.current = requestId
    const tokenId = interactionToken?.id ?? ''
    setTokenSelection((current) => ({
      ...current,
      copyStatus: undefined,
    }))
    try {
      await navigator.clipboard.writeText(visibleToken)
      if (
        requestId === latestTokenCopyRequestId.current &&
        activeTokenSelectionRef.current === tokenId
      ) {
        setTokenSelection((current) => ({
          ...current,
          copyStatus: 'success',
        }))
      }
    } catch {
      if (
        requestId === latestTokenCopyRequestId.current &&
        activeTokenSelectionRef.current === tokenId
      ) {
        setTokenSelection((current) => ({
          ...current,
          copyStatus: 'failure',
        }))
      }
    }
  }
  return (
    <PageChrome page='mcpTokens'>
      <LoadingErrorState
        state={{
          isLoading: tokensQuery.isLoading || usageQuery.isLoading,
          isError: tokensQuery.isError || usageQuery.isError,
          error: (tokensQuery.error ?? usageQuery.error) as Error | null,
        }}
      />
      <DeepLinkAlert
        targets={
          invalidTokenDeepLink
            ? [`${t('admin.fields.token')}: ${selectedTokenId}`]
            : []
        }
      />
      <FormCard
        title={t('admin.sections.createToken')}
        submitLabel={t('admin.common.create')}
        pending={createMutation.isPending}
        onSubmit={(formData) => {
          const scopes = formData.getAll('scopes').map(Number)
          if (scopes.length === 0) {
            throw new Error(t('admin.token.scopeRequired'))
          }
          const expiry = optionalFieldValue(formData, 'expires_at')
          if (expiry) {
            const expiresAt = Date.parse(expiry)
            if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
              throw new Error(t('admin.token.futureExpiryRequired'))
            }
          }
          const requestId = beginTokenOperation()
          return createMutation.mutateAsync({
            requestId,
            payload: {
              name: fieldValue(formData, 'name'),
              scopes,
              expires_at: expiry ?? null,
            },
          })
        }}
      >
        <div className='grid gap-4 md:grid-cols-2'>
          <TextField label={t('admin.fields.name')} name='name' required />
          <TextField
            label={t('admin.fields.expiresAt')}
            name='expires_at'
            placeholder={t('admin.placeholders.optionalIsoDate')}
          />
        </div>
        <fieldset className='grid gap-3 rounded-md border p-4 sm:grid-cols-2'>
          <legend className='px-2 text-sm font-medium'>
            {t('admin.token.scopesTitle')}
          </legend>
          {[
            [1, t('admin.token.apiRead')],
            [2, t('admin.token.apiDraft')],
            [3, t('admin.token.docRead')],
            [4, t('admin.token.docDraft')],
          ].map(([scope, label]) => (
            <label
              key={String(scope)}
              className='flex items-start gap-3 rounded-md border bg-[var(--surface-control)] p-3 text-sm'
            >
              <input
                type='checkbox'
                name='scopes'
                value={String(scope)}
                defaultChecked={scope === 1}
                className='mt-0.5 size-4 accent-primary'
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
      </FormCard>
      {visibleToken && (
        <Alert>
          <KeyRound />
          <AlertTitle>{t('admin.token.secretAvailable')}</AlertTitle>
          <AlertDescription className='grid gap-3'>
            <p>{t('admin.token.secretGuidance')}</p>
            <code className='mt-2 block rounded-md border bg-muted p-3 text-xs'>
              {visibleToken}
            </code>
            <Button
              type='button'
              variant='outline'
              className='w-fit'
              onClick={() => void copyVisibleToken()}
            >
              <Copy className='size-4' />
              {t('admin.token.copy')}
            </Button>
            {copyStatus && (
              <p
                role='status'
                className={
                  copyStatus === 'failure'
                    ? 'text-sm text-destructive'
                    : 'text-sm text-muted-foreground'
                }
              >
                {t(
                  copyStatus === 'failure'
                    ? 'admin.token.copyFailed'
                    : 'admin.token.copySuccess'
                )}
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
      {getMutation.isError &&
        getMutation.variables.requestId === activeTokenOperationRequestId &&
        (onSearchChange === undefined ||
          getMutation.variables.tokenId === selectedTokenId) && (
          <Alert variant='destructive' aria-live='polite'>
            <AlertCircle />
            <AlertTitle>{t('admin.token.revealErrorTitle')}</AlertTitle>
            <AlertDescription>{getMutation.error.message}</AlertDescription>
          </Alert>
        )}
      {revokeMutation.isError &&
        revokeMutation.variables.requestId === activeTokenOperationRequestId &&
        (onSearchChange === undefined ||
          revokeMutation.variables.tokenId === selectedTokenId) && (
          <Alert variant='destructive' aria-live='polite'>
            <AlertCircle />
            <AlertTitle>{t('admin.token.revokeErrorTitle')}</AlertTitle>
            <AlertDescription>{revokeMutation.error.message}</AlertDescription>
          </Alert>
        )}
      <TokenTable
        tokens={tokensQuery.data?.items ?? []}
        selected={selectedTokenId}
        pending={revokeMutation.isPending}
        onView={(tokenId) => {
          activeTokenSelectionRef.current = tokenId
          onSearchChange?.({ token_id: tokenId })
          latestTokenCopyRequestId.current += 1
          clearTokenInteraction()
          revokeMutation.reset()
          getMutation.reset()
          const requestId = beginTokenOperation()
          getMutation.mutate({ tokenId, requestId })
        }}
        onRevoke={async (tokenId) => {
          activeTokenSelectionRef.current = tokenId
          onSearchChange?.({ token_id: tokenId })
          const requestId = beginTokenOperation()
          latestTokenCopyRequestId.current += 1
          clearTokenInteraction()
          getMutation.reset()
          revokeMutation.reset()
          await revokeMutation.mutateAsync({ tokenId, requestId })
        }}
      />
      <Alert>
        <ShieldCheck />
        <AlertTitle>
          {t(
            connectedToken
              ? 'admin.token.connectionVerifiedTitle'
              : 'admin.token.connectionPendingTitle'
          )}
        </AlertTitle>
        <AlertDescription className='grid gap-3'>
          <p>
            {connectedToken
              ? t('admin.token.connectionVerifiedDescription', {
                  name: connectedToken.name,
                  time: formatDate(publishedReadEvidence?.created_at),
                  tool:
                    publishedReadEvidence?.metadata.tool_name ??
                    t('admin.common.unknown'),
                  target: mcpUsageTarget(publishedReadEvidence),
                })
              : t('admin.token.connectionPendingDescription')}
          </p>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='w-fit'
            disabled={
              tokensQuery.isFetching || (canLoadUsage && usageQuery.isFetching)
            }
            onClick={() => {
              void tokensQuery.refetch()
              if (canLoadUsage) void usageQuery.refetch()
            }}
          >
            <RefreshCw />
            {t('admin.token.refreshConnectionEvidence')}
          </Button>
        </AlertDescription>
      </Alert>
      <CollectionCard
        title={t('admin.token.activityTitle')}
        description={t('admin.token.activityDescription')}
        count={usageQuery.data?.total ?? 0}
      >
        {usageQuery.data?.items.length ? (
          <MCPUsageTable logs={usageQuery.data.items} />
        ) : (
          <EmptyState />
        )}
      </CollectionCard>
      {selectedToken && (
        <ContentViewer
          title={t('admin.sections.tokenDetails')}
          content={stringify(tokenDetails(selectedToken))}
        />
      )}
      <CollectionCard
        title={t('admin.token.configTitle')}
        description={t('admin.token.configDescription')}
      >
        <pre className='overflow-x-auto rounded-md border bg-[var(--surface-control)] p-4 text-xs leading-relaxed'>
          {stringify({
            mcpServers: {
              vdoc: {
                command: 'npx',
                args: ['--yes', vdocMcpSource],
                env: {
                  VDOC_BASE_URL: apiBaseUrl,
                  VDOC_MCP_TOKEN: visibleToken || '<YOUR_ACTIVE_VDOC_TOKEN>',
                },
              },
            },
          })}
        </pre>
      </CollectionCard>
    </PageChrome>
  )
}

export function SkillPage() {
  const { t } = useLanguage()
  return (
    <PageChrome page='skill'>
      <CollectionCard
        title={t('admin.skill.installTitle')}
        description={t('admin.skill.installDescription')}
      >
        <ol className='grid gap-3'>
          {[
            t('admin.skill.stepPackage'),
            t('admin.skill.stepMcp'),
            t('admin.skill.stepVerify'),
          ].map((step, index) => (
            <li
              key={step}
              className='grid grid-cols-[2rem_1fr] items-start gap-3 rounded-md border bg-[var(--surface-control)] p-4 text-sm'
            >
              <Badge className='justify-center' variant='outline'>
                {index + 1}
              </Badge>
              <span className='leading-6'>{step}</span>
            </li>
          ))}
        </ol>
        <pre className='overflow-x-auto rounded-md border bg-background p-4 text-xs leading-relaxed'>
          {vdocSkillInstallSnippet}
        </pre>
      </CollectionCard>
      <Alert>
        <ShieldCheck />
        <AlertTitle>{t('admin.skill.boundaryTitle')}</AlertTitle>
        <AlertDescription>
          {t('admin.skill.boundaryDescription')}
        </AlertDescription>
      </Alert>
      <CollectionCard
        title={t('admin.token.configTitle')}
        description={t('admin.token.configDescription')}
      >
        <pre className='overflow-x-auto rounded-md border bg-[var(--surface-control)] p-4 text-xs leading-relaxed'>
          {stringify({
            mcpServers: {
              vdoc: {
                command: 'npx',
                args: ['--yes', vdocMcpSource],
                env: {
                  VDOC_BASE_URL: apiBaseUrl,
                  VDOC_MCP_TOKEN: '<YOUR_ACTIVE_VDOC_TOKEN>',
                },
              },
            },
          })}
        </pre>
      </CollectionCard>
    </PageChrome>
  )
}

function tokenDetails(token: MCPTokenDTO) {
  return {
    id: token.id,
    user_id: token.user_id,
    name: token.name,
    token: token.token,
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

function mcpUsageTarget(log?: AuditLogDTO) {
  if (!log) return '-'
  const fields = [
    'project_id',
    'document_id',
    'branch_id',
    'draft_id',
    'version_id',
    'endpoint_id',
    'from_version_id',
    'to_version_id',
    'diff_id',
  ] as const
  const values = fields.flatMap((key) => {
    const value =
      key === 'project_id'
        ? (log.project_id ?? log.metadata[key])
        : key === 'document_id'
          ? (log.document_id ?? log.metadata[key])
          : log.metadata[key]
    return value ? [`${key}=${value}`] : []
  })
  return values.join(' · ') || log.resource_id || '-'
}

function MCPUsageTable({ logs }: { logs: AuditLogDTO[] }) {
  const { t } = useLanguage()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.audit.time')}</TableHead>
          <TableHead>{t('admin.fields.token')}</TableHead>
          <TableHead>{t('admin.token.activityTool')}</TableHead>
          <TableHead>{t('admin.token.activityTarget')}</TableHead>
          <TableHead>{t('admin.token.activityAdapter')}</TableHead>
          <TableHead>{t('admin.token.activityEvidence')}</TableHead>
          <TableHead>{t('admin.audit.result')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell className='text-xs whitespace-nowrap'>
              {formatDate(log.created_at)}
            </TableCell>
            <TableCell className='max-w-40 truncate font-mono text-xs'>
              {log.actor_token_id ?? log.metadata.token_id ?? '-'}
            </TableCell>
            <TableCell className='font-mono text-xs'>
              {log.metadata.tool_name ?? '-'}
            </TableCell>
            <TableCell className='max-w-96 font-mono text-xs break-all'>
              {mcpUsageTarget(log)}
            </TableCell>
            <TableCell>
              <StatusBadge muted={log.metadata.adapter !== 'stdio'}>
                {log.metadata.adapter ?? 'direct'}
              </StatusBadge>
            </TableCell>
            <TableCell>
              <StatusBadge
                muted={log.metadata.evidence_kind !== 'published_content_read'}
              >
                {t(
                  log.metadata.evidence_kind === 'published_content_read'
                    ? 'admin.token.evidencePublishedRead'
                    : log.metadata.evidence_kind === 'capability_list'
                      ? 'admin.token.evidenceCapabilityList'
                      : 'admin.token.evidenceToolCall'
                )}
              </StatusBadge>
            </TableCell>
            <TableCell>
              <StatusBadge muted={log.metadata.result !== 'success'}>
                {log.metadata.result ?? t('admin.common.unknown')}
              </StatusBadge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function TokenTable({
  tokens,
  selected,
  onView,
  onRevoke,
  title,
  description,
  emptyPreset = 'tokens',
  pending = false,
}: {
  tokens: MCPTokenDTO[]
  selected?: string
  onView?: (tokenId: string) => void
  onRevoke: (tokenId: string) => Promise<unknown>
  title?: string
  description?: string
  emptyPreset?: EmptyStatePreset
  pending?: boolean
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
              <TableHead>{t('admin.fields.lastUsedAt')}</TableHead>
              <TableHead>{t('admin.fields.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((token) => (
              <TableRow
                key={token.id}
                data-state={selected === token.id ? 'selected' : undefined}
              >
                <TableCell>
                  <div className='font-medium'>{token.name}</div>
                  <div className='text-xs text-muted-foreground'>
                    {token.id}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge muted={!tokenIsActive(token)}>
                    {tokenStatusLabel(token, t)}
                  </StatusBadge>
                </TableCell>
                <TableCell>{formatDate(token.expires_at)}</TableCell>
                <TableCell>{formatDate(token.last_used_at)}</TableCell>
                <TableCell>
                  <div className='flex gap-2'>
                    {onView && (
                      <Button
                        variant='outline'
                        size='sm'
                        disabled={pending || !tokenIsActive(token)}
                        onClick={() => onView(token.id)}
                      >
                        {t('admin.common.view')}
                      </Button>
                    )}
                    <ConfirmActionButton
                      label={t('admin.common.revoke')}
                      title={t('admin.confirm.revokeTokenTitle', {
                        name: token.name,
                      })}
                      description={t('admin.confirm.revokeTokenDescription')}
                      disabled={!tokenIsActive(token)}
                      pending={pending}
                      onConfirm={() => onRevoke(token.id)}
                    />
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
      {identity && <AISettingsPanel user={identity} />}
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
