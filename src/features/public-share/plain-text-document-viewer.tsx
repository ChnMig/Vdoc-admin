import { cn } from '@/lib/utils'

export type PlainTextDocumentViewerProps = {
  readonly content: string
  readonly className?: string
  readonly variant?: 'panel' | 'article'
}

export function PlainTextDocumentViewer({
  content,
  className,
  variant = 'panel',
}: PlainTextDocumentViewerProps) {
  return (
    <article
      className={cn(
        variant === 'article'
          ? 'max-w-full min-w-0 text-base leading-8 text-foreground'
          : 'max-w-full min-w-0 overflow-hidden rounded-lg border bg-card p-5 text-sm leading-6 text-card-foreground shadow-[var(--shadow-card)] panel-control sm:p-6',
        className
      )}
    >
      <pre className='m-0 max-w-full font-mono break-words whitespace-pre-wrap'>
        {content}
      </pre>
    </article>
  )
}
