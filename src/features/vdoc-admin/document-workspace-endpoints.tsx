import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SearchIcon } from 'lucide-react'
import { getEndpoint, listEndpoints } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { usePageOffset } from '@/hooks/use-page-offset'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EndpointsCard } from './endpoint-browser'
import { NativeSelect } from './page-shared'
import { QueryPagination } from './query-pagination'

export function DocumentWorkspaceEndpoints({
  projectId,
  documentId,
  versionId,
  endpointId,
  onEndpointChange,
}: {
  projectId: string
  documentId: string
  versionId: string
  endpointId?: string
  onEndpointChange: (value: string) => void
}) {
  const { t } = useLanguage()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim())
  const [offset, setOffset] = usePageOffset(
    JSON.stringify([projectId, documentId, versionId, debouncedSearch])
  )
  const [groupMode, setGroupMode] = useState<'tag' | 'method'>('tag')
  const endpointsQuery = useQuery({
    queryKey: [
      'endpoints',
      projectId,
      documentId,
      versionId,
      debouncedSearch,
      offset,
    ],
    queryFn: ({ signal }) =>
      listEndpoints(projectId, documentId, versionId, undefined, {
        signal,
        page: { page_size: 50, offset, search: debouncedSearch },
      }),
    enabled: Boolean(projectId && documentId && versionId),
    placeholderData: undefined,
  })
  const endpointQuery = useQuery({
    queryKey: ['endpoint', projectId, documentId, versionId, endpointId],
    queryFn: ({ signal }) =>
      getEndpoint(projectId, documentId, versionId, endpointId!, { signal }),
    enabled: Boolean(projectId && documentId && versionId && endpointId),
    placeholderData: undefined,
  })
  const detail = endpointQuery.data
  const validDetail =
    detail?.id === endpointId && detail?.version_id === versionId
      ? detail
      : undefined
  const invalidDetail = endpointQuery.isSuccess && !validDetail
  return (
    <EndpointsCard
      endpoints={(endpointsQuery.data?.items ?? []).filter(
        (endpoint) => endpoint.version_id === versionId
      )}
      selected={endpointId ?? ''}
      onSelect={onEndpointChange}
      detail={validDetail}
      groupMode={groupMode}
      untaggedLabel={t('admin.developerPortal.untagged')}
      toolbar={
        <div className='grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]'>
          <div className='grid gap-2'>
            <Label htmlFor='document-endpoint-search'>
              {t('admin.developerPortal.searchLabel')}
            </Label>
            <div className='relative'>
              <SearchIcon className='pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
              <Input
                id='document-endpoint-search'
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                placeholder={t('admin.developerPortal.searchPlaceholder')}
                className='ps-9'
              />
            </div>
          </div>
          <NativeSelect
            label={t('admin.developerPortal.groupBy')}
            value={groupMode}
            onChange={(value) =>
              setGroupMode(value === 'method' ? 'method' : 'tag')
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
        </div>
      }
      loadingState={
        endpointsQuery.isLoading || endpointsQuery.isError
          ? endpointsQuery
          : invalidDetail
            ? {
                isLoading: false,
                isError: true,
                error: new Error(t('admin.workspace.readerUnavailable')),
              }
            : endpointQuery
      }
      pagination={
        <QueryPagination
          offset={offset}
          count={endpointsQuery.data?.items.length ?? 0}
          total={endpointsQuery.data?.total}
          hasMore={endpointsQuery.data?.hasMore ?? false}
          busy={endpointsQuery.isFetching}
          onPrevious={() => setOffset(offset - 50)}
          onNext={() => setOffset(offset + 50)}
        />
      }
    />
  )
}
