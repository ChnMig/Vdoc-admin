import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'

export function QueryPagination({
  offset,
  count,
  total,
  hasMore,
  busy,
  onPrevious,
  onNext,
}: {
  offset: number
  count: number
  total?: number
  hasMore: boolean
  busy: boolean
  onPrevious: () => void
  onNext: () => void
}) {
  const { t } = useLanguage()
  return (
    <nav
      aria-label={t('admin.pagination.label')}
      className='flex flex-wrap items-center justify-between gap-3 py-3'
    >
      <p role='status' className='text-sm text-muted-foreground'>
        {t('admin.pagination.range', {
          from: count ? offset + 1 : 0,
          to: offset + count,
        })}
        {total !== undefined && ` · ${t('admin.pagination.total', { total })}`}
      </p>
      <div className='flex gap-2'>
        <Button
          variant='outline'
          size='sm'
          disabled={busy || offset === 0}
          onClick={onPrevious}
        >
          {t('admin.pagination.previous')}
        </Button>
        <Button
          variant='outline'
          size='sm'
          disabled={busy || !hasMore}
          onClick={onNext}
        >
          {t('admin.pagination.next')}
        </Button>
      </div>
    </nav>
  )
}
