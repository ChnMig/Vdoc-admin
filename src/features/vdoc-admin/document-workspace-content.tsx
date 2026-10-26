import { lazy, Suspense, useId, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  Code2,
  Eye,
  FileText,
  GitBranch,
  SquarePen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { OpenApiCodeViewer } from '@/features/public-share/openapi-code-viewer'
import { PlainTextDocumentViewer } from '@/features/public-share/plain-text-document-viewer'
import { DocumentTypeIcon } from './document-type-icon'
import { MarkdownPreview } from './markdown-preview'
import {
  DOCUMENT_TYPE_MARKDOWN,
  DOCUMENT_TYPE_OPENAPI,
  DOCUMENT_TYPE_TEXT,
} from './page-utils'

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
  const [view, setView] = useState<'preview' | 'source'>('preview')
  const viewContentId = useId()
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
  const showSource = !hasEndpointBrowser || activeOpenApiView === 'source'
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
        ? getVersionContent(projectId, document.id, targetId, 'raw', {
            signal,
          })
        : getDraftContent(projectId, document.id, targetId, 'raw', { signal }),
    enabled: Boolean(targetId) && showSource,
    placeholderData: undefined,
  })
  const content = contentQuery.isSuccess
    ? contentQuery.data?.content
    : undefined
  const canSwitchView = Boolean(
    targetId &&
    !selection?.pending &&
    !invalid &&
    contentQuery.isSuccess &&
    content
  )
  const viewControl = document.document_type === DOCUMENT_TYPE_MARKDOWN && (
    <div
      className='flex shrink-0 items-center gap-3 self-end @md:self-center'
      data-document-view-control
    >
      <span className='text-xs text-muted-foreground'>
        {t('admin.workspace.viewMode')}
      </span>
      <div className='flex items-center gap-2'>
        <span className='text-xs font-medium'>
          {t(`admin.workspace.${view}`)}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              variant='outline'
              size='icon'
              aria-label={t(
                view === 'preview'
                  ? 'admin.workspace.switchToSource'
                  : 'admin.workspace.switchToPreview'
              )}
              aria-controls={canSwitchView ? viewContentId : undefined}
              disabled={!canSwitchView}
              onClick={() =>
                setView((current) =>
                  current === 'preview' ? 'source' : 'preview'
                )
              }
            >
              {view === 'preview' ? <Eye aria-hidden /> : <Code2 aria-hidden />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t(
              view === 'preview'
                ? 'admin.workspace.switchToSource'
                : 'admin.workspace.switchToPreview'
            )}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
  const renderReader = (body: ReactNode) => (
    <>
      {presentation === 'page' && (
        <header
          aria-label={t('admin.workspace.documentDetails')}
          data-document-reading-header
          className='@container mb-6 grid min-w-0 gap-4 rounded-lg border bg-[var(--surface-control)] p-4 sm:p-5'
        >
          <h1 className='flex min-w-0 items-start gap-2.5 text-lg leading-7 font-semibold sm:text-xl'>
            <DocumentTypeIcon
              documentType={document.document_type}
              className='mt-1 size-5 text-muted-foreground'
            />
            <span className='min-w-0 break-words'>{document.name}</span>
          </h1>
          <div className='flex min-w-0 flex-col gap-x-5 gap-y-3 border-t pt-3 @md:flex-row @md:items-center @md:justify-between'>
            <dl className='grid min-w-0 flex-1 gap-1 text-xs leading-5'>
              <dt className='text-muted-foreground'>
                {t('admin.workspace.filePath')}
              </dt>
              <dd className='font-mono break-all'>
                {document.relative_path || document.file_name}
              </dd>
            </dl>
            {viewControl}
          </div>
        </header>
      )}
      {body}
    </>
  )
  if (selection?.pending)
    return renderReader(
      <p role='status' className='px-1 py-8 text-sm text-muted-foreground'>
        {t('admin.common.loading')}
      </p>
    )
  if (invalid)
    return renderReader(
      <p role='status' className='px-1 py-8 text-sm text-muted-foreground'>
        {t('admin.workspace.readerUnavailable')}
      </p>
    )
  if (!targetId)
    return renderReader(
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
  return renderReader(
    <section className='grid min-w-0 gap-4'>
      {presentation !== 'page' && (
        <div className='flex min-w-0 flex-wrap items-center justify-between gap-3 border-b pb-4'>
          <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2'>
            <Badge variant='secondary'>
              {mode === 'published'
                ? t('admin.workspace.published')
                : t('admin.workspace.draft')}
            </Badge>
            {selection ? (
              <dl className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
                <div className='flex min-w-0 items-center gap-1.5'>
                  <dt className='sr-only'>{t('admin.fields.branch')}</dt>
                  <GitBranch aria-hidden className='size-3.5 shrink-0' />
                  <dd
                    className='max-w-44 truncate font-mono'
                    title={selection.branchName ?? selection.branchId}
                  >
                    {selection.branchName ?? selection.branchId}
                  </dd>
                </div>
                <div className='min-w-0'>
                  <dt className='sr-only'>{t('admin.fields.versionName')}</dt>
                  <dd
                    className='max-w-56 truncate font-medium text-foreground'
                    title={revision?.version_name || targetId}
                  >
                    {revision?.version_name || targetId}
                  </dd>
                </div>
                {selection.mode === 'draft' &&
                  selection.draft &&
                  selection.draft.status !== 1 && (
                    <div>
                      <dt className='sr-only'>{t('admin.fields.status')}</dt>
                      <dd>{draftStateLabel(selection.draft.status, t)}</dd>
                    </div>
                  )}
              </dl>
            ) : (
              <p className='text-sm text-muted-foreground'>
                {mode === 'published'
                  ? t('admin.workspace.publishedContent')
                  : t('admin.workspace.draftContent')}
              </p>
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
      {showSource && contentQuery.isLoading && (
        <p role='status' className='py-8 text-sm text-muted-foreground'>
          {t('admin.common.loading')}
        </p>
      )}
      {showSource && contentQuery.isError && (
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
      )}
      {showSource && content === '' && (
        <p className='py-8 text-sm text-muted-foreground'>
          {t('admin.workspace.emptyRevision')}
        </p>
      )}
      {hasEndpointBrowser ? (
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
            {content !== undefined && content !== '' && (
              <div data-document-content className='min-w-0'>
                <OpenApiCodeViewer
                  content={content}
                  variant={presentation === 'page' ? 'article' : 'panel'}
                />
              </div>
            )}
          </TabsContent>
          <TabsContent value='endpoints' className='min-w-0'>
            <Suspense
              fallback={
                <p role='status' className='py-8 text-sm text-muted-foreground'>
                  {t('admin.common.loading')}
                </p>
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
      ) : (
        content !== undefined &&
        content !== '' && (
          <div data-document-content className='min-w-0'>
            {document.document_type === DOCUMENT_TYPE_MARKDOWN ? (
              <div className='grid min-w-0 gap-4'>
                {presentation !== 'page' && viewControl}
                <div
                  id={viewContentId}
                  className={cn(
                    'w-full min-w-0',
                    presentation === 'page' ? '' : 'mx-auto max-w-[75ch]'
                  )}
                >
                  {view === 'preview' ? (
                    <MarkdownPreview
                      content={content}
                      variant={presentation === 'page' ? 'article' : 'panel'}
                      documentTitle={document.name}
                    />
                  ) : (
                    <pre className='max-w-full overflow-auto rounded-md bg-[var(--surface-control)] p-4 font-mono text-xs leading-6'>
                      {content}
                    </pre>
                  )}
                </div>
              </div>
            ) : document.document_type === DOCUMENT_TYPE_TEXT ? (
              <PlainTextDocumentViewer
                content={content}
                variant={presentation === 'page' ? 'article' : 'panel'}
                className={cn(
                  'w-full',
                  presentation === 'page'
                    ? ''
                    : 'max-w-[75ch] border-0 bg-transparent px-0 py-2 shadow-none sm:p-0'
                )}
              />
            ) : (
              <OpenApiCodeViewer
                content={content}
                variant={presentation === 'page' ? 'article' : 'panel'}
              />
            )}
          </div>
        )
      )}
    </section>
  )
}

function draftStateLabel(
  status: number,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (status === 2) return t('admin.statuses.submitted')
  if (status === 3) return t('admin.statuses.changesRequested')
  if (status === 4) return t('admin.statuses.rejected')
  if (status === 5) return t('admin.statuses.published')
  return `${t('admin.common.unknown')} ${status}`
}
