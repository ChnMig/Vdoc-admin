import { cn } from '@/lib/utils'

export type OpenApiCodeViewerProps = {
  readonly content: string
  readonly variant?: 'panel' | 'article'
}

export function OpenApiCodeViewer({
  content,
  variant = 'panel',
}: OpenApiCodeViewerProps) {
  return (
    <pre
      className={cn(
        'max-w-full overflow-x-auto font-mono break-words whitespace-pre-wrap',
        variant === 'article'
          ? 'text-sm leading-7 text-foreground'
          : 'rounded-lg border bg-card p-5 text-xs leading-5 text-card-foreground shadow-[var(--shadow-card)] panel-control sm:p-6'
      )}
    >
      <code>{content.replace(/\r\n?/g, '\n')}</code>
    </pre>
  )
}
