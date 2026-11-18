import { SearchIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/context/language-provider'
import { useSearch } from '@/context/search-provider'
import { Button } from './ui/button'

export function Search({
  className = '',
  placeholder,
  ...props
}: React.ComponentProps<'button'> & { placeholder?: string }) {
  const { setOpen } = useSearch()
  const { t } = useLanguage()
  const label = placeholder ?? t('search.button')

  return (
    <Button
      {...props}
      variant='outline'
      className={cn(
        'group relative h-9 w-full flex-1 justify-start gap-2 border-transparent bg-surface-panel text-sm font-normal text-muted-foreground shadow-none hover:border-input hover:bg-surface-control sm:w-40 sm:pe-14 md:flex-none lg:w-56 xl:w-64',
        className
      )}
      aria-keyshortcuts='Meta+K Control+K'
      onClick={() => setOpen(true)}
    >
      <SearchIcon aria-hidden='true' className='size-4' />
      <span>{label}</span>
      <kbd className='pointer-events-none absolute end-2 top-2 hidden h-5 items-center gap-0.5 rounded border border-border/80 bg-card px-1 font-mono text-xs text-muted-foreground select-none sm:flex'>
        <span>⌘</span>K
      </kbd>
    </Button>
  )
}
