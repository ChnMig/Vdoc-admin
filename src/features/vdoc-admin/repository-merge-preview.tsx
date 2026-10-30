import { lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getRepositoryCommit,
  getRepositoryContent,
  getRepositoryMergeContent,
  type RepositoryMergeRequest,
} from '@/lib/repository-api'
import { useLanguage } from '@/context/language-provider'
import { DocumentReader } from '@/features/document-reader/document-reader'
import { LoadingErrorState } from './page-shared'

const SourceDiffViewer = lazy(() => import('./source-diff-viewer'))

export function RepositoryMergePreview({
  projectId,
  request,
}: {
  projectId: string
  request: RepositoryMergeRequest
}) {
  const { language, t } = useLanguage()
  const zh = language === 'zh-CN'
  const query = useQuery({
    queryKey: ['repository', projectId, 'merge-preview', request, zh],
    queryFn: async ({ signal }) => {
      if (!request.result_files)
        throw new Error(
          zh
            ? '此合并请求没有可审阅的候选快照，请重新创建。'
            : 'This merge request has no reviewable candidate snapshot. Create a new request.'
        )
      const target = await getRepositoryCommit(
        projectId,
        request.target_commit_id,
        signal
      )
      const ids = [
        ...new Set(
          [...request.result_files, ...target.files].map(
            (file) => file.document_id
          )
        ),
      ]
      return Promise.all(
        ids.map(async (documentId) => {
          const beforeFile = target.files.find(
            (file) => file.document_id === documentId
          )
          const afterFile = request.result_files!.find(
            (file) => file.document_id === documentId
          )
          const [before, after] = await Promise.all([
            beforeFile
              ? getRepositoryContent(
                  projectId,
                  request.target_commit_id,
                  documentId,
                  signal
                ).then((value) => value.content)
              : Promise.resolve(''),
            afterFile
              ? getRepositoryMergeContent(
                  projectId,
                  request.id,
                  documentId,
                  signal
                ).then((value) => {
                  if (value.generation !== request.generation)
                    throw new Error(
                      zh
                        ? '审阅状态已变化，请刷新。'
                        : 'The review state changed. Refresh and try again.'
                    )
                  return value.content
                })
              : Promise.resolve(''),
          ])
          return { documentId, beforeFile, afterFile, before, after }
        })
      )
    },
    refetchOnWindowFocus: false,
  })
  const rows =
    query.data?.filter(
      (row) =>
        JSON.stringify(row.beforeFile) !== JSON.stringify(row.afterFile) ||
        row.before !== row.after
    ) ?? []
  return (
    <section className='grid min-w-0 gap-5 border-y py-5'>
      <div>
        <h2 className='text-lg font-semibold'>
          {zh ? '合并候选结果' : 'Merge candidate'}
        </h2>
        <p className='mt-2 max-w-prose text-sm leading-6 text-muted-foreground'>
          {zh
            ? '下面是目标分支到实际候选文件树的改动，包含自动合并结果。此快照固定于本次合并请求。'
            : 'Changes from the target branch to the actual candidate tree, including automatic merges. This snapshot is fixed to this merge request.'}
        </p>
      </div>
      <dl className='grid gap-2 text-xs break-all sm:grid-cols-3'>
        <div>
          <dt>{zh ? '来源提交' : 'Source commit'}</dt>
          <dd className='mt-1 font-mono text-muted-foreground'>
            {request.source_commit_id}
          </dd>
        </div>
        <div>
          <dt>{zh ? '目标提交' : 'Target commit'}</dt>
          <dd className='mt-1 font-mono text-muted-foreground'>
            {request.target_commit_id}
          </dd>
        </div>
        <div>
          <dt>{zh ? '候选标识' : 'Candidate identity'}</dt>
          <dd className='mt-1 font-mono text-muted-foreground'>
            {request.id}:{request.generation}
          </dd>
        </div>
      </dl>
      <LoadingErrorState state={query} />
      {query.isSuccess && !rows.length && (
        <p className='text-sm text-muted-foreground'>
          {zh ? '候选结果没有改动。' : 'The candidate has no changes.'}
        </p>
      )}
      {rows.map((row) => (
        <section key={row.documentId} className='grid min-w-0 gap-3'>
          <h3 className='font-mono text-sm break-all'>
            {row.beforeFile?.relative_path &&
            row.beforeFile.relative_path !== row.afterFile?.relative_path
              ? `${row.beforeFile.relative_path} → `
              : ''}
            {row.afterFile?.relative_path ?? (zh ? '已删除' : 'Deleted')}
          </h3>
          <Suspense fallback={<p role='status'>{t('admin.common.loading')}</p>}>
            <SourceDiffViewer
              before={row.before}
              after={row.after}
              fromLabel={request.target_commit_id.slice(0, 12)}
              toLabel={`${zh ? '候选' : 'Candidate'} ${request.id.slice(0, 8)}`}
              fileName={
                row.afterFile?.relative_path ?? row.beforeFile?.relative_path
              }
            />
          </Suspense>
          {row.afterFile && (
            <details>
              <summary className='cursor-pointer text-sm'>
                {zh ? '阅读候选正文' : 'Read candidate content'}
              </summary>
              <div className='mt-4'>
                <DocumentReader
                  title={row.afterFile.name}
                  filePath={row.afterFile.relative_path}
                  documentType={row.afterFile.document_type}
                  content={row.after}
                />
              </div>
            </details>
          )}
        </section>
      ))}
    </section>
  )
}
