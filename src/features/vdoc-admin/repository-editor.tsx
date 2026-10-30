import { useId, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { FilePlus2, Save, Trash2, Upload } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { readUtf8File } from '@/lib/read-utf8-file'
import {
  createRepositoryBranch,
  saveRepositoryCommit,
  type RepositoryBranch,
  type RepositoryChange,
  type RepositoryCommit,
  type RepositoryContent,
  type RepositoryFile,
  type RepositorySave,
} from '@/lib/repository-api'
import type { DocumentDTO } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { documentTypeFromFilename } from './document-form-fields'
import {
  ConfirmActionButton,
  FormDialog,
  LoadingErrorState,
  TextField,
} from './page-shared'
import { useRepositoryCopy } from './repository-copy'

export type RepositoryEdit = {
  baseCommitId: string
  generation: number
  content: string
  name: string
  path: string
  description: string
  message: string
  extras: RepositoryChange[]
  dirty: boolean
}

export function RepositoryEditor({
  projectId,
  branch,
  document,
  files,
  content,
  contentPending,
  initialEdit,
  baseCommitId,
  canWrite,
  onEdit,
  onSaved,
  onBranchCreated,
}: {
  projectId: string
  branch: RepositoryBranch
  document?: DocumentDTO
  files: RepositoryFile[]
  content?: RepositoryContent
  contentPending: boolean
  initialEdit?: RepositoryEdit
  baseCommitId: string
  canWrite: boolean
  canManage: boolean
  onEdit: (edit: RepositoryEdit) => void
  onSaved: (commit: RepositoryCommit, branchId: string) => Promise<void>
  onBranchCreated: (branch: RepositoryBranch) => void
}) {
  const copy = useRepositoryCopy()
  const { t } = useLanguage()
  const inputId = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const session = useAuthStore((state) => state.auth.sessionVersion)
  const [edit, setEdit] = useState<RepositoryEdit>(
    () =>
      initialEdit ?? {
        baseCommitId,
        generation: branch.generation,
        content: content?.content ?? '',
        name: content?.document.name ?? document?.name ?? '',
        path:
          content?.document.relative_path ??
          document?.relative_path ??
          document?.file_name ??
          '',
        description:
          content?.document.description ?? document?.description ?? '',
        message: '',
        extras: [],
        dirty: false,
      }
  )
  const [uploadError, setUploadError] = useState<Error>()
  const retry = useRef<{ body: string; key: string } | undefined>(undefined)
  const [uploadPending, setUploadPending] = useState(false)
  const write = (patch: Partial<RepositoryEdit>) => {
    const next = { ...edit, ...patch, dirty: true }
    setEdit(next)
    onEdit(next)
  }
  const request = (
    operation: 'upsert' | 'delete' = 'upsert'
  ): RepositorySave => {
    const selected: RepositoryChange[] = document
      ? [
          {
            operation,
            document_id: document.id,
            relative_path: edit.path,
            name: edit.name,
            description: edit.description,
            document_type: document.document_type,
            content: edit.content,
          },
        ]
      : []
    const changes = [...selected, ...edit.extras]
    const body = JSON.stringify({
      expected_head_commit_id: edit.baseCommitId,
      expected_generation: edit.generation,
      message: edit.message,
      changes,
    })
    if (retry.current?.body !== body)
      retry.current = { body, key: crypto.randomUUID() }
    return {
      ...JSON.parse(body),
      idempotency_key: retry.current.key,
    } as RepositorySave
  }
  const saveMutation = useMutation({
    mutationFn: async (input: {
      branch: RepositoryBranch
      payload: RepositorySave
    }) => {
      if (useAuthStore.getState().auth.sessionVersion !== session) return
      const result = await saveRepositoryCommit(
        projectId,
        input.branch.id,
        input.payload
      )
      if (useAuthStore.getState().auth.sessionVersion !== session) return
      return result
    },
    onSuccess: async (saved, input) => {
      if (saved) await onSaved(saved, input.branch.id)
    },
  })
  const branchingMutation = useMutation({
    mutationFn: (name: string) =>
      createRepositoryBranch(projectId, {
        name,
        from_commit_id: edit.baseCommitId,
      }),
  })
  const changedHead =
    edit.baseCommitId !== branch.head_commit_id ||
    edit.generation !== branch.generation
  const blocked =
    !canWrite ||
    branch.is_protected ||
    contentPending ||
    saveMutation.isPending ||
    uploadPending
  const hasChanges = edit.dirty || edit.extras.length > 0
  const importFiles = async (uploads: FileList | null) => {
    if (!uploads) return
    setUploadPending(true)
    setUploadError(undefined)
    try {
      const additions: RepositoryChange[] = []
      let selectedContent: string | undefined
      for (const upload of Array.from(uploads)) {
        const type = documentTypeFromFilename(upload.name)
        if (!type)
          throw new Error(t('admin.documentForm.uploadInvalidExtension'))
        const existing = files.find(
          (item) => item.relative_path === upload.name
        )
        if (existing?.document_id === document?.id) {
          selectedContent = await readUtf8File(upload, t)
          continue
        }
        additions.push({
          operation: 'upsert',
          document_id: existing?.document_id ?? '',
          relative_path: upload.name,
          name: existing?.name ?? upload.name,
          document_type: type,
          content: await readUtf8File(upload, t),
        })
      }
      const paths = new Set(additions.map((item) => item.relative_path))
      if (useAuthStore.getState().auth.sessionVersion !== session) return
      write({
        ...(selectedContent === undefined ? {} : { content: selectedContent }),
        extras: [
          ...edit.extras.filter((item) => !paths.has(item.relative_path)),
          ...additions,
        ],
      })
    } catch (error) {
      setUploadError(error instanceof Error ? error : new Error(String(error)))
    } finally {
      setUploadPending(false)
    }
    if (fileInput.current) fileInput.current.value = ''
  }
  return (
    <div className='grid min-w-0 gap-5'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='text-xl font-semibold'>
            {document?.name ?? copy.changedFiles}
          </h1>
          <p className='mt-1 text-xs text-muted-foreground'>{copy.generated}</p>
        </div>
        <span
          className='font-mono text-xs text-muted-foreground'
          title={edit.baseCommitId}
        >
          {copy.selectedBase}: {edit.baseCommitId.slice(0, 12)}
        </span>
      </div>
      {contentPending && <p role='status'>{t('admin.common.loading')}</p>}
      {branch.is_protected && (
        <Alert>
          <AlertDescription className='grid gap-3'>
            <p>{copy.protectedDescription}</p>
            {canWrite && (
              <FormDialog
                title={copy.newBranch}
                triggerLabel={copy.editBranch}
                submitLabel={copy.newBranch}
                pending={branchingMutation.isPending}
                submissionScope={`${projectId}:${branch.id}:${edit.baseCommitId}`}
                triggerVariant='outline'
                onSubmit={async (data) => {
                  const created = await branchingMutation.mutateAsync(
                    String(data.get('name') ?? '').trim()
                  )
                  if (useAuthStore.getState().auth.sessionVersion === session)
                    onBranchCreated(created)
                }}
              >
                <TextField name='name' label={copy.branchName} required />
              </FormDialog>
            )}
          </AlertDescription>
        </Alert>
      )}
      {(changedHead || saveMutation.isError) && (
        <Alert variant='destructive'>
          <AlertDescription>{copy.conflict}</AlertDescription>
        </Alert>
      )}
      <LoadingErrorState
        state={{
          isLoading: false,
          isError: saveMutation.isError,
          error: saveMutation.error,
        }}
      />
      <LoadingErrorState
        state={{
          isLoading: false,
          isError: branchingMutation.isError,
          error: branchingMutation.error,
        }}
      />
      {uploadError && (
        <p role='alert' className='text-sm text-destructive'>
          {uploadError.message}
        </p>
      )}
      <form
        className='grid min-w-0 gap-4'
        onSubmit={(event) => {
          // A form in a portalled branch dialog still bubbles through React's
          // tree. It must never also submit the editor on the original branch.
          if (event.target !== event.currentTarget) return
          event.preventDefault()
          if (!blocked && hasChanges)
            saveMutation.mutate({ branch, payload: request() })
        }}
      >
        {document && (
          <>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='grid gap-2'>
                <Label htmlFor={`${inputId}-name`}>
                  {t('admin.fields.name')}
                </Label>
                <Input
                  id={`${inputId}-name`}
                  value={edit.name}
                  disabled={blocked}
                  required
                  onChange={(event) => write({ name: event.target.value })}
                />
              </div>
              <div className='grid gap-2'>
                <Label htmlFor={`${inputId}-path`}>
                  {t('admin.workspace.filePath')}
                </Label>
                <Input
                  id={`${inputId}-path`}
                  value={edit.path}
                  disabled={blocked}
                  required
                  onChange={(event) => write({ path: event.target.value })}
                  className='font-mono text-xs'
                />
              </div>
            </div>
            <div className='grid gap-2'>
              <Label htmlFor={`${inputId}-content`}>{copy.content}</Label>
              <Textarea
                id={`${inputId}-content`}
                value={edit.content}
                disabled={blocked}
                onChange={(event) => {
                  const original =
                    content?.content ?? initialEdit?.content ?? ''
                  const crlf =
                    original.includes('\r\n') && !/(^|[^\r])\n/.test(original)
                  write({
                    content: crlf
                      ? event.target.value.replace(/\r?\n/g, '\r\n')
                      : event.target.value,
                  })
                }}
                className='min-h-80 resize-y font-mono text-sm leading-6'
                spellCheck={false}
              />
            </div>
          </>
        )}
        <input
          ref={fileInput}
          type='file'
          className='sr-only'
          multiple
          accept='.md,.txt,.yaml,.yml,.json'
          onChange={(event) => void importFiles(event.target.files)}
          disabled={blocked}
          tabIndex={-1}
          aria-label={t('admin.draftEditor.chooseFile')}
        />
        <div className='flex flex-wrap items-center gap-2'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={blocked}
            onClick={() => fileInput.current?.click()}
          >
            <Upload aria-hidden className='size-4' />
            {copy.addFile}
          </Button>
          <span className='text-xs text-muted-foreground'>
            {copy.changedFiles}: {(document ? 1 : 0) + edit.extras.length}
          </span>
        </div>
        {edit.extras.length > 0 && (
          <ul className='divide-y border-y'>
            {edit.extras.map((extra, index) => (
              <li
                key={`${extra.relative_path}:${index}`}
                className='flex items-center gap-2 py-2 text-sm'
              >
                <FilePlus2 aria-hidden className='size-4 shrink-0' />
                <span className='min-w-0 flex-1 truncate font-mono text-xs'>
                  {extra.relative_path}
                </span>
                <Button
                  type='button'
                  size='icon'
                  variant='ghost'
                  disabled={blocked}
                  aria-label={`${copy.discard}: ${extra.relative_path}`}
                  onClick={() =>
                    write({ extras: edit.extras.filter((_, i) => i !== index) })
                  }
                >
                  <Trash2 aria-hidden className='size-4' />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className='grid gap-2'>
          <Label htmlFor={`${inputId}-message`}>{copy.message}</Label>
          <Input
            id={`${inputId}-message`}
            value={edit.message}
            disabled={blocked}
            onChange={(event) => write({ message: event.target.value })}
          />
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button type='submit' disabled={blocked || !hasChanges}>
            <Save aria-hidden className='size-4' />
            {saveMutation.isPending ? copy.saving : copy.save}
          </Button>
          {document &&
            files.some((file) => file.document_id === document.id) && (
              <ConfirmActionButton
                label={copy.deleteFile}
                title={copy.deleteFile}
                description={copy.deleteConfirm}
                disabled={blocked}
                onConfirm={async () => {
                  await saveMutation.mutateAsync({
                    branch,
                    payload: request('delete'),
                  })
                }}
              />
            )}
          {hasChanges && (
            <ConfirmActionButton
              label={copy.discard}
              title={copy.discard}
              description={copy.switchWarning}
              onConfirm={async () => {
                const next = {
                  baseCommitId: branch.head_commit_id,
                  generation: branch.generation,
                  content: content?.content ?? '',
                  name: content?.document.name ?? document?.name ?? '',
                  path:
                    content?.document.relative_path ??
                    document?.relative_path ??
                    '',
                  description: content?.document.description ?? '',
                  message: '',
                  extras: [],
                  dirty: false,
                }
                setEdit(next)
                onEdit(next)
                retry.current = undefined
              }}
            />
          )}
          {canWrite && (changedHead || saveMutation.isError) && (
            <FormDialog
              title={copy.newBranch}
              triggerLabel={copy.preserveBranch}
              submitLabel={copy.save}
              pending={branchingMutation.isPending || saveMutation.isPending}
              submissionScope={`${projectId}:${branch.id}:${edit.baseCommitId}`}
              triggerVariant='outline'
              onSubmit={async (data) => {
                const created = await branchingMutation.mutateAsync(
                  String(data.get('name') ?? '').trim()
                )
                if (useAuthStore.getState().auth.sessionVersion !== session)
                  return
                const payload = request()
                payload.expected_generation = created.generation
                payload.expected_head_commit_id = created.head_commit_id
                payload.idempotency_key = crypto.randomUUID()
                await saveMutation.mutateAsync({ branch: created, payload })
              }}
            >
              <TextField name='name' label={copy.branchName} required />
            </FormDialog>
          )}
        </div>
      </form>
    </div>
  )
}
