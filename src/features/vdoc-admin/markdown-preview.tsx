import { lazy, Suspense } from 'react'
import { useLanguage } from '@/context/language-provider'

const Viewer = lazy(() =>
  import('@/features/public-share/markdown-document-viewer').then((module) => ({
    default: module.MarkdownDocumentViewer,
  }))
)

export function MarkdownPreview({
  content,
  variant = 'panel',
  documentTitle,
}: {
  content: string
  variant?: 'panel' | 'article'
  documentTitle?: string
}) {
  const { t } = useLanguage()
  return (
    <Suspense
      fallback={
        <p role='status' className='text-sm text-muted-foreground'>
          {t('admin.common.loading')}
        </p>
      }
    >
      <Viewer
        content={content}
        variant={variant}
        documentTitle={documentTitle}
      />
    </Suspense>
  )
}
