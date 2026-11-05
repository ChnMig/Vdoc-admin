import { useRef, useState, type ReactNode } from 'react'
import {
  Ellipsis,
  FilePlus2,
  FolderInput,
  FolderPlus,
  Pencil,
  Trash2,
} from 'lucide-react'
import type { ResourcePathScope } from '@/lib/resource-location'
import type { DocumentDTO, DocumentFolderDTO } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CopyPathMenuItem } from './copy-path-action'
import { DocumentActions, type DocumentAction } from './document-actions'
import { useDocumentActionsCopy } from './document-actions-copy'
import {
  DocumentFolderActions,
  type DocumentFolderAction,
} from './document-folder-actions'
import { DocumentFormFields } from './document-form-fields'
import { FormCard, TextField } from './page-shared'

export type DocumentHeaderMenuOptions = {
  tools?: ReactNode
  onCloseAutoFocus?: (event: Event) => void
}

type Props = DocumentHeaderMenuOptions & {
  projectId: string
  resourcePath?: string
  resourceDocumentId?: string
  pathScope?: ResourcePathScope
  document?: DocumentDTO
  folder?: DocumentFolderDTO
  folders: readonly DocumentFolderDTO[]
  nonempty: boolean
  canManage: boolean
  disabled: boolean
  submissionScope: string
  isCurrent: () => boolean
  onDocumentChanged: (document: DocumentDTO | null) => void
  onFolderChanged: (folder: DocumentFolderDTO | null) => void
  onCreateDocument: (values: FormData) => Promise<unknown>
  onCreateFolder: (values: FormData) => Promise<unknown>
  documentPending: boolean
  folderPending: boolean
}

export function DocumentReaderActions({
  projectId,
  resourcePath,
  resourceDocumentId,
  pathScope,
  document,
  folder,
  folders,
  nonempty,
  canManage,
  disabled,
  submissionScope,
  isCurrent,
  onDocumentChanged,
  onFolderChanged,
  onCreateDocument,
  onCreateFolder,
  documentPending,
  folderPending,
  tools,
  onCloseAutoFocus,
}: Props) {
  const { t, language } = useLanguage()
  const copy = useDocumentActionsCopy()
  const localTrigger = useRef<HTMLButtonElement>(null)
  const triggerRef = localTrigger
  const openingDialog = useRef(false)
  const [creation, setCreation] = useState<'document' | 'folder' | null>(null)
  const [documentAction, setDocumentAction] = useState<DocumentAction | null>(
    null
  )
  const [folderAction, setFolderAction] = useState<DocumentFolderAction | null>(
    null
  )
  const pending = documentPending || folderPending
  const restoreFocus = (event: Event) => {
    if (triggerRef.current?.isConnected) {
      event.preventDefault()
      triggerRef.current.focus()
    }
  }
  const start = (callback: () => void) => {
    openingDialog.current = true
    callback()
  }
  if (!canManage && !tools && resourcePath === undefined) return null
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type='button'
            ref={triggerRef}
            variant='ghost'
            size='icon'
            className='size-9'
            aria-label={t('admin.workspace.moreActions')}
            disabled={pending}
          >
            <Ellipsis aria-hidden className='size-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='end'
          className='w-64 max-w-[calc(100vw-2rem)]'
          onCloseAutoFocus={(event) => {
            if (openingDialog.current) event.preventDefault()
            else onCloseAutoFocus?.(event)
            openingDialog.current = false
          }}
        >
          {resourcePath !== undefined && (
            <>
              <CopyPathMenuItem
                path={resourcePath}
                scope={{ ...pathScope, projectId }}
                documentId={resourceDocumentId ?? document?.id}
              />
              {(canManage || tools) && <DropdownMenuSeparator />}
            </>
          )}
          {canManage && (
            <>
              <DropdownMenuLabel
                className='truncate text-xs font-normal text-muted-foreground'
                title={folder?.path}
              >
                {folder?.path ?? t('admin.workspace.rootFolder')}
              </DropdownMenuLabel>
              <DropdownMenuItem
                disabled={disabled}
                onSelect={() => start(() => setCreation('document'))}
              >
                <FilePlus2 aria-hidden />
                {t('admin.workspace.newDocument')}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={disabled}
                onSelect={() => start(() => setCreation('folder'))}
              >
                <FolderPlus aria-hidden />
                {t('admin.workspace.newFolder')}
              </DropdownMenuItem>
              {document && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel
                    className='truncate text-xs font-normal text-muted-foreground'
                    title={document.name}
                  >
                    {document.name}
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    disabled={disabled}
                    onSelect={() => start(() => setDocumentAction('rename'))}
                  >
                    <Pencil aria-hidden />
                    {copy.rename}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={disabled}
                    onSelect={() => start(() => setDocumentAction('move'))}
                  >
                    <FolderInput aria-hidden />
                    {copy.move}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={disabled}
                    className='text-destructive focus:text-destructive'
                    onSelect={() => start(() => setDocumentAction('delete'))}
                  >
                    <Trash2 aria-hidden />
                    {copy.delete}
                  </DropdownMenuItem>
                </>
              )}
              {folder && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger disabled={disabled}>
                      {t('admin.workspace.folderActions')}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuLabel
                        className='max-w-64 truncate text-xs font-normal text-muted-foreground'
                        title={folder.path}
                      >
                        {folder.name}
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onSelect={() => start(() => setFolderAction('rename'))}
                      >
                        <Pencil aria-hidden />
                        {t('admin.workspace.renameFolder')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => start(() => setFolderAction('move'))}
                      >
                        <FolderInput aria-hidden />
                        {t('admin.workspace.moveFolder')}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={nonempty}
                        className='text-destructive focus:text-destructive'
                        onSelect={() => start(() => setFolderAction('delete'))}
                      >
                        <Trash2 aria-hidden />
                        {t('admin.workspace.deleteFolder')}
                      </DropdownMenuItem>
                      {nonempty && (
                        <DropdownMenuLabel className='max-w-64 text-xs leading-5 font-normal text-muted-foreground'>
                          {t('admin.workspace.emptyFoldersOnly')}
                        </DropdownMenuLabel>
                      )}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}
            </>
          )}
          {tools && (
            <>
              {canManage && <DropdownMenuSeparator />}
              {tools}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={creation !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setCreation(null)
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          onCloseAutoFocus={restoreFocus}
          className='max-h-[calc(100dvh-2rem)] overflow-y-auto'
          showCloseButton={!pending}
        >
          <DialogHeader className='text-start'>
            <DialogTitle>
              {t(
                creation === 'document'
                  ? 'admin.workspace.newDocument'
                  : 'admin.workspace.newFolder'
              )}
            </DialogTitle>
          </DialogHeader>
          <FormCard
            key={creation}
            title={t(
              creation === 'document'
                ? 'admin.workspace.newDocument'
                : 'admin.workspace.newFolder'
            )}
            presentation='dialog'
            pending={pending}
            disabled={disabled || !canManage}
            submissionScope={submissionScope}
            submitLabel={t(
              creation === 'document'
                ? 'admin.common.create'
                : 'admin.workspace.createFolder'
            )}
            onSubmit={
              creation === 'document' ? onCreateDocument : onCreateFolder
            }
            onSuccess={() => setCreation(null)}
            onCancel={() => setCreation(null)}
          >
            {creation === 'document' ? (
              <>
                <DocumentFormFields
                  projectId={projectId}
                  repositoryDirectory={folder?.path ?? ''}
                />
                <TextField
                  name='new_branch_name'
                  defaultValue='main'
                  label={language === 'zh-CN' ? '初始分支' : 'Initial branch'}
                  description={
                    language === 'zh-CN'
                      ? '仅属于这篇文档。版本号将按分支名自动递增，例如 main.1、main.2。'
                      : 'Belongs to this document only. Versions increase automatically, for example main.1, main.2.'
                  }
                />
              </>
            ) : (
              <>
                <p className='text-sm break-all text-muted-foreground'>
                  {folder?.path ?? t('admin.workspace.rootFolder')}
                </p>
                <TextField
                  label={t('admin.workspace.folderName')}
                  name='name'
                  required
                />
              </>
            )}
          </FormCard>
        </DialogContent>
      </Dialog>
      {canManage && document && (
        <DocumentActions
          projectId={projectId}
          document={document}
          folders={folders}
          disabled={disabled}
          submissionScope={submissionScope}
          isCurrent={isCurrent}
          onChanged={onDocumentChanged}
          action={documentAction}
          onActionChange={setDocumentAction}
          hideTrigger
          focusRef={triggerRef}
        />
      )}
      {canManage && folder && (
        <DocumentFolderActions
          projectId={projectId}
          folder={folder}
          folders={folders}
          nonempty={nonempty}
          disabled={disabled}
          submissionScope={submissionScope}
          isCurrent={isCurrent}
          onChanged={onFolderChanged}
          action={folderAction}
          onActionChange={setFolderAction}
          hideTrigger
          focusRef={triggerRef}
        />
      )}
    </>
  )
}
