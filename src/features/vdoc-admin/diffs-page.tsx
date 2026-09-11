import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, GitCompareArrows, SearchIcon } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import {
  compareDiff,
  getDiffSummary,
  listBranches,
  listDiffs,
  listProjectMembers,
  type AISummaryTarget,
  type DiffDTO,
} from '@/lib/vdoc-api'
import { type VdocPageDeepLinkProps } from '@/lib/vdoc-route-search'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AIContextPanel } from './ai-panels'
import {
  PageChrome,
  DeepLinkAlert,
  SelectorGrid,
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
  DOCUMENT_TYPE_MARKDOWN,
} from './page-utils'
import { QueryPagination } from './query-pagination'
import { useVersionChoices } from './use-version-choices'

const DOCUMENT_FORMAT_MARKDOWN = 3

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
  const resolveDiffById = Boolean(search?.diff_id)
  const diffHistoryQuery = useQuery({
    queryKey: [
      'diffs',
      projectId,
      documentId,
      resolveDiffById ? 'resolve-id' : fromVersionId,
      resolveDiffById ? search?.diff_id : toVersionId,
    ],
    queryFn: ({ signal }) =>
      listDiffs(
        projectId,
        documentId,
        resolveDiffById ? undefined : fromVersionId || undefined,
        resolveDiffById ? undefined : toVersionId || undefined,
        { signal }
      ),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const requestedDiff = search?.diff_id
    ? diffHistoryQuery.data?.items.find((item) => item.id === search.diff_id)
    : undefined
  const choices = useVersionChoices(projectId, documentId, [
    fromVersionId,
    toVersionId,
    requestedDiff?.from_version_id,
    requestedDiff?.to_version_id,
  ])
  const { versionsQuery, versionOptions } = choices
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
    !choices.isResolving &&
    search?.from_version_id &&
    !validVersionIds.has(search.from_version_id)
  )
  const invalidToVersionDeepLink = Boolean(
    versionsQuery.data &&
    !choices.isResolving &&
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
      fromVersionId: selectedFromVersionId,
      toVersionId: selectedToVersionId,
      diffId: search?.diff_id,
    }),
    [
      authUser?.id,
      projectId,
      documentId,
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
        setDiff(result)
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
  const summaryQuery = useQuery({
    queryKey: ['diff-summary', projectId, documentId, activeDiff?.id],
    queryFn: ({ signal }) =>
      getDiffSummary(projectId, documentId, activeDiff?.id ?? '', { signal }),
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
      <div className='grid gap-2'>
        <Label htmlFor='diff-version-search'>
          {t('admin.pagination.searchVersions')}
        </Label>
        <Input
          id='diff-version-search'
          value={choices.search}
          onChange={(event) => choices.setSearch(event.target.value)}
          placeholder={t('admin.fields.versionName')}
        />
        <QueryPagination
          offset={choices.offset}
          count={versionsQuery.data?.items.length ?? 0}
          total={versionsQuery.data?.total}
          hasMore={
            choices.offset + (versionsQuery.data?.items.length ?? 0) <
            (versionsQuery.data?.total ?? 0)
          }
          busy={versionsQuery.isFetching}
          onPrevious={() => choices.setOffset(choices.offset - 50)}
          onNext={() => choices.setOffset(choices.offset + 50)}
        />
      </div>
      <div className='flex flex-wrap items-center gap-3'>
        <Button
          className='w-fit'
          disabled={
            !selectedFromVersionId ||
            !selectedToVersionId ||
            selectedFromVersionId === selectedToVersionId ||
            !activeDocumentContext ||
            Boolean(persistedDiff) ||
            (comparisonIsCurrent && diffMutation.isPending)
          }
          onClick={() => diffMutation.mutate(comparisonTarget)}
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
      {comparisonIsCurrent && diffMutation.isError && (
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
