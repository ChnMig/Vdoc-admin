import {
  lazy,
  Suspense,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Check, Code2, Copy, Download, Eye } from 'lucide-react'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { LanguageSwitch } from '@/components/language-switch'
import { ThemeSwitch } from '@/components/theme-switch'
import { OpenApiCodeViewer } from '@/features/public-share/openapi-code-viewer'
import { PlainTextDocumentViewer } from '@/features/public-share/plain-text-document-viewer'
import { DocumentTypeIcon } from './document-type-icon'
import { saveDocumentSource } from './save-document-source'

const MarkdownDocumentViewer = lazy(() =>
  import('@/features/public-share/markdown-document-viewer').then((module) => ({
    default: module.MarkdownDocumentViewer,
  }))
)

export function DocumentReadingPreferences() {
  return (
    <div className='flex shrink-0 items-center gap-0.5'>
      <LanguageSwitch />
      <ThemeSwitch />
    </div>
  )
}

// Both authenticated and capability-based readers use this surface. Fetching and
// permissions remain with the caller; only the exact source enters the reader.
export function DocumentReader({
  title,
  filePath,
  documentType,
  content,
  variant = 'article',
  header = true,
  metadata,
  children,
  renderContent,
  onDownload,
  downloading = false,
}: {
  title: string
  filePath?: string
  documentType: number
  content?: string
  variant?: 'article' | 'panel'
  header?: boolean
  metadata?: ReactNode
  children?: ReactNode
  renderContent?: (body: ReactNode) => ReactNode
  onDownload?: () => void
  downloading?: boolean
}) {
  const { t } = useLanguage()
  const [view, setView] = useState<'preview' | 'source'>('preview')
  const contentId = useId()
  const identity = useMemo(
    () => Symbol(`content-${content?.length}`),
    [content]
  )
  const [feedback, setFeedback] = useState<{
    identity: symbol
    success: boolean
  }>()
  const [copying, setCopying] = useState(false)
  const copyLock = useRef(false)
  const ready = content !== undefined
  const status = feedback?.identity === identity ? feedback : undefined
  const viewAction = t(
    view === 'preview'
      ? 'admin.workspace.switchToSource'
      : 'admin.workspace.switchToPreview'
  )
  async function copySource() {
    if (!ready || copyLock.current) return
    copyLock.current = true
    setCopying(true)
    try {
      await navigator.clipboard.writeText(content)
      setFeedback({ identity, success: true })
    } catch {
      setFeedback({ identity, success: false })
    } finally {
      copyLock.current = false
      setCopying(false)
    }
  }
  const controls = (
    <div
      className='flex min-w-0 flex-wrap items-center gap-2'
      data-document-view-control
    >
      {documentType === 2 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='outline'
              size='icon'
              className='size-8'
              aria-label={viewAction}
              aria-controls={ready ? contentId : undefined}
              disabled={!ready}
              onClick={() =>
                setView((previous) =>
                  previous === 'preview' ? 'source' : 'preview'
                )
              }
            >
              {view === 'preview' ? <Eye aria-hidden /> : <Code2 aria-hidden />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{viewAction}</TooltipContent>
        </Tooltip>
      )}
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={!ready || copying}
        onClick={() => void copySource()}
      >
        {status?.success ? <Check aria-hidden /> : <Copy aria-hidden />}
        {t(status?.success ? 'admin.common.copied' : 'reader.copy')}
      </Button>
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={!ready || downloading}
        onClick={() =>
          onDownload
            ? onDownload()
            : ready && saveDocumentSource(content, filePath || title)
        }
      >
        <Download aria-hidden />
        {t(downloading ? 'publicShare.downloading' : 'reader.download')}
      </Button>
    </div>
  )
  const body =
    content === undefined ? (
      children
    ) : (
      <div id={contentId} data-document-content className='min-w-0'>
        {documentType === 2 ? (
          view === 'preview' ? (
            <Suspense
              fallback={<p role='status'>{t('admin.common.loading')}</p>}
            >
              <MarkdownDocumentViewer
                content={content}
                variant={variant}
                documentTitle={title}
              />
            </Suspense>
          ) : (
            <pre
              tabIndex={0}
              aria-label={t('admin.workspace.source')}
              className='max-w-full overflow-auto rounded-md bg-[var(--surface-control)] p-4 font-mono text-xs leading-6'
            >
              {content}
            </pre>
          )
        ) : documentType === 3 ? (
          <PlainTextDocumentViewer content={content} variant={variant} />
        ) : (
          <OpenApiCodeViewer content={content} variant={variant} />
        )}
      </div>
    )
  return (
    <section className='grid min-w-0 gap-6'>
      {header ? (
        <header
          aria-label={t('admin.workspace.documentDetails')}
          data-document-reading-header
          className='@container grid min-w-0 gap-4 border-b pb-5'
        >
          <h1 className='flex min-w-0 items-start gap-2.5 text-2xl leading-9 font-semibold tracking-[-0.02em] sm:text-3xl'>
            <DocumentTypeIcon
              documentType={documentType}
              aria-hidden
              className='mt-2 size-5 shrink-0 text-muted-foreground'
            />
            <span className='min-w-0 break-words'>{title}</span>
          </h1>
          {metadata}
          <div className='flex min-w-0 flex-wrap items-end justify-between gap-4'>
            {filePath && (
              <dl className='grid min-w-0 gap-1 text-xs leading-5'>
                <dt className='text-muted-foreground'>
                  {t('admin.workspace.filePath')}
                </dt>
                <dd className='font-mono break-all'>{filePath}</dd>
              </dl>
            )}
            <div className='ms-auto'>{controls}</div>
          </div>
        </header>
      ) : (
        controls
      )}
      {status && (
        <div
          role='status'
          aria-live='polite'
          className={
            status && !status.success ? 'text-sm text-destructive' : 'sr-only'
          }
        >
          {status
            ? t(
                status.success
                  ? 'admin.common.copied'
                  : 'admin.common.copyFailed'
              )
            : ''}
        </div>
      )}
      {renderContent ? renderContent(body) : body}
    </section>
  )
}
