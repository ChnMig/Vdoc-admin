import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'

export function QueryPagination({
  label,
  itemLabel,
  hideSinglePageControls = false,
  offset,
  count,
  total,
  hasMore,
  busy,
  onPrevious,
  onNext,
}: {
  label?: string
  itemLabel?: string
  hideSinglePageControls?: boolean
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
      aria-label={label ?? t('admin.pagination.label')}
      className='flex flex-wrap items-center justify-between gap-3 border-t pt-3'
    >
      <p
        role='status'
        className='flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground'
      >
        {itemLabel && (
          <span className='font-medium text-foreground'>{itemLabel}</span>
        )}
        <span>
          {t('admin.pagination.range', {
            from: count ? offset + 1 : 0,
            to: count ? offset + count : 0,
          })}
          {total !== undefined &&
            ` · ${t('admin.pagination.total', { total })}`}
        </span>
      </p>
      {(!hideSinglePageControls || offset > 0 || hasMore) && (
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
      )}
    </nav>
  )
}
