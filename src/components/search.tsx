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
        'group relative h-8 w-full flex-1 justify-start rounded-md border-input bg-background/75 text-sm font-normal text-muted-foreground shadow-none hover:border-ring/40 hover:bg-accent sm:w-40 sm:pe-12 md:flex-none lg:w-56 xl:w-72',
        className
      )}
      aria-keyshortcuts='Meta+K Control+K'
      onClick={() => setOpen(true)}
    >
      <SearchIcon
        aria-hidden='true'
        className='absolute inset-s-1.5 top-1/2 -translate-y-1/2'
        size={16}
      />
      <span className='ms-4'>{label}</span>
      <kbd className='pointer-events-none absolute inset-e-[0.3rem] top-[0.3rem] hidden h-5 items-center gap-1 rounded-sm border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 select-none group-hover:bg-background sm:flex'>
        <span className='text-xs'>⌘</span>K
      </kbd>
    </Button>
  )
}
