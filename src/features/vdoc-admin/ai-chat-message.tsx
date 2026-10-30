import { memo, useRef, useState, type ComponentPropsWithoutRef } from 'react'
import {
  Bot,
  UserRound,
  Check,
  Copy,
  Download,
  FileText,
  RotateCcw,
  ChevronRight,
  X,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { AIChatAttachmentDTO, AIChatMessageDTO } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import { publicMarkdownLink } from '@/features/public-share/public-markdown-link'
import { attachmentBytes, chatAttachmentURL } from './ai-chat-attachments'

export function ChatCopyButton({
  content,
  label,
}: {
  content: string
  label: string
}) {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type='button'
      size='icon'
      variant='ghost'
      className='size-7 shrink-0'
      aria-label={copied ? t('admin.ai.copied') : label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(content)
          setCopied(true)
        } catch {
          toast.error(t('admin.ai.copyFailed'))
        }
      }}
      onBlur={() => setCopied(false)}
    >
      {copied ? (
        <Check className='size-3.5' aria-hidden />
      ) : (
        <Copy className='size-3.5' aria-hidden />
      )}
    </Button>
  )
}

function ChatCodeBlock({
  children,
  ...props
}: ComponentPropsWithoutRef<'pre'>) {
  const { t } = useLanguage()
  // ReactMarkdown emits a code element whose child is the original code text.
  const child = children as { props?: { children?: string } }
  const code =
    typeof child?.props?.children === 'string' ? child.props.children : ''
  return (
    <div className='my-3 min-w-0 overflow-hidden rounded-md border bg-background'>
      <div className='flex items-center justify-end border-b px-2'>
        <ChatCopyButton content={code} label={t('admin.ai.copyCode')} />
      </div>
      <pre
        {...props}
        className='m-0 max-w-full overflow-x-auto p-3 text-xs leading-6'
      >
        {children}
      </pre>
    </div>
  )
}

export const AIChatMarkdown = memo(function AIChatMarkdown({
  content,
}: {
  content: string
}) {
  const { t } = useLanguage()
  return (
    <div className='ai-chat-markdown min-w-0 [overflow-wrap:anywhere]'>
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => {
          const link = publicMarkdownLink(url)
          return link.kind === 'safe' ? link.href : ''
        }}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target='_blank' rel='noopener noreferrer' />
          ),
          img: () => null,
          input: ({ node: _node, checked, ...props }) => (
            <input
              {...props}
              checked={checked}
              aria-label={t(
                checked ? 'admin.ai.completedTask' : 'admin.ai.openTask'
              )}
            />
          ),
          pre: ({ node: _node, ...props }) => <ChatCodeBlock {...props} />,
          table: ({ node: _node, ...props }) => (
            <div className='my-3 max-w-full overflow-x-auto'>
              <table {...props} />
            </div>
          ),
          h1: ({ node: _node, ...props }) => <h3 {...props} />,
          h2: ({ node: _node, ...props }) => <h3 {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})

export function ChatAttachmentList({
  attachments,
  onRemove,
}: {
  attachments: readonly AIChatAttachmentDTO[]
  onRemove?: (index: number) => void
}) {
  const { t } = useLanguage()
  return (
    <ul
      className='flex min-w-0 flex-wrap gap-2'
      aria-label={t('admin.ai.attachments')}
    >
      {attachments.map((attachment, index) => (
        <li
          key={`${index}:${attachment.name}`}
          className='relative flex max-w-full min-w-0 items-center gap-2 rounded-md border bg-background p-2 pe-8 text-foreground'
        >
          {attachment.media_type.startsWith('image/') && (
            <ChatImagePreview attachment={attachment} />
          )}
          <a
            href={chatAttachmentURL(attachment)}
            download={attachment.name}
            className='flex max-w-full min-w-0 items-center gap-2 rounded-sm text-xs focus-visible:ring-2 focus-visible:ring-ring'
            aria-label={t('admin.ai.downloadAttachment', {
              name: attachment.name,
            })}
          >
            {!attachment.media_type.startsWith('image/') && (
              <FileText
                aria-hidden
                className='size-6 shrink-0 text-muted-foreground'
              />
            )}
            <span className='grid min-w-0 gap-1'>
              <span className='max-w-36 truncate' title={attachment.name}>
                {attachment.name}
              </span>
              <span className='text-muted-foreground'>
                {Math.max(1, Math.ceil(attachmentBytes(attachment) / 1024))} KB
              </span>
            </span>
            {!onRemove && (
              <Download aria-hidden className='size-3.5 shrink-0' />
            )}
          </a>
          {onRemove && (
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='absolute end-0 top-0 size-7'
              aria-label={t('admin.ai.removeAttachment', {
                name: attachment.name,
              })}
              onClick={() => onRemove(index)}
            >
              <X className='size-3.5' aria-hidden />
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

function ChatImagePreview({ attachment }: { attachment: AIChatAttachmentDTO }) {
  const { t } = useLanguage()
  const previewRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const close = () => {
    previewRef.current?.close()
    triggerRef.current?.focus({ preventScroll: true })
  }
  return (
    <>
      <button
        ref={triggerRef}
        type='button'
        className='shrink-0 rounded-sm focus-visible:ring-2 focus-visible:ring-ring'
        aria-label={t('admin.ai.previewAttachment', { name: attachment.name })}
        onClick={() => previewRef.current?.showModal()}
      >
        <img
          src={chatAttachmentURL(attachment)}
          alt={attachment.name}
          className='size-14 rounded object-contain'
        />
      </button>
      <dialog
        ref={previewRef}
        aria-label={t('admin.ai.previewAttachment', { name: attachment.name })}
        className='fixed inset-0 m-auto max-h-[90dvh] max-w-[94vw] rounded-lg bg-card p-4 text-foreground backdrop:bg-black/60'
        onKeyDown={(event) => event.stopPropagation()}
        onCancel={(event) => {
          event.preventDefault()
          event.stopPropagation()
          close()
        }}
      >
        <div className='mb-3 flex items-center justify-between gap-4'>
          <p className='min-w-0 truncate text-sm font-medium'>
            {attachment.name}
          </p>
          <Button
            type='button'
            size='icon'
            variant='ghost'
            className='size-8 shrink-0'
            aria-label={t('admin.ai.closePreview')}
            onClick={close}
          >
            <X className='size-4' aria-hidden />
          </Button>
        </div>
        <img
          src={chatAttachmentURL(attachment)}
          alt={attachment.name}
          className='mx-auto max-h-[75dvh] max-w-full object-contain'
        />
      </dialog>
    </>
  )
}

export const AIChatMessage = memo(function AIChatMessage({
  message,
  pending = false,
  statusText,
  onRegenerate,
  regenerateDisabled,
}: {
  message: Pick<AIChatMessageDTO, 'role' | 'content' | 'attachments'> &
    Partial<Pick<AIChatMessageDTO, 'created_at' | 'reasoning'>>
  pending?: boolean
  statusText?: string
  onRegenerate?: () => void
  regenerateDisabled?: boolean
}) {
  const { t, language } = useLanguage()
  const user = message.role === 'user'
  const timestamp =
    message.created_at && !Number.isNaN(Date.parse(message.created_at))
      ? new Date(message.created_at)
      : null
  const role = user ? t('admin.ai.userRole') : t('admin.ai.assistantRole')
  return (
    <article
      data-chat-role={message.role}
      className={cn(
        'flex min-w-0 items-start gap-2.5',
        user && 'flex-row-reverse'
      )}
      aria-label={role}
    >
      <span
        data-chat-avatar
        className='hidden size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground @min-[36rem]/ai:flex'
        aria-hidden
      >
        {user ? <UserRound className='size-4' /> : <Bot className='size-4' />}
      </span>
      <div
        className={cn(
          'flex max-w-[min(94%,100ch)] min-w-0 flex-col gap-1.5',
          user ? 'items-end' : 'w-full items-start'
        )}
      >
        <div
          className={cn(
            'flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs text-muted-foreground',
            user && 'flex-row-reverse'
          )}
        >
          <span className='font-medium'>{role}</span>
          {timestamp && (
            <time
              dateTime={message.created_at}
              title={timestamp.toLocaleString(language)}
              className='text-[0.6875rem] tabular-nums'
            >
              {timestamp.toLocaleString(language, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          )}
        </div>
        <div
          className={cn(
            'grid max-w-full min-w-0 gap-2 rounded-xl px-3.5 py-2.5 text-sm leading-6',
            user
              ? 'rounded-se-sm bg-primary text-primary-foreground'
              : 'w-full rounded-ss-sm bg-muted/60 text-foreground'
          )}
          aria-busy={pending || undefined}
        >
          {!!message.attachments?.length && (
            <ChatAttachmentList attachments={message.attachments} />
          )}
          {!user && message.reasoning && (
            <details
              className='group min-w-0 border-b border-border/70 pb-2 text-muted-foreground'
              open={pending && !message.content ? true : undefined}
            >
              <summary className='flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm text-xs focus-visible:ring-2 focus-visible:ring-ring'>
                <ChevronRight
                  aria-hidden
                  className='size-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none'
                />
                {pending && !message.content
                  ? t('admin.ai.thinking')
                  : t('admin.ai.thinkingSummary')}
              </summary>
              <div className='mt-2 text-xs leading-5'>
                <AIChatMarkdown content={message.reasoning} />
              </div>
            </details>
          )}
          {message.content &&
            (user ? (
              <p className='[overflow-wrap:anywhere] whitespace-pre-wrap'>
                {message.content}
              </p>
            ) : (
              <AIChatMarkdown content={message.content} />
            ))}
          {pending && (
            <p role='status' className='text-xs text-muted-foreground'>
              {statusText || t('admin.ai.generating')}
            </p>
          )}
        </div>
        {!user && !pending && message.content && (
          <div className='flex items-center gap-1'>
            <ChatCopyButton
              content={message.content}
              label={t('admin.ai.copyMessage')}
            />
            {onRegenerate && (
              <Button
                type='button'
                size='sm'
                variant='ghost'
                className='h-7 px-2 text-xs text-muted-foreground'
                disabled={regenerateDisabled}
                onClick={onRegenerate}
              >
                <RotateCcw className='size-3.5' aria-hidden />
                {t('admin.ai.regenerateAnswer')}
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  )
})
