import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ellipsis, FolderInput, Pencil, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import {
  deleteRepositoryDocument,
  updateRepositoryDocumentMetadata,
  type DocumentMetadataUpdate,
} from '@/lib/document-management-api'
import { repositoryKeys, type RepositoryDocument } from '@/lib/repository-api'
import type { ResourcePathScope } from '@/lib/resource-location'
import type { DocumentDTO, DocumentFolderDTO } from '@/lib/vdoc-api'
import { queryAffectedByChange } from '@/lib/vdoc-query-invalidation'
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CopyPathMenuItem } from './copy-path-action'
import { useDocumentActionsCopy } from './document-actions-copy'
import { FolderDestinationTree } from './folder-destination-tree'
import { FormCard, TextField } from './page-shared'
import { fieldValue } from './page-utils'

export type DocumentAction = 'rename' | 'move' | 'delete'
type Props = {
  projectId: string
  pathScope?: ResourcePathScope
  document: DocumentDTO
  folders: readonly DocumentFolderDTO[]
  disabled?: boolean
  submissionScope: string
  isCurrent: () => boolean
  onChanged?: (document: DocumentDTO | null) => void
  action?: DocumentAction | null
  onActionChange?: (action: DocumentAction | null) => void
  hideTrigger?: boolean
  focusRef?: RefObject<HTMLButtonElement | null>
}

export function DocumentActions(props: Props) {
  const session = useAuthStore((state) => state.auth.sessionVersion)
  return (
    <ScopedDocumentActions
      key={`${session}:${props.submissionScope}:${props.document.id}`}
      {...props}
      session={session}
    />
  )
}

function ScopedDocumentActions({
  projectId,
  pathScope,
  document,
  folders,
  disabled,
  submissionScope,
  isCurrent,
  onChanged,
  session,
  action: requestedAction,
  onActionChange,
  hideTrigger,
  focusRef,
}: Props & { session: number }) {
  const { t } = useLanguage()
  const copy = useDocumentActionsCopy()
  const client = useQueryClient()
  const [localAction, setLocalAction] = useState<DocumentAction | null>(null)
  const action = requestedAction === undefined ? localAction : requestedAction
  const setAction = onActionChange ?? setLocalAction
  const [deleteError, setDeleteError] = useState<Error | null>(null)
  const lockedRef = useRef(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const openingDialog = useRef(false)
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
    mutationFn: async (change: DocumentMetadataUpdate | 'delete') => {
      if (!ownsRequest()) throw new Error(copy.unavailable)
      if (change === 'delete') {
        await deleteRepositoryDocument(projectId, document.id)
        return null
      }
      return updateRepositoryDocumentMetadata(projectId, document.id, change)
    },
    onSuccess: async (updated) => {
      if (useAuthStore.getState().auth.sessionVersion !== session) return
      if (ownsRequest()) {
        if (!updated) setAction(null)
        current.current?.onChanged?.(updated)
      }
      client.setQueryData<RepositoryDocument[]>(
        repositoryKeys.documents(projectId),
        (items) =>
          items?.flatMap((item) =>
            item.id === document.id ? (updated ? [updated] : []) : [item]
          )
      )
      client.setQueriesData<{ items: DocumentDTO[]; total: number }>(
        { queryKey: ['documents', projectId] },
        (previous) => {
          if (!previous?.items?.some((item) => item.id === document.id))
            return previous
          return {
            ...previous,
            items: previous.items.flatMap((item) =>
              item.id === document.id ? (updated ? [updated] : []) : [item]
            ),
            total: updated ? previous.total : Math.max(0, previous.total - 1),
          }
        }
      )
      if (!updated) {
        const documentQueries = {
          predicate: ({ queryKey }: { queryKey: readonly unknown[] }) => {
            if (queryKey[0] === 'repository')
              return (
                queryKey[1] === projectId &&
                queryKey[2] === 'document' &&
                queryKey[3] === document.id
              )
            // Catalogs and audit logs span documents; remove only owned data.
            return (
              queryKey[0] !== 'documents' &&
              queryKey[0] !== 'audit-logs' &&
              queryAffectedByChange(queryKey, {
                kind: 'document',
                projectId,
                documentId: document.id,
              })
            )
          },
        }
        await client.cancelQueries(documentQueries)
        client.removeQueries(documentQueries)
      }
      await Promise.all([
        client.invalidateQueries({
          queryKey: repositoryKeys.documents(projectId),
        }),
        client.invalidateQueries({ queryKey: ['document-folders', projectId] }),
        client.invalidateQueries({ queryKey: ['documents', projectId] }),
      ])
    },
  })
  const locked = disabled || mutation.isPending
  const path = document.relative_path ?? document.file_name ?? ''
  const filename = path.split('/').pop() ?? ''
  const parent = path.split('/').slice(0, -1).join('/')
  const submit = async (values: FormData) => {
    if (action === 'rename') {
      const nextFilename = fieldValue(values, 'filename')
      if (
        !nextFilename ||
        /[/\\]/.test(nextFilename) ||
        nextFilename === '.' ||
        nextFilename === '..'
      )
        throw new Error(copy.invalidFilename)
      return mutation.mutateAsync({
        name: fieldValue(values, 'name'),
        relative_path: parent ? `${parent}/${nextFilename}` : nextFilename,
      })
    }
    const value = fieldValue(values, 'parent_path')
    const destination =
      value === 'project-root' ? '' : value.slice('folder:'.length)
    return mutation.mutateAsync({
      relative_path: destination ? `${destination}/${filename}` : filename,
    })
  }
  const changeOpen = (open: boolean) => {
    if (!open && !mutation.isPending) {
      setAction(null)
      setDeleteError(null)
    }
  }
  const openAction = (next: DocumentAction) => {
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
              aria-label={`${copy.actions}: ${document.name}`}
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
              path={path || undefined}
              scope={{ ...pathScope, projectId }}
              documentId={document.id}
            />
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => openAction('rename')}>
              <Pencil aria-hidden />
              {copy.rename}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openAction('move')}>
              <FolderInput aria-hidden />
              {copy.move}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className='text-destructive focus:text-destructive'
              onSelect={() => openAction('delete')}
            >
              <Trash2 aria-hidden />
              {copy.delete}
            </DropdownMenuItem>
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
              {action === 'rename' ? copy.rename : copy.move}
            </DialogTitle>
            <DialogDescription>
              {action === 'rename'
                ? copy.renameDescription
                : copy.moveDescription}
            </DialogDescription>
          </DialogHeader>
          <FormCard
            key={action}
            title={action === 'rename' ? copy.rename : copy.move}
            presentation='dialog'
            pending={mutation.isPending}
            disabled={disabled}
            submissionScope={submissionScope}
            submitLabel={
              action === 'rename' ? t('admin.common.save') : copy.move
            }
            onSubmit={submit}
            onSuccess={() => setAction(null)}
            onCancel={() => setAction(null)}
          >
            <p className='text-sm break-all text-muted-foreground'>{path}</p>
            {action === 'rename' ? (
              <>
                <TextField
                  name='name'
                  label={copy.name}
                  defaultValue={document.name}
                  required
                />
                <TextField
                  name='filename'
                  label={copy.filename}
                  defaultValue={filename}
                  required
                />
              </>
            ) : (
              <FolderDestinationTree
                folders={folders}
                defaultPath={parent}
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
        title={`${copy.delete}: ${document.name}`}
        desc={copy.deleteDescription}
        confirmText={copy.delete}
        destructive
        isLoading={mutation.isPending}
        disabled={disabled}
        handleConfirm={() => {
          if (lockedRef.current || locked) return
          lockedRef.current = true
          setDeleteError(null)
          void mutation
            .mutateAsync('delete')
            .catch((error: unknown) => {
              if (ownsRequest())
                setDeleteError(
                  error instanceof Error
                    ? error
                    : new Error(t('toasts.somethingWrong'))
                )
            })
            .finally(() => {
              lockedRef.current = false
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
