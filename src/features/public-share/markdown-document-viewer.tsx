import type { ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { publicMarkdownLink } from './public-markdown-link'

export type MarkdownDocumentViewerProps = {
  readonly content: string
  readonly variant?: 'panel' | 'article'
  readonly documentTitle?: string
}

export function MarkdownDocumentViewer({
  content,
  variant = 'panel',
  documentTitle,
}: MarkdownDocumentViewerProps) {
  const article = variant === 'article'
  return (
    <article
      className={
        article
          ? 'min-w-0 text-base leading-[1.9] break-words text-foreground'
          : 'min-w-0 overflow-hidden rounded-lg border bg-card p-5 text-sm leading-6 text-card-foreground shadow-[var(--shadow-card)] panel-control sm:p-6'
      }
    >
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
          h1: ({ className, node, ...props }) =>
            article &&
            documentTitle &&
            node?.position?.start.offset !== undefined &&
            !content.slice(0, node.position.start.offset).trim() &&
            normalizeHeading(headingText(node)) ===
              normalizeHeading(documentTitle) ? null : (
              <h1
                className={cn(
                  article
                    ? 'mb-7 scroll-mt-8 text-[2rem] leading-[1.35] font-semibold tracking-[-0.02em] text-balance'
                    : 'mb-4 text-2xl font-semibold tracking-[-0.02em] text-balance',
                  className
                )}
                {...props}
              />
            ),
          h2: ({ className, node: _node, ...props }) => (
            <h2
              className={cn(
                article
                  ? 'mt-11 mb-4 scroll-mt-8 text-2xl leading-[1.45] font-semibold tracking-[-0.01em] text-balance'
                  : 'mt-8 mb-3 text-xl font-semibold tracking-[-0.01em] text-balance',
                className
              )}
              {...props}
            />
          ),
          h3: ({ className, node: _node, ...props }) => (
            <h3
              className={cn(
                article
                  ? 'mt-8 mb-3 scroll-mt-8 text-xl leading-normal font-semibold text-balance'
                  : 'mt-6 mb-2 text-lg font-semibold text-balance',
                className
              )}
              {...props}
            />
          ),
          h4: ({ className, node: _node, ...props }) => (
            <h4
              className={cn(
                'mt-6 mb-2 scroll-mt-8 text-base font-semibold text-balance',
                className
              )}
              {...props}
            />
          ),
          p: ({ className, node: _node, ...props }) => (
            <p
              className={cn(
                article
                  ? 'my-5 text-pretty break-words'
                  : 'my-3 max-w-prose text-pretty break-words',
                className
              )}
              {...props}
            />
          ),
          ul: ({ className, node: _node, ...props }) => (
            <ul
              className={cn(
                article
                  ? 'my-5 list-disc space-y-2 pl-6'
                  : 'my-3 list-disc space-y-1 pl-6',
                className
              )}
              {...props}
            />
          ),
          ol: ({ className, node: _node, ...props }) => (
            <ol
              className={cn(
                article
                  ? 'my-5 list-decimal space-y-2 pl-6'
                  : 'my-3 list-decimal space-y-1 pl-6',
                className
              )}
              {...props}
            />
          ),
          blockquote: ({ className, node: _node, ...props }) => (
            <blockquote
              className={cn(
                article
                  ? 'my-6 border-s border-border ps-4 text-muted-foreground'
                  : 'my-4 rounded-md bg-muted px-4 py-3 text-muted-foreground',
                className
              )}
              {...props}
            />
          ),
          pre: ({ className, node: _node, ...props }) => (
            <pre
              className={cn(
                article
                  ? 'my-6 max-w-full overflow-x-auto rounded-md bg-[var(--surface-control)] p-4 font-mono text-sm leading-6 [&>code]:bg-transparent [&>code]:p-0 [&>code]:whitespace-pre'
                  : 'my-4 max-w-full overflow-x-auto rounded-md bg-[var(--surface-control)] p-4 font-mono text-xs leading-5',
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

type HeadingTextNode = {
  type: string
  value?: string
  children?: readonly HeadingTextNode[]
}

function headingText(node: HeadingTextNode): string {
  return node.type === 'text'
    ? (node.value ?? '')
    : (node.children?.map(headingText).join('') ?? '')
}

function normalizeHeading(text: string) {
  return text.trim().replace(/\s+/g, ' ')
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
