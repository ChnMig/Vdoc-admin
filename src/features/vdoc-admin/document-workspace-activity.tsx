import { useInfiniteQuery } from '@tanstack/react-query'
import { GitBranch, History } from 'lucide-react'
import { listDocumentActivity, type DocumentActivityDTO } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import { LoadingErrorState } from './page-shared'
import { formatDate } from './page-utils'

export function DocumentWorkspaceActivity({
  projectId,
  documentId,
}: {
  projectId: string
  documentId: string
}) {
  const { t, language } = useLanguage()
  const query = useInfiniteQuery({
    queryKey: ['document-activity', projectId, documentId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      listDocumentActivity(projectId, documentId, pageParam, { signal }),
    getNextPageParam: (page) => page.nextCursor || undefined,
  })
  const entries = query.data?.pages.flatMap((page) => page.items) ?? []
  return (
    <section className='grid min-w-0 gap-5'>
      <LoadingErrorState state={query} />
      {entries.length ? (
        <ol className='divide-y'>
          {entries.map((entry) => (
            <li key={entry.id} className='grid min-w-0 gap-2 py-4 first:pt-0'>
              <div className='flex flex-wrap items-center justify-between gap-2 text-sm'>
                <span className='flex items-center gap-2 font-medium'>
                  <History
                    aria-hidden
                    className='size-4 text-muted-foreground'
                  />
                  {activityLabel(entry, t)}
                </span>
                <time
                  dateTime={entry.created_at}
                  className='text-xs text-muted-foreground'
                >
                  {formatDate(entry.created_at, language)}
                </time>
              </div>
              <div className='flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground'>
                {entry.branch_id && (
                  <span className='flex min-w-0 items-center gap-1.5'>
                    <GitBranch aria-hidden className='size-3.5 shrink-0' />
                    <span className='break-all'>
                      {entry.branch_name || entry.branch_id}
                    </span>
                  </span>
                )}
                {entry.version_name && (
                  <span className='break-all'>{entry.version_name}</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        !query.isPending &&
        !query.isError && (
          <p className='py-8 text-sm text-muted-foreground'>
            {t('reader.activityEmpty')}
          </p>
        )
      )}
      {query.hasNextPage && (
        <Button
          type='button'
          variant='outline'
          className='w-fit'
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {t('reader.more')}
        </Button>
      )}
    </section>
  )
}

function activityLabel(
  entry: DocumentActivityDTO,
  t: ReturnType<typeof useLanguage>['t']
) {
  const [resource, action] = entry.action.split('.')
  if (resource.endsWith('_draft')) {
    if (action === 'review')
      return t(
        entry.review_action === 'approve'
          ? 'reader.events.approve'
          : entry.review_action === 'reject'
            ? 'reader.events.reject'
            : 'reader.events.requestChanges'
      )
    return t(
      action === 'submit'
        ? 'reader.events.submit'
        : action === 'update'
          ? 'reader.events.updateDraft'
          : action === 'promote'
            ? 'reader.events.promote'
            : 'reader.events.createDraft'
    )
  }
  if (resource.endsWith('_branch'))
    return t(
      action === 'create'
        ? 'reader.events.createBranch'
        : action === 'archive'
          ? 'reader.events.archiveBranch'
          : 'reader.events.updateBranch'
    )
  if (action === 'publish') return t('reader.events.publish')
  return t(
    action === 'create'
      ? 'reader.events.createDocument'
      : action === 'archive'
        ? 'reader.events.archiveDocument'
        : 'reader.events.updateDocument'
  )
}
