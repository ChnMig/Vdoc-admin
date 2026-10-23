import { type ComponentProps } from 'react'
import { getAdminBranding } from '@/lib/branding'
import { cn } from '@/lib/utils'

export function Logo({ className, alt = '', ...props }: ComponentProps<'img'>) {
  return (
    <img
      src={getAdminBranding().logo}
      alt={alt}
      height='24'
      width='24'
      className={cn('size-6 shrink-0 object-contain', className)}
      {...props}
    />
  )
}
