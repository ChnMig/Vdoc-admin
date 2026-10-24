import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, SquarePen } from 'lucide-react'
import {
  getDraftContent,
  getVersionContent,
  type DocumentDTO,
} from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PlainTextDocumentViewer } from '@/features/public-share/plain-text-document-viewer'
import { MarkdownPreview } from './markdown-preview'
import { LoadingErrorState } from './page-shared'
import { DOCUMENT_TYPE_MARKDOWN, DOCUMENT_TYPE_TEXT } from './page-utils'

export function DocumentWorkspaceContent({
  projectId,
  document,
  canWrite,
  onEditDraft,
}: {
  projectId: string
  document: DocumentDTO
  canWrite: boolean
  onEditDraft: () => void
}) {
  const { t } = useLanguage()
  const [view, setView] = useState('preview')
  const versionId = document.latest_version_id ?? ''
  const draftId = versionId ? '' : (document.latest_draft_id ?? '')
  const contentQuery = useQuery({
    queryKey: [
      versionId ? 'version-content' : 'draft-content',
      projectId,
      document.id,
      versionId || draftId,
      'raw',
    ],
    queryFn: ({ signal }) =>
      versionId
        ? getVersionContent(projectId, document.id, versionId, 'raw', {
            signal,
          })
        : getDraftContent(projectId, document.id, draftId, 'raw', { signal }),
    enabled: Boolean(versionId || draftId),
  })
  if (!versionId && !draftId)
    return (
      <div className='grid min-h-64 place-content-center justify-items-center gap-4 px-6 py-12 text-center'>
        <FileText aria-hidden className='size-9 text-muted-foreground' />
        <p className='max-w-md text-sm leading-6 text-muted-foreground'>
          {t('admin.workspace.emptyContent')}
        </p>
        {canWrite && (
          <Button onClick={onEditDraft}>
            <SquarePen aria-hidden />
            {t('admin.workspace.editDraft')}
          </Button>
        )}
      </div>
    )
  const content = contentQuery.data?.content
  return (
    <section className='grid min-w-0 gap-4'>
      <div className='flex min-w-0 flex-wrap items-center justify-between gap-3 border-b pb-4'>
        <div className='flex min-w-0 items-center gap-2'>
          <Badge variant='secondary'>
            {versionId
              ? t('admin.workspace.published')
              : t('admin.workspace.draft')}
          </Badge>
          <p className='text-sm text-muted-foreground'>
            {versionId
              ? t('admin.workspace.publishedContent')
              : t('admin.workspace.draftContent')}
          </p>
        </div>
        {canWrite && (
          <Button variant='outline' size='sm' onClick={onEditDraft}>
            <SquarePen aria-hidden />
            {t('admin.workspace.editDraft')}
          </Button>
        )}
      </div>
      <LoadingErrorState state={contentQuery} />
      {contentQuery.isError && (
        <Button
          variant='outline'
          className='w-fit'
          onClick={() => void contentQuery.refetch()}
        >
          {t('admin.workspace.retry')}
        </Button>
      )}
      {content !== undefined &&
        (document.document_type === DOCUMENT_TYPE_MARKDOWN ? (
          <Tabs value={view} onValueChange={setView} className='min-w-0 gap-4'>
            <TabsList>
              <TabsTrigger value='preview'>
                {t('admin.workspace.preview')}
              </TabsTrigger>
              <TabsTrigger value='source'>
                {t('admin.workspace.source')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value='preview' className='min-w-0'>
              <MarkdownPreview content={content} />
            </TabsContent>
            <TabsContent value='source' className='min-w-0'>
              <pre className='overflow-auto rounded-md border bg-[var(--surface-control)] p-4 text-xs leading-6'>
                {content}
              </pre>
            </TabsContent>
          </Tabs>
        ) : document.document_type === DOCUMENT_TYPE_TEXT ? (
          <PlainTextDocumentViewer content={content} />
        ) : (
          <pre className='overflow-auto rounded-md border bg-[var(--surface-control)] p-4 text-xs leading-6'>
            {content}
          </pre>
        ))}
    </section>
  )
}
