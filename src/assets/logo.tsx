import { type ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Logo({ className, alt = '', ...props }: ComponentProps<'img'>) {
  return (
    <img
      src='/images/vdoc-logo.png'
      alt={alt}
      height='24'
      width='24'
      className={cn('size-6 shrink-0 object-contain', className)}
      {...props}
    />
  )
}
