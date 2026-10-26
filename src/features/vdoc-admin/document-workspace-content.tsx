import { lazy, Suspense, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, FileText, GitBranch, SquarePen } from 'lucide-react'
import {
  getDraftContent,
  getVersionContent,
  type DocumentDTO,
  type DraftDTO,
  type VersionDTO,
} from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DocumentReader } from '@/features/document-reader/document-reader'
import { DOCUMENT_TYPE_OPENAPI } from './page-utils'

const DocumentWorkspaceEndpoints = lazy(() =>
  import('./document-workspace-endpoints').then((module) => ({
    default: module.DocumentWorkspaceEndpoints,
  }))
)

export type DocumentReadingSelection = {
  mode: 'published' | 'draft'
  branchId: string
  branchName?: string
  version?: VersionDTO
  draft?: DraftDTO
  pending?: boolean
  invalid?: boolean
}

export function DocumentWorkspaceContent({
  projectId,
  document,
  canWrite,
  onEditDraft,
  selection,
  presentation = 'panel',
  endpointId,
  onEndpointChange,
}: {
  projectId: string
  document: DocumentDTO
  canWrite: boolean
  onEditDraft: () => void
  selection?: DocumentReadingSelection
  presentation?: 'panel' | 'page'
  endpointId?: string
  onEndpointChange?: (value: string) => void
}) {
  const { t } = useLanguage()
  const [openApiView, setOpenApiView] = useState({
    context: '',
    value: 'source',
  })
  const revision =
    selection?.mode === 'published' ? selection.version : selection?.draft
  const invalid = Boolean(
    selection?.invalid ||
    (selection &&
      revision &&
      (revision.project_id !== projectId ||
        revision.document_id !== document.id ||
        !selection.branchId ||
        revision.branch_id !== selection.branchId))
  )
  const mode =
    selection?.mode ?? (document.latest_version_id ? 'published' : 'draft')
  const targetId = selection
    ? !invalid && !selection.pending
      ? (revision?.id ?? '')
      : ''
    : mode === 'published'
      ? (document.latest_version_id ?? '')
      : (document.latest_draft_id ?? '')
  const hasEndpointBrowser =
    mode === 'published' && document.document_type === DOCUMENT_TYPE_OPENAPI
  const openApiContext = JSON.stringify([projectId, document.id, targetId])
  const activeOpenApiView = endpointId
    ? 'endpoints'
    : openApiView.context === openApiContext
      ? openApiView.value
      : 'source'
  const contentQuery = useQuery({
    queryKey: [
      mode === 'published' ? 'version-content' : 'draft-content',
      projectId,
      document.id,
      targetId,
      'raw',
      selection?.branchId ?? '',
    ],
    queryFn: ({ signal }) =>
      mode === 'published'
        ? getVersionContent(projectId, document.id, targetId, 'raw', { signal })
        : getDraftContent(projectId, document.id, targetId, 'raw', { signal }),
    enabled: Boolean(targetId),
    placeholderData: undefined,
  })
  const content = contentQuery.isSuccess
    ? contentQuery.data?.content
    : undefined
  let fallback: ReactNode
  if (selection?.pending)
    fallback = (
      <p role='status' className='py-8 text-sm text-muted-foreground'>
        {t('admin.common.loading')}
      </p>
    )
  else if (invalid)
    fallback = (
      <p role='status' className='py-8 text-sm text-muted-foreground'>
        {t('admin.workspace.readerUnavailable')}
      </p>
    )
  else if (!targetId)
    fallback = (
      <div className='grid min-h-64 place-content-center justify-items-center gap-4 px-6 py-12 text-center'>
        <FileText aria-hidden className='size-9 text-muted-foreground' />
        <p className='max-w-md text-sm leading-6 text-muted-foreground'>
          {selection
            ? t(
                mode === 'published'
                  ? 'admin.workspace.noPublishedContent'
                  : 'admin.workspace.noDraftContent'
              )
            : t('admin.workspace.emptyContent')}
        </p>
        {canWrite && presentation !== 'page' && (
          <Button onClick={onEditDraft}>
            <SquarePen aria-hidden />
            {t('admin.workspace.editDraft')}
          </Button>
        )}
      </div>
    )
  else if (contentQuery.isError)
    fallback = (
      <Alert variant='destructive'>
        <AlertCircle aria-hidden />
        <AlertTitle>{t('admin.common.error')}</AlertTitle>
        <AlertDescription className='grid justify-items-start gap-3'>
          <p>{contentQuery.error.message}</p>
          <Button
            variant='outline'
            size='sm'
            onClick={() => void contentQuery.refetch()}
          >
            {t('admin.workspace.retry')}
          </Button>
        </AlertDescription>
      </Alert>
    )
  else if (contentQuery.isPending)
    fallback = (
      <p role='status' className='py-8 text-sm text-muted-foreground'>
        {t('admin.common.loading')}
      </p>
    )

  return (
    <section className='grid min-w-0 gap-4'>
      {presentation !== 'page' && (
        <div className='flex min-w-0 flex-wrap items-center justify-between gap-3 border-b pb-4'>
          <div className='flex min-w-0 flex-wrap items-center gap-3'>
            <Badge variant='secondary'>
              {t(
                mode === 'published'
                  ? 'admin.workspace.published'
                  : 'admin.workspace.draft'
              )}
            </Badge>
            {selection && (
              <>
                <span className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                  <GitBranch aria-hidden className='size-3.5' />
                  {selection.branchName ?? selection.branchId}
                </span>
                <span className='text-xs'>
                  {revision?.version_name || targetId}
                </span>
              </>
            )}
          </div>
          {canWrite && (
            <Button variant='outline' size='sm' onClick={onEditDraft}>
              <SquarePen aria-hidden />
              {t('admin.workspace.editDraft')}
            </Button>
          )}
        </div>
      )}
      <DocumentReader
        title={document.name}
        filePath={document.relative_path || document.file_name}
        documentType={document.document_type}
        content={fallback ? undefined : content}
        header={presentation === 'page'}
        variant={presentation === 'page' ? 'article' : 'panel'}
        renderContent={
          hasEndpointBrowser && targetId
            ? (body) => (
                <Tabs
                  value={activeOpenApiView}
                  onValueChange={(value) => {
                    setOpenApiView({ context: openApiContext, value })
                    if (value === 'source' && endpointId) onEndpointChange?.('')
                  }}
                  className='min-w-0 gap-4'
                >
                  <TabsList>
                    <TabsTrigger value='source'>
                      {t('admin.workspace.source')}
                    </TabsTrigger>
                    <TabsTrigger value='endpoints'>
                      {t('admin.sections.endpoints')}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value='source' className='min-w-0'>
                    {body}
                  </TabsContent>
                  <TabsContent value='endpoints' className='min-w-0'>
                    <Suspense
                      fallback={
                        <p role='status'>{t('admin.common.loading')}</p>
                      }
                    >
                      <DocumentWorkspaceEndpoints
                        projectId={projectId}
                        documentId={document.id}
                        versionId={targetId}
                        endpointId={endpointId}
                        onEndpointChange={(value) => onEndpointChange?.(value)}
                      />
                    </Suspense>
                  </TabsContent>
                </Tabs>
              )
            : undefined
        }
      >
        {fallback}
      </DocumentReader>
    </section>
  )
}
