import { useId, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import {
  getRepositoryCommit,
  getRepositoryContent,
  getRepositoryMergeContent,
  resolveRepositoryMerge,
  type RepositoryChange,
  type RepositoryFile,
  type RepositoryMergeRequest,
} from '@/lib/repository-api'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LoadingErrorState, NativeSelect } from './page-shared'

type Choice = {
  side: 'source' | 'target' | 'result' | 'delete'
  path?: string
  content?: string
}
const equal = (left?: RepositoryFile, right?: RepositoryFile) =>
  JSON.stringify(left ?? null) === JSON.stringify(right ?? null)

export function RepositoryMergeResolver({
  projectId,
  request,
  onResolved,
  onCancel,
}: {
  projectId: string
  request: RepositoryMergeRequest
  onResolved: (request: RepositoryMergeRequest) => Promise<unknown>
  onCancel: () => void
}) {
  const { language, t } = useLanguage()
  const zh = language === 'zh-CN'
  const id = useId()
  const session = useAuthStore((state) => state.auth.sessionVersion)
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const [message, setMessage] = useState('')
  const retry = useRef<{ body: string; key: string } | undefined>(undefined)
  const treeQuery = useQuery({
    queryKey: ['repository', projectId, 'resolution', request, zh],
    queryFn: async ({ signal }) => {
      const [base, source, target] = await Promise.all([
        getRepositoryCommit(projectId, request.base_commit_id, signal),
        getRepositoryCommit(projectId, request.source_commit_id, signal),
        getRepositoryCommit(projectId, request.target_commit_id, signal),
      ])
      const bodies = new Map<string, string>()
      const pending = [source, target].flatMap((commit) =>
        commit.files.map((file) => ({ commit, file }))
      )
      await Promise.all(
        Array.from({ length: Math.min(6, pending.length) }, async () => {
          while (pending.length) {
            const next = pending.pop()!
            const content = await getRepositoryContent(
              projectId,
              next.commit.id,
              next.file.document_id,
              signal
            )
            bodies.set(
              `${next.commit.id}:${next.file.document_id}`,
              content.content
            )
          }
        })
      )
      await Promise.all(
        (request.result_files ?? []).map(async (file) => {
          const content = await getRepositoryMergeContent(
            projectId,
            request.id,
            file.document_id,
            signal
          )
          if (content.generation !== request.generation)
            throw new Error(
              zh
                ? '审阅状态已变化，请刷新。'
                : 'The review state changed. Refresh and try again.'
            )
          bodies.set(`${request.id}:${file.document_id}`, content.content)
        })
      )
      return { base, source, target, bodies }
    },
    refetchOnWindowFocus: false,
  })
  const tree = treeQuery.data
  const ids = [
    ...new Set(
      [
        ...(tree?.source.files ?? []),
        ...(tree?.target.files ?? []),
        ...(tree?.base.files ?? []),
        ...(request.result_files ?? []),
      ].map((file) => file.document_id)
    ),
  ]
  const rows = ids.map((documentId) => {
    const source = tree?.source.files.find(
      (file) => file.document_id === documentId
    )
    const target = tree?.target.files.find(
      (file) => file.document_id === documentId
    )
    const base = tree?.base.files.find(
      (file) => file.document_id === documentId
    )
    const result = request.result_files?.find(
      (file) => file.document_id === documentId
    )
    const conflict = request.result_files
      ? request.conflicts.includes(documentId)
      : !equal(source, target) && !equal(base, source) && !equal(base, target)
    const automatic: Choice | undefined = conflict
      ? undefined
      : request.result_files
        ? { side: result ? 'result' : 'delete' }
        : { side: equal(base, source) ? 'target' : 'source' }
    const choice = choices[documentId] ?? automatic
    const file =
      choice?.side === 'source'
        ? source
        : choice?.side === 'target'
          ? target
          : choice?.side === 'result'
            ? result
            : undefined
    const commitId =
      choice?.side === 'source'
        ? request.source_commit_id
        : choice?.side === 'result'
          ? request.id
          : request.target_commit_id
    const content = file
      ? (choice?.content ?? tree?.bodies.get(`${commitId}:${documentId}`))
      : undefined
    const change: RepositoryChange | undefined =
      file && content !== undefined
        ? {
            document_id: file.document_id,
            name: file.name,
            document_type: file.document_type,
            description: file.description,
            operation: 'upsert',
            content,
            relative_path: choice?.path ?? file.relative_path,
          }
        : undefined
    return { documentId, source, target, conflict, choice, change }
  })
  const files = rows.flatMap((row) => (row.change ? [row.change] : []))
  const duplicatePaths =
    files.length !==
    new Set(files.map((file) => file.relative_path.toLocaleLowerCase())).size
  const unresolved = rows.some((row) => !row.choice)
  const mutation = useMutation({
    mutationFn: async () => {
      if (useAuthStore.getState().auth.sessionVersion !== session) return
      const body = JSON.stringify({ files, message })
      if (retry.current?.body !== body)
        retry.current = { body, key: crypto.randomUUID() }
      const result = await resolveRepositoryMerge(projectId, request, {
        files,
        message: message || undefined,
        idempotency_key: retry.current.key,
      })
      if (useAuthStore.getState().auth.sessionVersion === session) return result
    },
    onSuccess: async (result) => {
      if (result) await onResolved(result)
    },
  })
  const setChoice = (documentId: string, choice: Choice) =>
    setChoices((current) => ({ ...current, [documentId]: choice }))
  return (
    <section className='grid min-w-0 gap-4 border-y py-5'>
      <h2 className='text-lg font-semibold'>
        {zh ? '解决合并冲突' : 'Resolve merge conflicts'}
      </h2>
      <p className='max-w-prose text-sm leading-6 text-muted-foreground'>
        {zh
          ? '为冲突文件明确选择内容，并检查完整文件树。保存会生成新的提交和合并请求；需重新审阅后才能批准。'
          : 'Choose the content for each conflict and inspect the complete file tree. Saving creates a new commit and merge request, which must be reviewed before approval.'}
      </p>
      <p className='font-mono text-xs break-all text-muted-foreground'>
        {request.source_commit_id.slice(0, 12)} →{' '}
        {request.target_commit_id.slice(0, 12)}
      </p>
      <LoadingErrorState state={treeQuery} />
      {tree && (
        <form
          className='grid gap-4'
          onSubmit={(event) => {
            event.preventDefault()
            if (!unresolved && !duplicatePaths && !mutation.isPending)
              mutation.mutate()
          }}
        >
          <ul className='divide-y'>
            {rows.map((row) => (
              <li key={row.documentId} className='grid gap-3 py-4'>
                <div className='flex min-w-0 flex-wrap items-start justify-between gap-3'>
                  <p className='min-w-0 flex-1 font-mono text-sm break-all'>
                    {row.source?.relative_path ??
                      row.target?.relative_path ??
                      row.documentId}
                    {row.conflict && (
                      <span className='ms-2 font-sans text-xs text-destructive'>
                        {zh ? '需要选择' : 'Selection required'}
                      </span>
                    )}
                  </p>
                  <div className='w-full sm:w-56'>
                    <NativeSelect
                      label={zh ? '保留的内容' : 'Content to keep'}
                      placeholder={zh ? '选择解决方式' : 'Choose a resolution'}
                      value={row.choice?.side ?? ''}
                      disabled={mutation.isPending}
                      onChange={(side) =>
                        setChoice(row.documentId, {
                          side: side as Choice['side'],
                        })
                      }
                      options={[
                        ...(request.result_files?.some(
                          (file) => file.document_id === row.documentId
                        )
                          ? [
                              {
                                value: 'result',
                                label: zh
                                  ? '使用自动合并结果'
                                  : 'Use automatic merge',
                              },
                            ]
                          : []),
                        {
                          value: 'source',
                          label: row.source
                            ? zh
                              ? '使用来源文件'
                              : 'Use source file'
                            : zh
                              ? '来源已删除'
                              : 'Deleted in source',
                        },
                        {
                          value: 'target',
                          label: row.target
                            ? zh
                              ? '使用目标文件'
                              : 'Use target file'
                            : zh
                              ? '目标已删除'
                              : 'Deleted in target',
                        },
                        {
                          value: 'delete',
                          label: zh ? '删除此文件' : 'Delete this file',
                        },
                      ]}
                    />
                  </div>
                </div>
                {row.change && (
                  <details open={row.conflict || undefined}>
                    <summary className='cursor-pointer text-sm'>
                      {zh ? '检查或编辑' : 'Inspect or edit'}
                    </summary>
                    <div className='mt-3 grid gap-3'>
                      <Label htmlFor={`${id}-${row.documentId}-path`}>
                        {zh ? '文件路径' : 'File path'}
                      </Label>
                      <Input
                        id={`${id}-${row.documentId}-path`}
                        required
                        disabled={mutation.isPending}
                        value={row.change.relative_path}
                        onChange={(event) =>
                          setChoice(row.documentId, {
                            ...row.choice!,
                            path: event.target.value,
                          })
                        }
                      />
                      <Label htmlFor={`${id}-${row.documentId}-body`}>
                        {zh ? '正文' : 'Content'}
                      </Label>
                      <Textarea
                        id={`${id}-${row.documentId}-body`}
                        value={row.change.content}
                        disabled={mutation.isPending}
                        rows={8}
                        className='font-mono text-xs leading-5'
                        onChange={(event) =>
                          setChoice(row.documentId, {
                            ...row.choice!,
                            content: event.target.value,
                          })
                        }
                      />
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>
          {duplicatePaths && (
            <Alert variant='destructive'>
              <AlertDescription>
                {zh
                  ? '多个文件使用了相同路径，请修改路径或删除重复文件。'
                  : 'Several files use the same path. Rename or remove the duplicate files.'}
              </AlertDescription>
            </Alert>
          )}
          <Label htmlFor={`${id}-message`}>
            {zh ? '解决说明（可选）' : 'Resolution note (optional)'}
          </Label>
          <Input
            id={`${id}-message`}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={mutation.isPending}
          />
          <LoadingErrorState
            state={{
              isLoading: false,
              isError: mutation.isError,
              error: mutation.error,
            }}
          />
          <div className='flex flex-wrap gap-2'>
            <Button
              type='submit'
              disabled={unresolved || duplicatePaths || mutation.isPending}
            >
              {mutation.isPending
                ? t('admin.common.loading')
                : zh
                  ? '保存并创建新的合并请求'
                  : 'Save and create a new merge request'}
            </Button>
            <Button
              type='button'
              variant='outline'
              disabled={mutation.isPending}
              onClick={onCancel}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
