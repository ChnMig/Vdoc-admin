import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'

export function CodeSnippet({
  title,
  content,
}: {
  readonly title: string
  readonly content: string
}) {
  const { t } = useLanguage()
  const identity = useMemo(() => Symbol(`code-${content.length}`), [content])
  const [feedback, setFeedback] = useState<{
    identity: symbol
    status: 'success' | 'failure'
  }>()
  const status = feedback?.identity === identity ? feedback.status : undefined

  async function copy() {
    try {
      await navigator.clipboard.writeText(content)
      setFeedback({ identity, status: 'success' })
    } catch {
      setFeedback({ identity, status: 'failure' })
    }
  }

  return (
    <figure className='min-w-0 overflow-hidden rounded-md border bg-[var(--surface-control)]'>
      <figcaption className='flex min-w-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-2'>
        <span className='min-w-0 text-xs font-medium break-all'>{title}</span>
        <Button
          type='button'
          size='sm'
          variant='ghost'
          className='h-8 shrink-0'
          aria-label={`${t('admin.common.copy')}: ${title}`}
          onClick={() => void copy()}
        >
          {status === 'success' ? <Check /> : <Copy />}
          {t(
            status === 'success' ? 'admin.common.copied' : 'admin.common.copy'
          )}
        </Button>
      </figcaption>
      <pre
        tabIndex={0}
        aria-label={title}
        className='max-h-[32rem] min-w-0 overflow-auto p-4 text-xs leading-relaxed focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset'
      >
        <code>{content}</code>
      </pre>
      <div role='status' aria-live='polite'>
        {status === 'failure' && (
          <p className='border-t px-4 py-3 text-sm text-destructive'>
            {t('admin.common.copyFailed')}
          </p>
        )}
        {status === 'success' && (
          <span className='sr-only'>{t('admin.common.copied')}</span>
        )}
      </div>
    </figure>
  )
}
