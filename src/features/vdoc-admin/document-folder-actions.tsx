import { useLayoutEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { repositoryKeys } from '@/lib/repository-api'
import {
  deleteDocumentFolder,
  updateDocumentFolderLocation,
  type DocumentFolderDTO,
} from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import {
  ConfirmActionButton,
  FormDialog,
  NativeSelect,
  TextField,
} from './page-shared'
import { fieldValue } from './page-utils'

type FolderChange =
  { name: string } | { parent_path: string } | { delete: true }

export function DocumentFolderActions({
  projectId,
  folder,
  folders,
  nonempty,
  disabled,
  submissionScope,
  isCurrent,
  onChanged,
}: {
  projectId: string
  folder: DocumentFolderDTO
  folders: readonly DocumentFolderDTO[]
  nonempty: boolean
  disabled?: boolean
  submissionScope: string
  isCurrent: () => boolean
  onChanged: (folder: DocumentFolderDTO | null) => void
}) {
  const { t } = useLanguage()
  const client = useQueryClient()
  const current = useRef({ submissionScope, isCurrent, onChanged })
  useLayoutEffect(() => {
    current.current = { submissionScope, isCurrent, onChanged }
  })
  const sessionVersion = useAuthStore((state) => state.auth.sessionVersion)
  const mutation = useMutation({
    mutationFn: async (request: {
      projectId: string
      change: FolderChange
      path: string
      owner: string
      session: number
    }) => {
      if (
        current.current.submissionScope !== request.owner ||
        !current.current.isCurrent() ||
        useAuthStore.getState().auth.sessionVersion !== request.session
      )
        return undefined
      if ('delete' in request.change) {
        await deleteDocumentFolder(request.projectId, request.path)
        return null
      }
      return updateDocumentFolderLocation(request.projectId, {
        path: request.path,
        ...request.change,
      })
    },
    onSuccess: async (result, request) => {
      if (
        result === undefined ||
        useAuthStore.getState().auth.sessionVersion !== request.session
      )
        return
      if (
        current.current.submissionScope === request.owner &&
        current.current.isCurrent()
      )
        current.current.onChanged(result)
      await Promise.all([
        client.invalidateQueries({
          queryKey: ['document-folders', request.projectId],
        }),
        client.invalidateQueries({
          queryKey: ['documents', request.projectId],
        }),
        client.invalidateQueries({
          queryKey: repositoryKeys.documents(request.projectId),
        }),
      ])
    },
  })
  const submit = (change: FolderChange) =>
    mutation.mutateAsync({
      projectId,
      change,
      path: folder.path,
      owner: submissionScope,
      session: sessionVersion,
    })
  const locked = disabled || mutation.isPending
  const parent = folder.path.split('/').slice(0, -1).join('/')
  const source = folder.path.toLocaleLowerCase()
  const destinations = folders.filter((candidate) => {
    const path = candidate.path.toLocaleLowerCase()
    return path !== source && !path.startsWith(`${source}/`)
  })
  return (
    <div
      role='group'
      aria-label={t('admin.workspace.folderActions')}
      className='flex flex-wrap items-center gap-2'
    >
      <FormDialog
        title={t('admin.workspace.renameFolder')}
        description={t('admin.workspace.renameFolderDescription')}
        submitLabel={t('admin.common.save')}
        triggerVariant='outline'
        triggerSize='sm'
        pending={mutation.isPending}
        disabled={locked}
        submissionScope={submissionScope}
        onSubmit={(values) => submit({ name: fieldValue(values, 'name') })}
      >
        <p className='text-sm break-all text-muted-foreground'>{folder.path}</p>
        <TextField
          name='name'
          label={t('admin.workspace.folderName')}
          defaultValue={folder.name}
          required
        />
      </FormDialog>
      <FormDialog
        title={t('admin.workspace.moveFolder')}
        description={t('admin.workspace.moveFolderDescription')}
        submitLabel={t('admin.workspace.moveFolder')}
        triggerVariant='outline'
        triggerSize='sm'
        pending={mutation.isPending}
        disabled={locked}
        submissionScope={submissionScope}
        onSubmit={(values) => {
          const target = fieldValue(values, 'parent_path')
          return submit({
            parent_path:
              target === 'project-root' ? '' : target.slice('folder:'.length),
          })
        }}
      >
        <p className='text-sm break-all text-muted-foreground'>{folder.path}</p>
        <NativeSelect
          name='parent_path'
          label={t('admin.workspace.destinationFolder')}
          defaultValue={parent ? `folder:${parent}` : 'project-root'}
          placeholder={t('admin.workspace.destinationFolder')}
          options={[
            { value: 'project-root', label: t('admin.workspace.rootFolder') },
            ...destinations.map((item) => ({
              value: `folder:${item.path}`,
              label: item.path,
            })),
          ]}
          required
        />
      </FormDialog>
      <ConfirmActionButton
        key={submissionScope}
        label={t('admin.workspace.deleteFolder')}
        title={t('admin.workspace.deleteFolderTitle', { name: folder.name })}
        description={t('admin.workspace.deleteFolderDescription')}
        disabled={locked || nonempty}
        pending={mutation.isPending}
        onConfirm={() => submit({ delete: true })}
      />
      <p className='w-full text-xs leading-5 text-muted-foreground'>
        {t('admin.workspace.emptyFoldersOnly')}
      </p>
    </div>
  )
}
