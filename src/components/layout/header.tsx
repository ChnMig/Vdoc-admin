import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

type HeaderProps = React.HTMLAttributes<HTMLElement> & {
  fixed?: boolean
  ref?: React.Ref<HTMLElement>
}

export function Header({ className, fixed, children, ...props }: HeaderProps) {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      setOffset(document.body.scrollTop || document.documentElement.scrollTop)
    }

    // Add scroll listener to the body
    document.addEventListener('scroll', onScroll, { passive: true })

    // Clean up the event listener on unmount
    return () => document.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'z-(--z-sticky) h-14',
        fixed && 'header-fixed peer/header sticky top-0 w-[inherit]',
        offset > 10 && fixed ? 'shadow-[0_1px_0_var(--border)]' : 'shadow-none',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'relative flex h-full items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5',
          offset > 10 &&
            fixed &&
            'after:absolute after:inset-0 after:-z-10 after:border-b after:bg-background/92 after:backdrop-blur-sm'
        )}
      >
        <SidebarTrigger variant='outline' className='size-8 max-md:scale-110' />
        <Separator orientation='vertical' className='h-5' />
        {children}
      </div>
    </header>
  )
}
