import { useMemo, useState } from 'react'
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
  type EndpointDTO,
  type EndpointSummaryDTO,
  type VersionDTO,
} from '@/lib/vdoc-api'
import { type VdocPageDeepLinkProps } from '@/lib/vdoc-route-search'
import { useLanguage } from '@/context/language-provider'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { usePageOffset } from '@/hooks/use-page-offset'
import { Badge } from '@/components/ui/badge'
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
import { AIContextPanel } from './ai-panels'
import { MarkdownFactsCard } from './markdown-facts-card'
import { MarkdownPreview } from './markdown-preview'
import {
  TextField,
  LoadingErrorState,
  PageChrome,
  DeepLinkAlert,
  SelectorGrid,
  NativeSelect,
  StatCard,
  ContentViewer,
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
  contentKindOptions,
  activeContentKind,
  activeProjectRole,
  ROLE_ADMIN,
  entityOptionLabel,
  formatDate,
  methodLabel,
  jsonPreview,
} from './page-utils'
import { QueryPagination } from './query-pagination'

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
  const [versionOffset, setVersionOffset] = usePageOffset(
    JSON.stringify([
      projectId,
      documentId,
      branchFilter,
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
    branchFilter || undefined,
    search?.version_id,
    (value) =>
      onSearchChange?.({
        version_id: value || undefined,
        endpoint_id: undefined,
      }),
    { page_size: 50, offset: versionOffset, search: debouncedVersionSearch }
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
    queryFn: ({ signal }) =>
      getVersionContent(
        projectId,
        documentId,
        versionId,
        activeVersionContentKind,
        { signal }
      ),
    enabled:
      projectId.length > 0 && documentId.length > 0 && versionId.length > 0,
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
      !isMarkdownDocument,
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
      !isMarkdownDocument,
  })
  const invalidBranchDeepLink = Boolean(
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
      <TextField
        id='version-search'
        name='version_search'
        label={t('admin.pagination.searchVersions')}
        value={versionSearch}
        onChange={setVersionSearch}
      />
      <QueryPagination
        offset={versionOffset}
        count={versionsQuery.data?.items.length ?? 0}
        total={versionsQuery.data?.total}
        hasMore={versionsQuery.data?.hasMore ?? false}
        busy={versionsQuery.isFetching}
        onPrevious={() => setVersionOffset(versionOffset - 50)}
        onNext={() => setVersionOffset(versionOffset + 50)}
      />
      <LoadingErrorState state={versionsQuery} />
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
      <LoadingErrorState state={contentQuery} />
      {!isMarkdownDocument && (
        <LoadingErrorState
          state={endpointsQuery.isError ? endpointsQuery : endpointQuery}
        />
      )}
      <ContentViewer
        title={t('admin.sections.contentViewer')}
        content={selectedVersionContent}
      />
      {isMarkdownDocument ? (
        <>
          {selectedVersionContent && (
            <MarkdownPreview content={selectedVersionContent} />
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
          detail={endpointQuery.data}
          groupMode={endpointGroupMode}
          untaggedLabel={untaggedLabel}
        />
      )}
      {!isMarkdownDocument && (
        <QueryPagination
          offset={endpointOffset}
          count={visibleEndpoints.length}
          total={endpointsQuery.data?.total}
          hasMore={endpointsQuery.data?.hasMore ?? false}
          busy={endpointsQuery.isFetching}
          onPrevious={() => setEndpointOffset(endpointOffset - 50)}
          onNext={() => setEndpointOffset(endpointOffset + 50)}
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
