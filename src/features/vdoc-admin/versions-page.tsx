import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SearchIcon } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import {
  getEndpoint,
  getVersionContent,
  listBranches,
  listEndpoints,
  listProjectMembers,
  type AISummaryTarget,
  type EndpointSummaryDTO,
  type VersionDTO,
} from '@/lib/vdoc-api'
import { type VdocPageDeepLinkProps } from '@/lib/vdoc-route-search'
import { useLanguage } from '@/context/language-provider'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { usePageOffset } from '@/hooks/use-page-offset'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlainTextDocumentViewer } from '@/features/public-share/plain-text-document-viewer'
import { AIContextPanel } from './ai-panels'
import { EndpointsCard } from './endpoint-browser'
import { MarkdownFactsCard } from './markdown-facts-card'
import { MarkdownPreview } from './markdown-preview'
import {
  TextField,
  LoadingErrorState,
  PageChrome,
  DeepLinkAlert,
  ContextSelectorGrid,
  NativeSelect,
  CollectionCard,
  StatusBadge,
  EmptyState,
} from './page-shared'
import {
  ACTIVE_STATUS,
  useProjectsAndSelection,
  useDocumentsAndSelection,
  useRouteControlledString,
  useVersionsAndSelection,
  DOCUMENT_TYPE_MARKDOWN,
  DOCUMENT_TYPE_OPENAPI,
  DOCUMENT_TYPE_TEXT,
  contentKindOptions,
  activeContentKind,
  activeProjectRole,
  ROLE_ADMIN,
  entityOptionLabel,
  formatDate,
} from './page-utils'
import { QueryPagination } from './query-pagination'
import { useWorkspaceEmbedding } from './workspace-embedding'

type EndpointGroupMode = 'tag' | 'method'

function versionStatusLabel(
  status: number,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (status === ACTIVE_STATUS) return t('admin.statuses.published')
  return `${t('admin.common.unknown')} ${status}`
}

function parseEndpointGroupMode(value: string): EndpointGroupMode {
  return value === 'method' ? 'method' : 'tag'
}

function endpointTags(endpoint: EndpointSummaryDTO, fallback: string) {
  return endpoint.tags?.length ? endpoint.tags : [fallback]
}

export function VersionsPage({
  search,
  onSearchChange,
  presentation = 'full',
}: VdocPageDeepLinkProps & { presentation?: 'full' | 'history' } = {}) {
  const { t } = useLanguage()
  const embedded = useWorkspaceEmbedding()
  const historyOnly = presentation === 'history'
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
      from_branch_id: undefined,
      to_branch_id: undefined,
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
        from_branch_id: undefined,
        to_branch_id: undefined,
        from_version_id: undefined,
        to_version_id: undefined,
        diff_id: undefined,
      })
  )
  const branchesQuery = useQuery({
    queryKey: ['branches', projectId, documentId],
    queryFn: ({ signal }) => listBranches(projectId, documentId, { signal }),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: ({ signal }) => listProjectMembers(projectId, { signal }),
    enabled: projectId.length > 0 && !authUser?.is_super_admin,
  })
  const [branchFilter, setBranchFilter] = useRouteControlledString(
    search?.branch_id,
    onSearchChange !== undefined
  )
  const [versionSearch, setVersionSearch] = useState('')
  const debouncedVersionSearch = useDebouncedValue(versionSearch.trim())
  const versionBranchFilter = historyOnly
    ? undefined
    : branchFilter || undefined
  const [versionOffset, setVersionOffset] = usePageOffset(
    JSON.stringify([
      projectId,
      documentId,
      versionBranchFilter,
      debouncedVersionSearch,
    ])
  )
  const {
    versionsQuery,
    selectedVersion,
    versionId,
    setVersionId,
    versionOptions,
    invalidVersionDeepLink,
  } = useVersionsAndSelection(
    projectId,
    documentId,
    versionBranchFilter,
    search?.version_id,
    (value) => {
      if (historyOnly) return
      onSearchChange?.({
        version_id: value || undefined,
        endpoint_id: undefined,
      })
    },
    { page_size: 50, offset: versionOffset, search: debouncedVersionSearch }
  )
  const [contentKind, setContentKind] = useState('raw')
  const isMarkdownDocument =
    selectedDocument?.document_type === DOCUMENT_TYPE_MARKDOWN
  const isOpenApiDocument =
    selectedDocument?.document_type === DOCUMENT_TYPE_OPENAPI
  const isPlainTextDocument =
    selectedDocument?.document_type === DOCUMENT_TYPE_TEXT
  const versionContentKindOptions = contentKindOptions(
    t,
    selectedDocument?.document_type
  )
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
  const [workspaceTab, setWorkspaceTab] = useState({
    context: '',
    value: 'content',
  })
  const contentTabTriggerRef = useRef<HTMLButtonElement>(null)
  const workspaceContext = JSON.stringify([
    projectId,
    documentId,
    versionId,
    endpointId,
  ])
  const activeWorkspaceTab =
    workspaceTab.context === workspaceContext
      ? workspaceTab.value
      : endpointId && isOpenApiDocument
        ? 'endpoints'
        : 'content'
  const contentQuery = useQuery({
    queryKey: [
      'version-content',
      projectId,
      documentId,
      versionId,
      activeVersionContentKind,
    ],
    queryFn: ({ signal }) =>
      getVersionContent(
        projectId,
        documentId,
        versionId,
        activeVersionContentKind,
        { signal }
      ),
    enabled:
      !historyOnly &&
      projectId.length > 0 &&
      documentId.length > 0 &&
      versionId.length > 0,
  })
  const endpointSearch = useDebouncedValue(endpointSearchQuery.trim())
  const [endpointOffset, setEndpointOffset] = usePageOffset(
    JSON.stringify([projectId, documentId, versionId, endpointSearch])
  )
  const endpointsQuery = useQuery({
    queryKey: [
      'endpoints',
      projectId,
      documentId,
      versionId,
      endpointSearch,
      endpointOffset,
    ],
    queryFn: ({ signal }) =>
      listEndpoints(projectId, documentId, versionId, undefined, {
        signal,
        page: { page_size: 50, offset: endpointOffset, search: endpointSearch },
      }),
    enabled:
      projectId.length > 0 &&
      documentId.length > 0 &&
      versionId.length > 0 &&
      !historyOnly &&
      isOpenApiDocument,
  })
  const untaggedLabel = t('admin.developerPortal.untagged')
  const visibleEndpoints = endpointsQuery.data?.items ?? []
  const endpointQuery = useQuery({
    queryKey: ['endpoint', projectId, documentId, versionId, endpointId],
    queryFn: ({ signal }) =>
      getEndpoint(projectId, documentId, versionId, endpointId, { signal }),
    enabled:
      projectId.length > 0 &&
      documentId.length > 0 &&
      versionId.length > 0 &&
      endpointId.length > 0 &&
      !historyOnly &&
      isOpenApiDocument,
  })
  const invalidBranchDeepLink = Boolean(
    !historyOnly &&
    branchesQuery.data &&
    search?.branch_id &&
    !branchesQuery.data.items.some((branch) => branch.id === search.branch_id)
  )
  const invalidEndpointDeepLink = Boolean(
    !invalidVersionDeepLink && search?.endpoint_id && endpointQuery.isError
  )
  const methodCount = new Set(
    visibleEndpoints.map((endpoint) => endpoint.method)
  ).size
  const tagCount = new Set(
    visibleEndpoints.flatMap((endpoint) =>
      endpointTags(endpoint, untaggedLabel)
    )
  ).size
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
    setWorkspaceTab({
      context: JSON.stringify([projectId, documentId, value, '']),
      value: 'content',
    })
  }
  const selectedVersionContent = contentQuery.data?.content
  const selectedProject = projectsQuery.data?.items.find(
    (project) => project.id === projectId
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
      <ContextSelectorGrid scopeFields={4}>
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
      </ContextSelectorGrid>
      {historyOnly ? (
        <VersionsTable
          versions={versionsQuery.data?.items ?? []}
          selected={versionId}
          onSelect={(value) => {
            const version = versionsQuery.data?.items.find(
              (version) => version.id === value
            )
            if (!version) return
            setVersionId(value)
            onSearchChange?.({
              branch_id: version.branch_id,
              version_id: value,
              endpoint_id: undefined,
              workspace_view: 'content',
              content_mode: 'published',
              draft_id: undefined,
            })
          }}
          search={versionSearch}
          branchLabels={
            new Map(
              branchesQuery.data?.items.map((branch) => [
                branch.id,
                entityOptionLabel(branch.name, branch.status, t),
              ])
            )
          }
          onSearchChange={setVersionSearch}
          loadingState={versionsQuery}
          pagination={
            <QueryPagination
              offset={versionOffset}
              count={versionsQuery.data?.items.length ?? 0}
              total={versionsQuery.data?.total}
              hasMore={versionsQuery.data?.hasMore ?? false}
              busy={versionsQuery.isFetching}
              onPrevious={() => setVersionOffset(versionOffset - 50)}
              onNext={() => setVersionOffset(versionOffset + 50)}
            />
          }
        />
      ) : (
        <Tabs
          value={activeWorkspaceTab}
          onValueChange={(value) =>
            setWorkspaceTab({ context: workspaceContext, value })
          }
          className='min-w-0 gap-5'
        >
          <TabsList className='h-auto max-w-full flex-wrap justify-start'>
            <TabsTrigger
              ref={contentTabTriggerRef}
              value='content'
              className='h-auto min-h-9 flex-none'
            >
              {t('admin.sections.contentViewer')}
            </TabsTrigger>
            {isOpenApiDocument && (
              <TabsTrigger
                value='endpoints'
                className='h-auto min-h-9 flex-none'
              >
                {t('admin.sections.endpoints')}
              </TabsTrigger>
            )}
            <TabsTrigger value='versions' className='h-auto min-h-9 flex-none'>
              {t('admin.sections.versions')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value='versions' className='grid min-w-0 gap-4'>
            <VersionsTable
              versions={versionsQuery.data?.items ?? []}
              selected={versionId}
              onSelect={(value) => {
                handleVersionChange(value)
                contentTabTriggerRef.current?.focus()
              }}
              search={versionSearch}
              onSearchChange={setVersionSearch}
              loadingState={versionsQuery}
              pagination={
                <QueryPagination
                  offset={versionOffset}
                  count={versionsQuery.data?.items.length ?? 0}
                  total={versionsQuery.data?.total}
                  hasMore={versionsQuery.data?.hasMore ?? false}
                  busy={versionsQuery.isFetching}
                  onPrevious={() => setVersionOffset(versionOffset - 50)}
                  onNext={() => setVersionOffset(versionOffset + 50)}
                />
              }
            />
          </TabsContent>
          <TabsContent value='content' className='grid min-w-0 gap-5'>
            <CollectionCard
              title={t('admin.sections.contentViewer')}
              description={selectedVersion?.changelog}
            >
              <div className='flex min-w-0 flex-wrap items-end justify-between gap-4'>
                {selectedVersion && (
                  <div className='flex min-w-0 flex-wrap items-center gap-3 text-sm'>
                    <span className='font-medium break-all'>
                      {selectedVersion.version_name}
                    </span>
                    <StatusBadge>
                      {versionStatusLabel(selectedVersion.status, t)}
                    </StatusBadge>
                    <span className='text-muted-foreground'>
                      {formatDate(selectedVersion.published_at)}
                    </span>
                  </div>
                )}
                <div className='w-full sm:w-48'>
                  <NativeSelect
                    label={t('admin.fields.contentKind')}
                    value={activeVersionContentKind}
                    onChange={setContentKind}
                    placeholder={t('admin.types.raw')}
                    options={versionContentKindOptions}
                  />
                </div>
              </div>
              <LoadingErrorState state={contentQuery} />
              {selectedVersionContent && isPlainTextDocument ? (
                <div className='max-h-[36rem] min-w-0 overflow-auto'>
                  <PlainTextDocumentViewer content={selectedVersionContent} />
                </div>
              ) : selectedVersionContent ? (
                <pre className='max-h-[36rem] overflow-auto rounded-md border bg-[var(--surface-control)] p-4 text-xs leading-relaxed text-foreground'>
                  {selectedVersionContent}
                </pre>
              ) : (
                <p className='text-sm text-muted-foreground'>
                  {t('admin.common.empty')}
                </p>
              )}
            </CollectionCard>
            {isMarkdownDocument && (
              <>
                {selectedVersionContent && (
                  <MarkdownPreview content={selectedVersionContent} />
                )}
                <MarkdownFactsCard content={selectedVersionContent} />
              </>
            )}
          </TabsContent>
          {isOpenApiDocument && (
            <TabsContent value='endpoints' className='grid min-w-0 gap-4'>
              <dl className='flex min-w-0 flex-wrap gap-x-6 gap-y-3 border-b pb-4 text-sm'>
                {[
                  [
                    t('admin.developerPortal.endpointCount'),
                    String(
                      endpointsQuery.data?.total ?? visibleEndpoints.length
                    ),
                  ],
                  [t('admin.developerPortal.methodCount'), String(methodCount)],
                  [t('admin.developerPortal.tagCount'), String(tagCount)],
                ].map(([label, value]) => (
                  <div key={label} className='flex items-baseline gap-2'>
                    <dt className='text-muted-foreground'>{label}</dt>
                    <dd className='font-semibold tabular-nums'>{value}</dd>
                  </div>
                ))}
              </dl>
              <EndpointsCard
                endpoints={visibleEndpoints}
                selected={endpointId}
                onSelect={(value) => {
                  setEndpointId(value)
                  onSearchChange?.({ endpoint_id: value || undefined })
                }}
                detail={endpointQuery.data}
                groupMode={endpointGroupMode}
                untaggedLabel={untaggedLabel}
                toolbar={
                  <div className='grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]'>
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
                          placeholder={t(
                            'admin.developerPortal.searchPlaceholder'
                          )}
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
                        {
                          value: 'tag',
                          label: t('admin.developerPortal.groupByTag'),
                        },
                        {
                          value: 'method',
                          label: t('admin.developerPortal.groupByMethod'),
                        },
                      ]}
                    />
                  </div>
                }
                loadingState={
                  endpointsQuery.isError ? endpointsQuery : endpointQuery
                }
                pagination={
                  <QueryPagination
                    offset={endpointOffset}
                    count={visibleEndpoints.length}
                    total={endpointsQuery.data?.total}
                    hasMore={endpointsQuery.data?.hasMore ?? false}
                    busy={endpointsQuery.isFetching}
                    onPrevious={() => setEndpointOffset(endpointOffset - 50)}
                    onNext={() => setEndpointOffset(endpointOffset + 50)}
                  />
                }
              />
            </TabsContent>
          )}
        </Tabs>
      )}
      {!embedded && !historyOnly && (
        <AIContextPanel
          target={selectedVersionAITarget}
          interactive={selectedVersionAIInteractive}
          canRegenerate={canRegenerateVersionSummary}
        />
      )}
    </PageChrome>
  )
}

function VersionsTable({
  versions,
  selected,
  onSelect,
  search,
  onSearchChange,
  loadingState,
  pagination,
  branchLabels,
}: {
  versions: VersionDTO[]
  selected: string
  onSelect: (id: string) => void
  search: string
  onSearchChange: (value: string) => void
  loadingState: React.ComponentProps<typeof LoadingErrorState>['state']
  pagination: React.ReactNode
  branchLabels?: ReadonlyMap<string, string>
}) {
  const { t } = useLanguage()
  return (
    <CollectionCard
      title={t('admin.sections.versions')}
      count={versions.length}
    >
      <div className='max-w-md'>
        <TextField
          id='version-search'
          name='version_search'
          label={t('admin.pagination.searchVersions')}
          value={search}
          onChange={onSearchChange}
        />
      </div>
      <LoadingErrorState state={loadingState} />
      {versions.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.fields.versionName')}</TableHead>
              {branchLabels && (
                <TableHead>{t('admin.fields.branch')}</TableHead>
              )}
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
                {branchLabels && (
                  <TableCell>
                    {branchLabels.get(version.branch_id) ?? version.branch_id}
                  </TableCell>
                )}
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
      {pagination}
    </CollectionCard>
  )
}
