import { useMemo } from 'react'
import type { EndpointDTO, EndpointSummaryDTO } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Badge } from '@/components/ui/badge'
import { EndpointDetailPanel } from './endpoint-detail-panel'
import { CollectionCard, EmptyState, LoadingErrorState } from './page-shared'
import { methodLabel } from './page-utils'

type EndpointGroupMode = 'tag' | 'method'

function endpointTags(endpoint: EndpointSummaryDTO, fallback: string) {
  return endpoint.tags?.length ? endpoint.tags : [fallback]
}

export function EndpointsCard({
  endpoints,
  selected,
  onSelect,
  detail,
  groupMode,
  untaggedLabel,
  toolbar,
  loadingState,
  pagination,
}: {
  endpoints: EndpointSummaryDTO[]
  selected: string
  onSelect: (id: string) => void
  detail?: EndpointDTO
  groupMode: EndpointGroupMode
  untaggedLabel: string
  toolbar: React.ReactNode
  loadingState: React.ComponentProps<typeof LoadingErrorState>['state']
  pagination: React.ReactNode
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
      {toolbar}
      <LoadingErrorState state={loadingState} />
      <div
        className={
          detail
            ? 'grid min-w-0 gap-5 lg:grid-cols-[minmax(15rem,2fr)_minmax(0,3fr)]'
            : 'min-w-0'
        }
      >
        <div className='grid max-h-[40rem] min-w-0 content-start gap-4 overflow-y-auto pe-1'>
          {groupedEndpoints.length ? (
            groupedEndpoints.map(([group, groupEndpoints]) => (
              <section
                key={group}
                className='grid min-w-0 gap-3 border-t pt-4 first:border-0 first:pt-0'
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
                      data-state={
                        selected === endpoint.id ? 'selected' : undefined
                      }
                      className='grid min-w-0 gap-3 rounded-md border bg-background p-3 text-start transition-colors hover:bg-muted/40 data-[state=selected]:border-primary data-[state=selected]:bg-primary/8 sm:grid-cols-[4.5rem_minmax(0,1fr)]'
                      onClick={() => onSelect(endpoint.id)}
                    >
                      <div className='flex items-start gap-2'>
                        <Badge variant='outline'>
                          {methodLabel(endpoint.method)}
                        </Badge>
                      </div>
                      <div className='grid gap-2'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <code className='font-mono text-xs break-all'>
                            {endpoint.path}
                          </code>
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
          ) : !loadingState.isLoading && !loadingState.isError ? (
            <EmptyState preset='endpoints' />
          ) : null}
        </div>
        {detail && <EndpointDetailPanel endpoint={detail} />}
      </div>
      {pagination}
    </CollectionCard>
  )
}
