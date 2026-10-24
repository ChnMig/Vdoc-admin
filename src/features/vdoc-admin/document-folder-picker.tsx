import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Folder, FolderPlus } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import {
  createDocumentFolder,
  listDocumentFolders,
  type DocumentFolderDTO,
} from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function visibleDocumentFolders(
  folders: DocumentFolderDTO[],
  expanded: ReadonlySet<string>
) {
  const children = new Map<string, DocumentFolderDTO[]>()
  for (const folder of folders) {
    const parent = folder.parent_id || ''
    const siblings = children.get(parent) ?? []
    siblings.push(folder)
    children.set(parent, siblings)
  }
  for (const siblings of children.values())
    siblings.sort((a, b) => a.name.localeCompare(b.name))
  const result: {
    folder: DocumentFolderDTO
    depth: number
    hasChildren: boolean
  }[] = []
  const seen = new Set<string>()
  const pending = [...(children.get('') ?? [])]
    .reverse()
    .map((folder) => ({ folder, depth: 0 }))
  while (pending.length) {
    const item = pending.pop()!
    if (seen.has(item.folder.id)) continue
    seen.add(item.folder.id)
    const nested = children.get(item.folder.id) ?? []
    result.push({ ...item, hasChildren: nested.length > 0 })
    if (expanded.has(item.folder.id))
      for (const folder of [...nested].reverse())
        pending.push({ folder, depth: item.depth + 1 })
  }
  return result
}

type DocumentFolderPickerProps = {
  projectId: string
  value: string
  onChange: (folderId: string) => void
  initialPath?: string
  filename?: string
  disabled?: boolean
}

export function DocumentFolderPicker(props: DocumentFolderPickerProps) {
  const sessionVersion = useAuthStore((state) => state.auth.sessionVersion)
  return (
    <ScopedDocumentFolderPicker
      key={`${sessionVersion}:${props.projectId}`}
      {...props}
    />
  )
}

function ScopedDocumentFolderPicker({
  projectId,
  value,
  onChange,
  initialPath = '',
  filename,
  disabled = false,
}: DocumentFolderPickerProps) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const sessionVersion = useAuthStore((state) => state.auth.sessionVersion)
  const owner = `${sessionVersion}:${projectId}`
  const currentOwner = useRef(owner)
  const [expansion, setExpansion] = useState<Map<string, boolean>>(
    () => new Map()
  )
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [createError, setCreateError] = useState<string>()
  const nameId = useId()
  const hiddenInput = useRef<HTMLInputElement>(null)
  const [chosenLocation, setChosenLocation] = useState(
    !initialPath || Boolean(value)
  )
  const foldersQuery = useQuery({
    queryKey: ['document-folders', projectId, sessionVersion],
    queryFn: ({ signal }) => listDocumentFolders(projectId, { signal }),
    enabled: Boolean(projectId),
  })
  const folders = foldersQuery.data?.items ?? []
  const legacyFolder = !chosenLocation
    ? folders.find(
        (folder) => folder.path.toLowerCase() === initialPath.toLowerCase()
      )
    : undefined
  const selectedId = legacyFolder?.id ?? value
  const selected = folders.find((folder) => folder.id === selectedId)
  const missingSelection = Boolean(
    selectedId && foldersQuery.isSuccess && !selected
  )
  const unresolvedPath = Boolean(
    initialPath && !chosenLocation && !legacyFolder
  )
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const expanded = new Set<string>()
  const ancestors = new Set<string>()
  let ancestor = byId.get(selectedId)?.parent_id
  while (ancestor && !ancestors.has(ancestor)) {
    ancestors.add(ancestor)
    if (expansion.get(ancestor) !== false) expanded.add(ancestor)
    ancestor = byId.get(ancestor)?.parent_id
  }
  for (const [id, open] of expansion) if (open) expanded.add(id)
  const createMutation = useMutation({
    mutationFn: (request: {
      projectId: string
      parentId: string
      name: string
      owner: string
      sessionVersion: number
    }) =>
      createDocumentFolder(request.projectId, {
        name: request.name,
        parent_id: request.parentId || null,
      }),
    onSuccess: async (folder, request) => {
      await queryClient.invalidateQueries({
        queryKey: ['document-folders', request.projectId],
      })
      if (currentOwner.current !== request.owner) return
      queryClient.setQueryData(
        ['document-folders', request.projectId, request.sessionVersion],
        (
          previous: { items: DocumentFolderDTO[]; total: number } | undefined
        ) => {
          const items = [
            ...(previous?.items ?? []).filter((item) => item.id !== folder.id),
            folder,
          ]
          return { ...previous, items, total: items.length }
        }
      )
      setExpansion((previous) => new Map(previous).set(request.parentId, true))
      setChosenLocation(true)
      onChange(folder.id)
      hiddenInput.current?.dispatchEvent(new Event('input', { bubbles: true }))
      setName('')
      setCreating(false)
    },
  })
  useLayoutEffect(() => {
    currentOwner.current = owner
    return () => {
      currentOwner.current = ''
    }
  }, [owner])
  function choose(folderId: string) {
    setChosenLocation(true)
    onChange(folderId)
    hiddenInput.current?.dispatchEvent(new Event('input', { bubbles: true }))
    setCreateError(undefined)
  }
  return (
    <fieldset className='grid min-w-0 gap-2' disabled={disabled}>
      <legend className='mb-2 text-sm font-medium'>
        {t('admin.documentForm.folder')}
      </legend>
      <input
        ref={hiddenInput}
        type='hidden'
        name='folder_id'
        value={selectedId}
      />
      <input
        type='hidden'
        name='folder_valid'
        value={missingSelection || unresolvedPath ? 'false' : 'true'}
      />
      <input
        type='hidden'
        name='folder_path'
        value={selected?.path ?? (unresolvedPath ? initialPath : '')}
      />
      <div className='max-h-56 min-w-0 overflow-y-auto rounded-md border p-2'>
        <Button
          type='button'
          variant={selectedId === '' && !unresolvedPath ? 'secondary' : 'ghost'}
          className='h-auto min-h-9 w-full justify-start whitespace-normal'
          aria-pressed={selectedId === '' && !unresolvedPath}
          onClick={() => choose('')}
        >
          <Folder className='size-4 shrink-0' />
          {t('admin.documentForm.rootFolder')}
        </Button>
        {foldersQuery.isPending && (
          <p role='status' className='p-2 text-sm text-muted-foreground'>
            {t('admin.documentForm.folderLoading')}
          </p>
        )}
        {foldersQuery.isError && (
          <div role='alert' className='grid gap-2 p-2 text-sm text-destructive'>
            <span>{foldersQuery.error.message}</span>
            <Button
              type='button'
              size='sm'
              variant='outline'
              className='w-fit'
              onClick={() => void foldersQuery.refetch()}
            >
              {t('errors.retry')}
            </Button>
          </div>
        )}
        <ul
          aria-label={t('admin.documentForm.folder')}
          className='grid min-w-0 gap-0.5'
        >
          {visibleDocumentFolders(folders, expanded).map(
            ({ folder, depth, hasChildren }) => (
              <li
                key={folder.id}
                className='flex min-w-0 items-center gap-1'
                style={{ paddingInlineStart: `${Math.min(depth, 8) * 12}px` }}
              >
                {hasChildren ? (
                  <Button
                    type='button'
                    size='icon'
                    variant='ghost'
                    className='size-8 shrink-0'
                    aria-label={t(
                      expanded.has(folder.id)
                        ? 'admin.documentForm.collapseFolder'
                        : 'admin.documentForm.expandFolder',
                      { name: folder.name }
                    )}
                    aria-expanded={expanded.has(folder.id)}
                    onClick={() =>
                      setExpansion((previous) =>
                        new Map(previous).set(
                          folder.id,
                          !expanded.has(folder.id)
                        )
                      )
                    }
                  >
                    {expanded.has(folder.id) ? (
                      <ChevronDown className='size-4' />
                    ) : (
                      <ChevronRight className='size-4' />
                    )}
                  </Button>
                ) : (
                  <span className='size-8 shrink-0' />
                )}
                <Button
                  type='button'
                  variant={selectedId === folder.id ? 'secondary' : 'ghost'}
                  aria-pressed={selectedId === folder.id}
                  className={cn(
                    'h-auto min-h-9 min-w-0 flex-1 justify-start text-start whitespace-normal'
                  )}
                  title={folder.path}
                  onClick={() => choose(folder.id)}
                >
                  <Folder className='size-4 shrink-0' />
                  <span className='min-w-0 break-all'>{folder.name}</span>
                </Button>
              </li>
            )
          )}
        </ul>
      </div>
      {(missingSelection || (unresolvedPath && foldersQuery.isSuccess)) && (
        <p role='alert' className='text-sm text-destructive'>
          {t('admin.documentForm.folderUnavailable')}
        </p>
      )}
      <p className='text-xs [overflow-wrap:anywhere] text-muted-foreground'>
        {t('admin.documentForm.selectedFolder', {
          path:
            selected?.path ??
            (unresolvedPath ? initialPath : t('admin.documentForm.rootFolder')),
        })}
      </p>
      {filename && (
        <div className='grid min-w-0 gap-1 text-xs'>
          <span className='text-muted-foreground'>
            {t('admin.documentForm.location')}
          </span>
          <code className='break-all'>
            {[selected?.path ?? (unresolvedPath ? initialPath : ''), filename]
              .filter(Boolean)
              .join('/')}
          </code>
        </div>
      )}
      <p className='text-xs text-muted-foreground'>
        {t('admin.documentForm.folderHint')}
      </p>
      {!creating ? (
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='w-fit'
          disabled={missingSelection || unresolvedPath}
          onClick={() => {
            setCreateError(undefined)
            setCreating(true)
          }}
        >
          <FolderPlus className='size-4' />
          {t('admin.documentForm.newFolder')}
        </Button>
      ) : (
        <div className='grid min-w-0 gap-2 rounded-md border bg-muted/20 p-3'>
          <Label htmlFor={nameId}>{t('admin.documentForm.folderName')}</Label>
          <Input
            id={nameId}
            value={name}
            disabled={createMutation.isPending}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.parentElement
                  ?.querySelector<HTMLButtonElement>('[data-create-folder]')
                  ?.click()
              }
            }}
          />
          <div className='flex flex-wrap gap-2'>
            <Button
              data-create-folder
              type='button'
              size='sm'
              disabled={!name.trim() || createMutation.isPending}
              onClick={async () => {
                setCreateError(undefined)
                try {
                  await createMutation.mutateAsync({
                    projectId,
                    parentId: selectedId,
                    name: name.trim(),
                    owner,
                    sessionVersion,
                  })
                } catch (error) {
                  if (currentOwner.current === owner)
                    setCreateError(
                      error instanceof Error
                        ? error.message
                        : t('toasts.somethingWrong')
                    )
                }
              }}
            >
              {t('admin.documentForm.createFolder')}
            </Button>
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={createMutation.isPending}
              onClick={() => {
                setCreating(false)
                setName('')
                setCreateError(undefined)
              }}
            >
              {t('common.cancel')}
            </Button>
          </div>
          {createError && (
            <p role='alert' className='text-sm text-destructive'>
              {createError}
            </p>
          )}
        </div>
      )}
    </fieldset>
  )
}
