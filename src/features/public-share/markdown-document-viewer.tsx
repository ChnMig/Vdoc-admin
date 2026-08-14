import type { ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { publicMarkdownLink } from './public-markdown-link'

export type MarkdownDocumentViewerProps = {
  readonly content: string
}

export function MarkdownDocumentViewer({
  content,
}: MarkdownDocumentViewerProps) {
  return (
    <article className='min-w-0 overflow-hidden rounded-lg border bg-card p-5 text-sm leading-6 text-card-foreground shadow-[var(--shadow-card)] panel-control sm:p-6'>
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => {
          const link = publicMarkdownLink(url)
          return link.kind === 'safe' ? link.href : ''
        }}
        components={{
          a: PublicMarkdownAnchor,
          img: () => null,
          input: ({ checked, className, node: _node, type, ...props }) => (
            <input
              {...props}
              type={type}
              checked={checked}
              aria-label={checked ? 'Completed task' : 'Open task'}
              className={cn('accent-primary', className)}
            />
          ),
          h1: ({ className, node: _node, ...props }) => (
            <h1
              className={cn(
                'mb-4 text-2xl font-semibold tracking-[-0.02em] text-balance',
                className
              )}
              {...props}
            />
          ),
          h2: ({ className, node: _node, ...props }) => (
            <h2
              className={cn(
                'mt-8 mb-3 text-xl font-semibold tracking-[-0.01em] text-balance',
                className
              )}
              {...props}
            />
          ),
          h3: ({ className, node: _node, ...props }) => (
            <h3
              className={cn(
                'mt-6 mb-2 text-lg font-semibold text-balance',
                className
              )}
              {...props}
            />
          ),
          p: ({ className, node: _node, ...props }) => (
            <p
              className={cn(
                'my-3 max-w-prose text-pretty break-words',
                className
              )}
              {...props}
            />
          ),
          ul: ({ className, node: _node, ...props }) => (
            <ul
              className={cn('my-3 list-disc space-y-1 pl-6', className)}
              {...props}
            />
          ),
          ol: ({ className, node: _node, ...props }) => (
            <ol
              className={cn('my-3 list-decimal space-y-1 pl-6', className)}
              {...props}
            />
          ),
          blockquote: ({ className, node: _node, ...props }) => (
            <blockquote
              className={cn(
                'my-4 rounded-md bg-muted px-4 py-3 text-muted-foreground',
                className
              )}
              {...props}
            />
          ),
          pre: ({ className, node: _node, ...props }) => (
            <pre
              className={cn(
                'my-4 max-w-full overflow-x-auto rounded-md bg-[var(--surface-control)] p-4 font-mono text-xs leading-5',
                className
              )}
              {...props}
            />
          ),
          code: ({ className, node: _node, ...props }) => (
            <code
              className={cn(
                'rounded-sm bg-muted px-1 py-0.5 font-mono text-xs break-words',
                className
              )}
              {...props}
            />
          ),
          table: ({ className, node: _node, ...props }) => (
            <div className='my-4 max-w-full overflow-x-auto rounded-md border'>
              <table
                className={cn('w-full border-collapse text-left', className)}
                {...props}
              />
            </div>
          ),
          th: ({ className, node: _node, ...props }) => (
            <th
              className={cn(
                'border-b bg-muted px-3 py-2 font-medium',
                className
              )}
              {...props}
            />
          ),
          td: ({ className, node: _node, ...props }) => (
            <td
              className={cn('border-b px-3 py-2 align-top', className)}
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  )
}

function PublicMarkdownAnchor({
  href,
  children,
  node: _node,
  ...props
}: ComponentPropsWithoutRef<'a'> & { readonly node?: unknown }) {
  if (href === undefined || publicMarkdownLink(href).kind === 'unsafe') {
    return <>{children}</>
  }

  return (
    <a
      {...props}
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      className='font-medium text-primary underline decoration-primary/35 underline-offset-4 hover:decoration-primary focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none'
    >
      {children}
    </a>
  )
}
