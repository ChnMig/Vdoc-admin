import { type SVGProps } from 'react'
import { cn } from '@/lib/utils'

export function Logo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      id='vdoc-admin-logo'
      viewBox='0 0 24 24'
      xmlns='http://www.w3.org/2000/svg'
      height='24'
      width='24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className={cn('size-6', className)}
      {...props}
    >
      <title>Vdoc Admin</title>
      <path d='M4 5.5A2.5 2.5 0 0 1 6.5 3H17a3 3 0 0 1 3 3v13.5a1.5 1.5 0 0 1-1.5 1.5H6.5A2.5 2.5 0 0 1 4 18.5z' />
      <path d='M8 7h8' />
      <path d='M8 11h8' />
      <path d='M8 15h5' />
    </svg>
  )
}
