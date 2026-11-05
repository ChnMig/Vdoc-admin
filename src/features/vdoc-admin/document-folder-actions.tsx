import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ellipsis, FolderInput, Pencil, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { repositoryKeys } from '@/lib/repository-api'
import type { ResourcePathScope } from '@/lib/resource-location'
import {
  deleteDocumentFolder,
  updateDocumentFolderLocation,
  type DocumentFolderDTO,
} from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CopyPathMenuItem } from './copy-path-action'
import { FolderDestinationTree } from './folder-destination-tree'
import { FormCard, TextField } from './page-shared'
import { fieldValue } from './page-utils'

type FolderChange =
  { name: string } | { parent_path: string } | { delete: true }
export type DocumentFolderAction = 'rename' | 'move' | 'delete'
type Props = {
  projectId: string
  pathScope?: ResourcePathScope
  folder: DocumentFolderDTO
  folders: readonly DocumentFolderDTO[]
  nonempty: boolean
  disabled?: boolean
  submissionScope: string
  isCurrent: () => boolean
  onChanged?: (folder: DocumentFolderDTO | null) => void
  action?: DocumentFolderAction | null
  onActionChange?: (action: DocumentFolderAction | null) => void
  hideTrigger?: boolean
  focusRef?: RefObject<HTMLButtonElement | null>
}

export function DocumentFolderActions(props: Props) {
  const session = useAuthStore((state) => state.auth.sessionVersion)
  return (
    <ScopedDocumentFolderActions
      key={`${session}:${props.submissionScope}:${props.folder.path}`}
      {...props}
      session={session}
    />
  )
}

function ScopedDocumentFolderActions({
  projectId,
  pathScope,
  folder,
  folders,
  nonempty,
  disabled,
  submissionScope,
  isCurrent,
  onChanged,
  action: requestedAction,
  onActionChange,
  hideTrigger,
  focusRef,
  session,
}: Props & { session: number }) {
  const { t } = useLanguage()
  const client = useQueryClient()
  const [localAction, setLocalAction] = useState<DocumentFolderAction | null>(
    null
  )
  const action = requestedAction === undefined ? localAction : requestedAction
  const setAction = onActionChange ?? setLocalAction
  const [deleteError, setDeleteError] = useState<Error | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const openingDialog = useRef(false)
  const deleteLocked = useRef(false)
  const current = useRef<Pick<
    Props,
    'submissionScope' | 'isCurrent' | 'onChanged'
  > | null>(null)
  useLayoutEffect(() => {
    current.current = { submissionScope, isCurrent, onChanged }
    return () => {
      current.current = null
    }
  }, [submissionScope, isCurrent, onChanged])
  const ownsRequest = () =>
    current.current?.submissionScope === submissionScope &&
    current.current.isCurrent() &&
    useAuthStore.getState().auth.sessionVersion === session
  const mutation = useMutation({
    mutationFn: async (change: FolderChange) => {
      if (!ownsRequest()) throw new Error(t('toasts.somethingWrong'))
      if ('delete' in change) {
        await deleteDocumentFolder(projectId, folder.path)
        return null
      }
      return updateDocumentFolderLocation(projectId, {
        path: folder.path,
        ...change,
      })
    },
    onSuccess: async (result) => {
      if (useAuthStore.getState().auth.sessionVersion !== session) return
      if (ownsRequest()) {
        if (result === null) setAction(null)
        current.current?.onChanged?.(result)
      }
      await Promise.all([
        client.invalidateQueries({ queryKey: ['document-folders', projectId] }),
        client.invalidateQueries({ queryKey: ['documents', projectId] }),
        client.invalidateQueries({
          queryKey: repositoryKeys.documents(projectId),
        }),
      ])
    },
  })
  const locked = disabled || mutation.isPending
  const parent = folder.path.split('/').slice(0, -1).join('/')
  const changeOpen = (open: boolean) => {
    if (!open && !mutation.isPending) {
      setAction(null)
      setDeleteError(null)
    }
  }
  const openAction = (next: DocumentFolderAction) => {
    openingDialog.current = true
    setDeleteError(null)
    setAction(next)
  }
  const restoreFocus = (event: Event) => {
    const trigger = focusRef?.current ?? triggerRef.current
    if (trigger?.isConnected) {
      event.preventDefault()
      trigger.focus()
    }
  }
  return (
    <>
      {!hideTrigger && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              ref={triggerRef}
              type='button'
              variant='ghost'
              size='icon'
              className='size-9 shrink-0'
              disabled={locked}
              aria-label={`${t('admin.workspace.folderActions')}: ${folder.name}`}
            >
              <Ellipsis aria-hidden className='size-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align='end'
            onCloseAutoFocus={(event) => {
              if (openingDialog.current) event.preventDefault()
              openingDialog.current = false
            }}
          >
            <CopyPathMenuItem
              path={folder.path}
              scope={{ ...pathScope, projectId }}
            />
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => openAction('rename')}>
              <Pencil aria-hidden />
              {t('admin.workspace.renameFolder')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openAction('move')}>
              <FolderInput aria-hidden />
              {t('admin.workspace.moveFolder')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className='text-destructive focus:text-destructive'
              disabled={nonempty}
              onSelect={() => openAction('delete')}
            >
              <Trash2 aria-hidden />
              {t('admin.workspace.deleteFolder')}
            </DropdownMenuItem>
            {nonempty && (
              <DropdownMenuLabel className='max-w-64 text-xs leading-5 font-normal text-muted-foreground'>
                {t('admin.workspace.emptyFoldersOnly')}
              </DropdownMenuLabel>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Dialog
        open={action === 'rename' || action === 'move'}
        onOpenChange={changeOpen}
      >
        <DialogContent
          onCloseAutoFocus={restoreFocus}
          className='max-h-[calc(100dvh-2rem)] overflow-y-auto'
          showCloseButton={!mutation.isPending}
        >
          <DialogHeader className='text-start'>
            <DialogTitle>
              {t(
                action === 'rename'
                  ? 'admin.workspace.renameFolder'
                  : 'admin.workspace.moveFolder'
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                action === 'rename'
                  ? 'admin.workspace.renameFolderDescription'
                  : 'admin.workspace.moveFolderDescription'
              )}
            </DialogDescription>
          </DialogHeader>
          <FormCard
            key={action}
            title={t(
              action === 'rename'
                ? 'admin.workspace.renameFolder'
                : 'admin.workspace.moveFolder'
            )}
            presentation='dialog'
            pending={mutation.isPending}
            disabled={disabled}
            submissionScope={submissionScope}
            submitLabel={t(
              action === 'rename'
                ? 'admin.common.save'
                : 'admin.workspace.moveFolder'
            )}
            onCancel={() => changeOpen(false)}
            onSuccess={() => setAction(null)}
            onSubmit={(values) => {
              if (action === 'rename')
                return mutation.mutateAsync({
                  name: fieldValue(values, 'name'),
                })
              const value = fieldValue(values, 'parent_path')
              const path =
                value === 'project-root' ? '' : value.slice('folder:'.length)
              const source = folder.path.toLocaleLowerCase()
              if (
                path.toLocaleLowerCase() === source ||
                path.toLocaleLowerCase().startsWith(`${source}/`)
              )
                throw new Error(t('admin.workspace.invalidFolderDestination'))
              return mutation.mutateAsync({ parent_path: path })
            }}
          >
            <p className='text-sm break-all text-muted-foreground'>
              {folder.path}
            </p>
            {action === 'rename' ? (
              <TextField
                name='name'
                label={t('admin.workspace.folderName')}
                defaultValue={folder.name}
                required
              />
            ) : (
              <FolderDestinationTree
                folders={folders}
                defaultPath={parent}
                sourcePath={folder.path}
                disabled={locked}
              />
            )}
          </FormCard>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        onCloseAutoFocus={restoreFocus}
        open={action === 'delete'}
        onOpenChange={changeOpen}
        title={t('admin.workspace.deleteFolderTitle', { name: folder.name })}
        desc={t('admin.workspace.deleteFolderDescription')}
        confirmText={t('admin.workspace.deleteFolder')}
        destructive
        isLoading={mutation.isPending}
        disabled={disabled || nonempty}
        handleConfirm={() => {
          if (deleteLocked.current || locked || nonempty) return
          deleteLocked.current = true
          setDeleteError(null)
          void mutation
            .mutateAsync({ delete: true })
            .catch((error: unknown) => {
              if (ownsRequest())
                setDeleteError(
                  error instanceof Error
                    ? error
                    : new Error(t('toasts.somethingWrong'))
                )
            })
            .finally(() => {
              deleteLocked.current = false
            })
        }}
      >
        {deleteError && (
          <Alert variant='destructive' aria-live='polite'>
            <AlertDescription>{deleteError.message}</AlertDescription>
          </Alert>
        )}
      </ConfirmDialog>
    </>
  )
}
