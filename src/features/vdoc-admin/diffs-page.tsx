import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  ChevronDown,
  GitCompareArrows,
  SearchIcon,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import {
  compareDiff,
  getDiff,
  listBranches,
  listDiffs,
  listProjectMembers,
  type AISummaryTarget,
  type DiffListDTO,
} from '@/lib/vdoc-api'
import { type VdocPageDeepLinkProps } from '@/lib/vdoc-route-search'
import { useLanguage } from '@/context/language-provider'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { usePageOffset } from '@/hooks/use-page-offset'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AIContextPanel } from './ai-panels'
import {
  PageChrome,
  DeepLinkAlert,
  SelectorGrid,
  ContextSelectorGrid,
  NativeSelect,
  LoadingErrorState,
  CollectionCard,
  EmptyState,
  DiffSummaryCards,
  DiffReviewList,
} from './page-shared'
import {
  useProjectsAndSelection,
  useDocumentsAndSelection,
  useRouteControlledString,
  ACTIVE_STATUS,
  activeProjectRole,
  ROLE_ADMIN,
  formatDate,
  isTextDocumentType,
  isTextDocumentFormat,
  entityOptionLabel,
} from './page-utils'
import { QueryPagination } from './query-pagination'
import { useVersionChoices } from './use-version-choices'
import { useWorkspaceEmbedding } from './workspace-embedding'

type DiffFilter = 'all' | 'breaking' | 'mustHandle' | 'high'

function diffFilter(value: string): DiffFilter {
  if (value === 'breaking' || value === 'mustHandle' || value === 'high') {
    return value
  }
  return 'all'
}

export function DiffsPage({
  search,
  onSearchChange,
}: VdocPageDeepLinkProps = {}) {
  const { t } = useLanguage()
  const embedded = useWorkspaceEmbedding()
  const queryClient = useQueryClient()
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
  const [diff, setDiff] = useState<DiffListDTO | null>(null)
  const [fromBranchId, setFromBranchId] = useRouteControlledString(
    search?.from_branch_id,
    onSearchChange !== undefined
  )
  const [toBranchId, setToBranchId] = useRouteControlledString(
    search?.to_branch_id,
    onSearchChange !== undefined
  )
  const [fromVersionId, setFromVersionId] = useRouteControlledString(
    search?.from_version_id,
    onSearchChange !== undefined
  )
  const [toVersionId, setToVersionId] = useRouteControlledString(
    search?.to_version_id,
    onSearchChange !== undefined
  )
  const [diffSearch, setDiffSearch] = useState('')
  const [workspaceView, setWorkspaceView] = useState({
    context: '',
    value: 'result',
  })
  const resultTabTriggerRef = useRef<HTMLButtonElement>(null)
  const [diffFilterValue, setDiffFilterValue] = useState<DiffFilter>('all')
  const resolveDiffById = Boolean(search?.diff_id)
  const [historySearch, setHistorySearch] = useState('')
  const debouncedHistorySearch = useDebouncedValue(historySearch.trim())
  const [historyOffset, setHistoryOffset] = usePageOffset(
    JSON.stringify([
      projectId,
      documentId,
      resolveDiffById ? '' : fromVersionId,
      resolveDiffById ? '' : toVersionId,
      debouncedHistorySearch,
    ])
  )
  const historyPage = {
    page_size: 50,
    offset: historyOffset,
    search: debouncedHistorySearch,
  }
  const diffHistoryQuery = useQuery({
    queryKey: [
      'diffs',
      projectId,
      documentId,
      resolveDiffById ? 'resolve-id' : fromVersionId,
      resolveDiffById ? search?.diff_id : toVersionId,
      historyPage,
    ],
    queryFn: ({ signal }) =>
      listDiffs(
        projectId,
        documentId,
        resolveDiffById ? undefined : fromVersionId || undefined,
        resolveDiffById ? undefined : toVersionId || undefined,
        { signal, page: historyPage }
      ),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const requestedDiffQuery = useQuery({
    queryKey: ['diff', projectId, documentId, search?.diff_id],
    queryFn: ({ signal }) =>
      getDiff(projectId, documentId, search!.diff_id!, { signal }),
    enabled: Boolean(projectId && documentId && search?.diff_id),
    staleTime: 30_000,
    retry: false,
  })
  const requestedDiff =
    requestedDiffQuery.data?.document_id === documentId
      ? requestedDiffQuery.data
      : undefined
  const choices = useVersionChoices(projectId, documentId, [
    fromVersionId,
    toVersionId,
    requestedDiff?.from_version_id,
    requestedDiff?.to_version_id,
  ])
  const { versionsQuery, versionOptions } = choices
  const branchOptions =
    branchesQuery.data?.items.map((branch) => ({
      value: branch.id,
      label: entityOptionLabel(branch.name, branch.status, t),
    })) ?? []
  const defaultBranchId =
    branchesQuery.data?.items.find((branch) => branch.is_default)?.id ??
    branchesQuery.data?.items[0]?.id ??
    ''
  const inferredFromBranchId = choices.versions.find(
    (version) =>
      version.id === (requestedDiff?.from_version_id ?? fromVersionId)
  )?.branch_id
  const inferredToBranchId = choices.versions.find(
    (version) => version.id === (requestedDiff?.to_version_id ?? toVersionId)
  )?.branch_id
  const selectedFromBranchId =
    (requestedDiff ? inferredFromBranchId : fromBranchId) ||
    inferredFromBranchId ||
    defaultBranchId
  const selectedToBranchId =
    (requestedDiff ? inferredToBranchId : toBranchId) ||
    inferredToBranchId ||
    defaultBranchId
  const validFromBranch = branchOptions.some(
    (branch) => branch.value === selectedFromBranchId
  )
  const validToBranch = branchOptions.some(
    (branch) => branch.value === selectedToBranchId
  )
  const fromChoices = useVersionChoices(
    projectId,
    documentId,
    [fromVersionId, requestedDiff?.from_version_id],
    selectedFromBranchId,
    validFromBranch
  )
  const toChoices = useVersionChoices(
    projectId,
    documentId,
    [toVersionId, requestedDiff?.to_version_id],
    selectedToBranchId,
    validToBranch
  )
  const validFromVersionIds = new Set(
    fromChoices.versionOptions.map((option) => option.value)
  )
  const validToVersionIds = new Set(
    toChoices.versionOptions.map((option) => option.value)
  )
  const versionLabelById = useMemo(
    () => new Map(versionOptions.map((option) => [option.value, option.label])),
    [versionOptions]
  )
  const requestedFromVersionId = validFromVersionIds.has(fromVersionId)
    ? fromVersionId
    : ''
  const requestedToVersionId = validToVersionIds.has(toVersionId)
    ? toVersionId
    : ''
  const selectedFromVersionId = requestedDiff?.from_version_id
    ? validFromVersionIds.has(requestedDiff.from_version_id)
      ? requestedDiff.from_version_id
      : ''
    : requestedFromVersionId
  const selectedToVersionId = requestedDiff?.to_version_id
    ? validToVersionIds.has(requestedDiff.to_version_id)
      ? requestedDiff.to_version_id
      : ''
    : requestedToVersionId
  const workspaceContext = JSON.stringify([
    projectId,
    documentId,
    selectedFromVersionId,
    selectedToVersionId,
    search?.diff_id,
  ])
  const activeWorkspaceView =
    workspaceView.context === workspaceContext ? workspaceView.value : 'result'
  const comparisonHistoryQuery = useQuery({
    queryKey: [
      'diffs',
      projectId,
      documentId,
      'exact-pair',
      selectedFromVersionId,
      selectedToVersionId,
    ],
    queryFn: ({ signal }) =>
      listDiffs(
        projectId,
        documentId,
        selectedFromVersionId,
        selectedToVersionId,
        { signal, page: { page_size: 50, offset: 0, search: '' } }
      ),
    enabled: Boolean(
      projectId && documentId && selectedFromVersionId && selectedToVersionId
    ),
  })
  const persistedDiff = comparisonHistoryQuery.data?.items.find(
    (item) =>
      item.document_id === documentId &&
      item.from_version_id === selectedFromVersionId &&
      item.to_version_id === selectedToVersionId
  )
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
  useEffect(() => {
    if (!requestedDiff) return
    const patch: {
      from_branch_id?: string
      to_branch_id?: string
    } = {}
    if (
      search?.from_branch_id &&
      inferredFromBranchId &&
      search.from_branch_id !== inferredFromBranchId
    )
      patch.from_branch_id = inferredFromBranchId
    if (
      search?.to_branch_id &&
      inferredToBranchId &&
      search.to_branch_id !== inferredToBranchId
    )
      patch.to_branch_id = inferredToBranchId
    if (Object.keys(patch).length) onSearchChange?.(patch, { replace: true })
  }, [
    inferredFromBranchId,
    inferredToBranchId,
    onSearchChange,
    requestedDiff,
    search?.from_branch_id,
    search?.to_branch_id,
  ])
  const activeDiffCandidate =
    search?.diff_id !== undefined
      ? (requestedDiff ?? null)
      : diff?.document_id === documentId &&
          diff.from_version_id === selectedFromVersionId &&
          diff.to_version_id === selectedToVersionId
        ? diff
        : (persistedDiff ?? null)
  const activeDiffQuery = useQuery({
    queryKey: ['diff', projectId, documentId, activeDiffCandidate?.id],
    queryFn: ({ signal }) =>
      getDiff(projectId, documentId, activeDiffCandidate!.id, { signal }),
    enabled: Boolean(projectId && documentId && activeDiffCandidate?.id),
    staleTime: 30_000,
  })
  const activeDiff =
    activeDiffQuery.data?.document_id === documentId
      ? activeDiffQuery.data
      : undefined
  const invalidFromVersionDeepLink = Boolean(
    versionsQuery.data &&
    !choices.isResolving &&
    !fromChoices.isResolving &&
    fromChoices.versionsQuery.isSuccess &&
    search?.from_version_id &&
    !validFromVersionIds.has(search.from_version_id)
  )
  const invalidToVersionDeepLink = Boolean(
    versionsQuery.data &&
    !choices.isResolving &&
    !toChoices.isResolving &&
    toChoices.versionsQuery.isSuccess &&
    search?.to_version_id &&
    !validToVersionIds.has(search.to_version_id)
  )
  const invalidFromBranchDeepLink = Boolean(
    !requestedDiff &&
    branchesQuery.isSuccess &&
    search?.from_branch_id &&
    !validFromBranch
  )
  const invalidToBranchDeepLink = Boolean(
    !requestedDiff &&
    branchesQuery.isSuccess &&
    search?.to_branch_id &&
    !validToBranch
  )
  const invalidDiffDeepLink = Boolean(
    search?.diff_id && requestedDiffQuery.isError
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
  const selectedToVersion = choices.versions.find(
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
  const comparisonTarget = useMemo(
    () => ({
      actorId: authUser?.id,
      projectId,
      documentId,
      fromBranchId: selectedFromBranchId,
      toBranchId: selectedToBranchId,
      fromVersionId: selectedFromVersionId,
      toVersionId: selectedToVersionId,
      diffId: search?.diff_id,
    }),
    [
      authUser?.id,
      projectId,
      documentId,
      selectedFromBranchId,
      selectedToBranchId,
      selectedFromVersionId,
      selectedToVersionId,
      search?.diff_id,
    ]
  )
  const activeComparisonTarget = useRef<typeof comparisonTarget | null>(null)
  useLayoutEffect(() => {
    activeComparisonTarget.current = comparisonTarget
    return () => {
      activeComparisonTarget.current = null
    }
  }, [comparisonTarget])
  const diffMutation = useMutation({
    mutationFn: (request: typeof comparisonTarget) =>
      compareDiff(request.projectId, request.documentId, {
        from_version_id: request.fromVersionId,
        to_version_id: request.toVersionId,
      }),
    onSuccess: (result, request) => {
      // 切换文档、版本或离开页面后，旧请求只刷新其所属文档的缓存。
      if (activeComparisonTarget.current === request) {
        queryClient.setQueryData(
          ['diff', request.projectId, request.documentId, result.id],
          result
        )
        setDiff(result)
        setWorkspaceView({ context: workspaceContext, value: 'result' })
        onSearchChange?.({
          from_version_id: result.from_version_id || undefined,
          to_version_id: result.to_version_id || undefined,
          diff_id: result.id,
        })
      }
      return queryClient.invalidateQueries({
        queryKey: ['diffs', request.projectId, request.documentId],
      })
    },
  })
  const comparisonIsCurrent = diffMutation.variables === comparisonTarget
  const clearComparison = () => {
    activeComparisonTarget.current = null
    setDiff(null)
  }
  const summary = activeDiff?.summary
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
          invalidFromBranchDeepLink
            ? [`${t('admin.diff.fromBranch')}: ${search?.from_branch_id}`]
            : []),
          ...(!invalidProjectDeepLink &&
          !invalidDocumentDeepLink &&
          invalidToBranchDeepLink
            ? [`${t('admin.diff.toBranch')}: ${search?.to_branch_id}`]
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
      {branchesQuery.isError && <LoadingErrorState state={branchesQuery} />}
      <ContextSelectorGrid>
        <NativeSelect
          label={t('admin.fields.project')}
          value={projectId}
          onChange={(value) => {
            clearComparison()
            setFromBranchId('')
            setToBranchId('')
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
            clearComparison()
            setFromBranchId('')
            setToBranchId('')
            setFromVersionId('')
            setToVersionId('')
            setDocumentId(value)
          }}
          placeholder={t('admin.placeholders.selectDocument')}
          options={documentOptions}
        />
      </ContextSelectorGrid>
      <section
        aria-label={t('admin.diff.comparisonContext')}
        className='grid min-w-0 gap-5 border-b pb-5'
      >
        <p className='text-sm text-muted-foreground'>
          {t('admin.diff.branchCompareHint')}
        </p>
        <div className='grid min-w-0 gap-5 md:grid-cols-2'>
          <fieldset className='grid min-w-0 content-start gap-4'>
            <legend className='mb-3 text-sm font-semibold'>
              {t('admin.diff.source')}
            </legend>
            <NativeSelect
              label={t('admin.diff.fromBranch')}
              value={selectedFromBranchId}
              onChange={(value) => {
                clearComparison()
                setFromBranchId(value)
                setFromVersionId('')
                onSearchChange?.({
                  from_branch_id: value || undefined,
                  from_version_id: undefined,
                  diff_id: undefined,
                })
              }}
              placeholder={t('admin.placeholders.selectBranch')}
              options={branchOptions}
              disabled={branchesQuery.isLoading}
            />
            <NativeSelect
              label={t('admin.fields.fromVersion')}
              value={selectedFromVersionId}
              onChange={(value) => {
                clearComparison()
                setFromVersionId(value)
                onSearchChange?.({
                  from_version_id: value || undefined,
                  diff_id: undefined,
                })
              }}
              placeholder={t('admin.placeholders.selectVersion')}
              options={fromChoices.versionOptions}
              disabled={!validFromBranch || fromChoices.versionsQuery.isLoading}
            />
            <LoadingErrorState state={fromChoices.versionsQuery} />
          </fieldset>
          <fieldset className='grid min-w-0 content-start gap-4'>
            <legend className='mb-3 text-sm font-semibold'>
              {t('admin.diff.target')}
            </legend>
            <NativeSelect
              label={t('admin.diff.toBranch')}
              value={selectedToBranchId}
              onChange={(value) => {
                clearComparison()
                setToBranchId(value)
                setToVersionId('')
                onSearchChange?.({
                  to_branch_id: value || undefined,
                  to_version_id: undefined,
                  diff_id: undefined,
                })
              }}
              placeholder={t('admin.placeholders.selectBranch')}
              options={branchOptions}
              disabled={branchesQuery.isLoading}
            />
            <NativeSelect
              label={t('admin.fields.toVersion')}
              value={selectedToVersionId}
              onChange={(value) => {
                clearComparison()
                setToVersionId(value)
                onSearchChange?.({
                  to_version_id: value || undefined,
                  diff_id: undefined,
                })
              }}
              placeholder={t('admin.placeholders.selectVersion')}
              options={toChoices.versionOptions}
              disabled={!validToBranch || toChoices.versionsQuery.isLoading}
            />
            <LoadingErrorState state={toChoices.versionsQuery} />
          </fieldset>
        </div>
      </section>
      <Collapsible className='grid min-w-0 gap-3'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <Button
            className='w-fit'
            disabled={
              !selectedFromVersionId ||
              !selectedToVersionId ||
              selectedFromVersionId === selectedToVersionId ||
              !activeDocumentContext ||
              !validFromBranch ||
              !validToBranch ||
              comparisonHistoryQuery.isLoading ||
              Boolean(activeDiffCandidate) ||
              (comparisonIsCurrent && diffMutation.isPending)
            }
            onClick={() => diffMutation.mutate(comparisonTarget)}
          >
            <GitCompareArrows className='size-4' />
            {activeDiffCandidate
              ? t('admin.diff.existingLoaded')
              : t('admin.common.compare')}
          </Button>
          <CollapsibleTrigger asChild>
            <Button variant='ghost' size='sm' className='group'>
              <SearchIcon className='size-4' />
              {t('admin.pagination.searchVersions')}
              <ChevronDown className='size-4 transition-transform group-data-[state=open]:rotate-180' />
            </Button>
          </CollapsibleTrigger>
        </div>
        <p className='text-sm text-muted-foreground'>
          {t('admin.diff.compareHint')}
        </p>
        <CollapsibleContent className='grid min-w-0 gap-3 rounded-lg border bg-card p-4'>
          <div className='grid min-w-0 gap-5 md:grid-cols-2'>
            {[
              {
                choices: fromChoices,
                id: 'source',
                label: t('admin.diff.searchSourceVersions'),
                paginationLabel: t('admin.diff.sourceVersionPagination'),
              },
              {
                choices: toChoices,
                id: 'target',
                label: t('admin.diff.searchTargetVersions'),
                paginationLabel: t('admin.diff.targetVersionPagination'),
              },
            ].map(({ choices: side, id, label, paginationLabel }) => (
              <div key={id} className='grid min-w-0 content-start gap-3'>
                <div className='grid gap-2'>
                  <Label htmlFor={`diff-${id}-version-search`}>{label}</Label>
                  <Input
                    id={`diff-${id}-version-search`}
                    value={side.search}
                    onChange={(event) => side.setSearch(event.target.value)}
                    placeholder={t('admin.fields.versionName')}
                  />
                </div>
                <QueryPagination
                  label={paginationLabel}
                  offset={side.offset}
                  count={side.versionsQuery.data?.items.length ?? 0}
                  total={side.versionsQuery.data?.total}
                  hasMore={
                    side.offset + (side.versionsQuery.data?.items.length ?? 0) <
                    (side.versionsQuery.data?.total ?? 0)
                  }
                  busy={side.versionsQuery.isFetching}
                  onPrevious={() => side.setOffset(side.offset - 50)}
                  onNext={() => side.setOffset(side.offset + 50)}
                />
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
      {comparisonIsCurrent && diffMutation.isError && (
        <Alert variant='destructive' aria-live='polite'>
          <AlertCircle />
          <AlertTitle>{t('admin.common.error')}</AlertTitle>
          <AlertDescription>{diffMutation.error.message}</AlertDescription>
        </Alert>
      )}
      <Tabs
        value={activeWorkspaceView}
        onValueChange={(value) =>
          setWorkspaceView({ context: workspaceContext, value })
        }
        className='min-w-0 gap-5'
      >
        <TabsList className='h-auto max-w-full flex-wrap justify-start'>
          <TabsTrigger
            ref={resultTabTriggerRef}
            value='result'
            className='h-auto min-h-9 flex-none'
          >
            {t('admin.sections.diffResult')}
          </TabsTrigger>
          <TabsTrigger value='history' className='h-auto min-h-9 flex-none'>
            {t('admin.diff.historyTitle')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value='result' className='grid min-w-0 gap-4'>
          <LoadingErrorState
            state={{
              isLoading: search?.diff_id
                ? requestedDiffQuery.isLoading
                : Boolean(activeDiffCandidate) && activeDiffQuery.isLoading,
              isError: requestedDiffQuery.isError || activeDiffQuery.isError,
              error: requestedDiffQuery.error ?? activeDiffQuery.error,
            }}
          />
          <CollectionCard
            title={t('admin.sections.diffResult')}
            description={activeDiff?.id ?? t('admin.diff.noDiffSelected')}
            count={visibleItems.length}
          >
            {summary && (
              <DiffSummaryCards
                summary={summary}
                isTextDiff={
                  isTextDocumentFormat(summary.document_format) ||
                  isTextDocumentType(selectedDocument?.document_type)
                }
              />
            )}
            <SelectorGrid>
              <div className='grid gap-2'>
                <Label htmlFor='diff-search'>
                  {t('admin.diff.searchLabel')}
                </Label>
                <div className='relative'>
                  <SearchIcon className='pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
                  <Input
                    id='diff-search'
                    value={diffSearch}
                    onChange={(event) =>
                      setDiffSearch(event.currentTarget.value)
                    }
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
                isTextDiff={
                  isTextDocumentFormat(summary?.document_format) ||
                  isTextDocumentType(selectedDocument?.document_type)
                }
              />
            ) : (
              <EmptyState preset='diffs' />
            )}
          </CollectionCard>
        </TabsContent>
        <TabsContent value='history' className='grid min-w-0 gap-4'>
          <LoadingErrorState
            state={{
              isLoading: diffHistoryQuery.isLoading,
              isError: diffHistoryQuery.isError,
              error: diffHistoryQuery.error,
            }}
          />
          <CollectionCard
            title={t('admin.diff.historyTitle')}
            description={t('admin.diff.historyDescription')}
            count={diffHistoryQuery.data?.total ?? 0}
          >
            <div className='grid max-w-md gap-2'>
              <Label htmlFor='diff-history-search'>
                {t('admin.pagination.searchDiffs')}
              </Label>
              <Input
                id='diff-history-search'
                value={historySearch}
                onChange={(event) =>
                  setHistorySearch(event.currentTarget.value)
                }
              />
            </div>
            {diffHistoryQuery.data?.items.length ? (
              <div className='grid divide-y rounded-md border'>
                {diffHistoryQuery.data.items
                  .filter((item) => item.document_id === documentId)
                  .map((item) => {
                    const fromVersionLabel =
                      versionLabelById.get(item.from_version_id ?? '') ??
                      item.from_version_id ??
                      '-'
                    const toVersionLabel =
                      versionLabelById.get(item.to_version_id ?? '') ??
                      item.to_version_id ??
                      '-'
                    const fromBranch = branchesQuery.data?.items.find(
                      (branch) =>
                        branch.id ===
                        choices.versions.find(
                          (version) => version.id === item.from_version_id
                        )?.branch_id
                    )
                    const toBranch = branchesQuery.data?.items.find(
                      (branch) =>
                        branch.id ===
                        choices.versions.find(
                          (version) => version.id === item.to_version_id
                        )?.branch_id
                    )
                    return (
                      <button
                        key={item.id}
                        type='button'
                        className='grid min-w-0 gap-1 border-b p-3 text-start transition-colors last:border-b-0 hover:bg-muted/50 focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
                        onClick={() => {
                          activeComparisonTarget.current = null
                          setFromBranchId('')
                          setToBranchId('')
                          setFromVersionId(item.from_version_id ?? '')
                          setToVersionId(item.to_version_id ?? '')
                          setDiff(item)
                          setWorkspaceView({
                            context: workspaceContext,
                            value: 'result',
                          })
                          resultTabTriggerRef.current?.focus()
                          onSearchChange?.({
                            from_branch_id: undefined,
                            to_branch_id: undefined,
                            from_version_id: item.from_version_id || undefined,
                            to_version_id: item.to_version_id || undefined,
                            diff_id: item.id,
                          })
                        }}
                      >
                        <span className='text-sm font-medium break-words'>
                          {fromVersionLabel} → {toVersionLabel}
                        </span>
                        {fromBranch &&
                          toBranch &&
                          fromBranch.id !== toBranch.id && (
                            <span className='text-xs text-muted-foreground'>
                              {fromBranch.name} → {toBranch.name}
                            </span>
                          )}
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
            <QueryPagination
              label={t('admin.pagination.diffs')}
              offset={historyOffset}
              count={diffHistoryQuery.data?.items.length ?? 0}
              total={diffHistoryQuery.data?.total}
              hasMore={
                historyOffset + (diffHistoryQuery.data?.items.length ?? 0) <
                (diffHistoryQuery.data?.total ?? 0)
              }
              busy={diffHistoryQuery.isFetching}
              onPrevious={() => setHistoryOffset(historyOffset - 50)}
              onNext={() => setHistoryOffset(historyOffset + 50)}
            />
          </CollectionCard>
        </TabsContent>
      </Tabs>
      {!embedded && (
        <AIContextPanel
          target={activeDiffAITarget}
          interactive={activeDiffAIInteractive}
          canRegenerate={canRegenerateDiffSummary}
        />
      )}
    </PageChrome>
  )
}
