import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVdocContextStore } from '@/stores/vdoc-context-store'
import { type NativeSelectOption } from '@/lib/native-select-options'
import {
  getVersion,
  type RequestOptions,
  listDocuments,
  listProjects,
  listVersions,
  type MCPTokenDTO,
  type ProjectMemberDTO,
} from '@/lib/vdoc-api'
import {
  invalidateVdocQueries,
  type VdocChange,
} from '@/lib/vdoc-query-invalidation'
import { useLanguage } from '@/context/language-provider'

export const vdocMcpSource =
  'github:ChnMig/Vdoc-mcp#b65f346453525a3f35a6ce466cf47a4488d5c8f8'

export const ACTIVE_STATUS = 1

export const ARCHIVED_OR_DISABLED_STATUS = 2

export const DOCUMENT_TYPE_OPENAPI = 1

export const DOCUMENT_TYPE_MARKDOWN = 2

export const ROLE_READER = 1

export const ROLE_WRITER = 2

export const ROLE_ADMIN = 3

export const DRAFT_STATUS_SUBMITTED = 2

export const DRAFT_STATUS_PUBLISHED = 5

export const MCP_TOKEN_STATUS_REVOKED = 2

export const MCP_TOKEN_STATUS_EXPIRED = 3

export const SCOPE_API_READ = 1

export const SCOPE_DOC_READ = 3

export type PageKey =
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

export type QueryState = {
  isLoading: boolean
  isError: boolean
  error: Error | null
}

export type SelectOption = NativeSelectOption

export type PageGuidance = {
  title: string
  description: string
  action?: {
    href: string
    label: string
  }
}

export type EmptyStatePreset =
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

export const pageNextRoute: Record<PageKey, string> = {
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

export function useInvalidateResources() {
  const queryClient = useQueryClient()
  return (change: VdocChange) => invalidateVdocQueries(queryClient, change)
}

export function fieldValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

export function numberValue(formData: FormData, key: string, fallback: number) {
  const value = Number(fieldValue(formData, key))
  return Number.isFinite(value) ? value : fallback
}

export function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

export function activeFirstId(items: Array<{ id: string; status: number }>) {
  return items.find((item) => item.status === ACTIVE_STATUS)?.id ?? ''
}

export function contextualHref(
  href: string,
  projectId?: string,
  documentId?: string
) {
  const params = new URLSearchParams()
  if (projectId) params.set('project_id', projectId)
  if (documentId) params.set('document_id', documentId)
  const query = params.toString()
  return query ? `${href}?${query}` : href
}

export function entityOptionLabel(
  name: string,
  status: number,
  t: ReturnType<typeof useLanguage>['t']
) {
  return status === ACTIVE_STATUS
    ? name
    : `${name} — ${t('admin.statuses.archived')}`
}

export function tokenIsActive(token: MCPTokenDTO, now = Date.now()) {
  if (token.status !== ACTIVE_STATUS) return false
  if (!token.expires_at) return true
  const expiresAt = Date.parse(token.expires_at)
  return Number.isFinite(expiresAt) && expiresAt > now
}

export function tokenStatusLabel(
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

export function activeProjectRole(
  members: readonly ProjectMemberDTO[] | undefined,
  userId: string | undefined
) {
  if (!userId) return undefined
  return members?.find(
    (member) => member.user_id === userId && member.status === ACTIVE_STATUS
  )?.role
}

export function stringify(value: unknown) {
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

export function accountStatusLabel(
  status: number,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (status === ACTIVE_STATUS) return t('admin.statuses.active')
  if (status === ARCHIVED_OR_DISABLED_STATUS)
    return t('admin.statuses.disabled')
  return `${t('admin.common.unknown')} ${status}`
}

export function jsonPreview(value: unknown) {
  if (value === undefined || value === null || value === '') return '-'
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2) ?? '-'
}

export function methodLabel(method?: string) {
  return method?.toUpperCase() ?? '-'
}

export function changeSeverityLabel(
  severity: number,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (severity >= 3) return t('admin.diff.highSeverity')
  if (severity === 2) return t('admin.diff.mediumSeverity')
  if (severity === 1) return t('admin.diff.lowSeverity')
  return t('admin.diff.infoSeverity')
}

export function changeTypeLabel(
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

export function diffMessageLabel(
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

export type ConfirmedAction = {
  readonly label: React.ReactNode
  readonly title: React.ReactNode
  readonly description: string
  readonly onConfirm: () => Promise<unknown>
  readonly destructive: boolean
}

export function useRouteControlledString(
  routeValue: string | undefined,
  routeControlled: boolean
) {
  const [localValue, setLocalValue] = useState(routeValue ?? '')
  return [
    routeControlled ? (routeValue ?? '') : localValue,
    setLocalValue,
  ] as const
}

export function useProjectsAndSelection(
  preferredProjectId?: string,
  onProjectChange?: (projectId: string) => void
) {
  const { t } = useLanguage()
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: ({ signal }) => listProjects({ signal }),
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

export function useDocumentsAndSelection(
  projectId: string,
  documentType?: number,
  preferredDocumentId?: string,
  onDocumentChange?: (documentId: string) => void
) {
  const { t } = useLanguage()
  const documentsQuery = useQuery({
    queryKey: ['documents', projectId, documentType ?? 'all'],
    queryFn: ({ signal }) =>
      documentType === undefined
        ? listDocuments(projectId, undefined, { signal })
        : listDocuments(projectId, documentType, { signal }),
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

export function useVersionsAndSelection(
  projectId: string,
  documentId: string,
  branchId?: string,
  preferredVersionId?: string,
  onVersionChange?: (versionId: string) => void,
  page?: RequestOptions['page']
) {
  const versionsQuery = useQuery({
    queryKey: ['versions', projectId, documentId, branchId ?? 'all', page],
    queryFn: ({ signal }) =>
      listVersions(projectId, documentId, branchId, { signal, page }),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const versionId = useVdocContextStore((state) => state.versionId)
  const setVersionId = useVdocContextStore((state) => state.setVersionId)
  const requestedId = preferredVersionId ?? versionId
  const listedVersion = versionsQuery.data?.items.find(
    (version) => version.id === requestedId
  )
  const selectedQuery = useQuery({
    queryKey: ['version', projectId, documentId, requestedId],
    queryFn: ({ signal }) =>
      getVersion(projectId, documentId, requestedId, { signal }),
    enabled: Boolean(
      page &&
      projectId &&
      documentId &&
      requestedId &&
      versionsQuery.data &&
      !listedVersion
    ),
    retry: false,
  })
  const resolvedVersion =
    listedVersion ??
    (page &&
    selectedQuery.data?.branch_id &&
    (!branchId || selectedQuery.data.branch_id === branchId)
      ? selectedQuery.data
      : undefined)
  const hasPreferredVersion = preferredVersionId !== undefined
  const preferredVersionExists = Boolean(resolvedVersion)
  const selectedVersion =
    resolvedVersion ??
    (!hasPreferredVersion ? versionsQuery.data?.items[0] : undefined)
  const selectedVersionId = selectedVersion?.id ?? ''
  const versionOptions = useMemo(() => {
    const versions = versionsQuery.data?.items ?? []
    const options = versions.map((version) => ({
      value: version.id,
      label: version.version_name,
    }))
    if (
      selectedVersion &&
      !options.some((option) => option.value === selectedVersion.id)
    )
      options.unshift({
        value: selectedVersion.id,
        label: selectedVersion.version_name,
      })
    return options
  }, [versionsQuery.data, selectedVersion])
  const onVersionChangeRef = useRef(onVersionChange)
  useEffect(() => {
    onVersionChangeRef.current = onVersionChange
  }, [onVersionChange])
  useEffect(() => {
    if (!versionsQuery.data || selectedQuery.isFetching) return
    if (selectedVersionId !== versionId) setVersionId(selectedVersionId)
    if (!hasPreferredVersion && selectedVersionId)
      onVersionChangeRef.current?.(selectedVersionId)
  }, [
    hasPreferredVersion,
    selectedVersionId,
    setVersionId,
    versionId,
    versionsQuery.data,
    selectedQuery.isFetching,
  ])
  const selectVersionId = (value: string) => {
    setVersionId(value)
    onVersionChangeRef.current?.(value)
  }
  return {
    versionsQuery,
    selectedVersion,
    versionId: selectedVersionId,
    setVersionId: selectVersionId,
    versionOptions,
    invalidVersionDeepLink: Boolean(
      versionsQuery.data &&
      hasPreferredVersion &&
      !preferredVersionExists &&
      (!page || selectedQuery.isError)
    ),
  }
}

export function contentKindOptions(
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

export function activeContentKind(
  contentKind: string,
  options: SelectOption[]
) {
  return options.some((option) => option.value === contentKind)
    ? contentKind
    : 'raw'
}
