import { useLayoutEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentDTO, DocumentFolderDTO } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Input } from '@/components/ui/input'
import {
  documentTreeRows,
  documentWorkflowState,
} from './document-workspace-model'

export function DocumentFileTree({
  folders,
  documents,
  documentId,
  folderId,
  onDocumentSelect,
  onFolderSelect,
}: {
  folders: readonly DocumentFolderDTO[]
  documents: readonly DocumentDTO[]
  documentId?: string
  folderId: string
  onDocumentSelect: (document: DocumentDTO) => void
  onFolderSelect: (folderId: string) => void
}) {
  const { t } = useLanguage()
  const navigationRef = useRef<HTMLElement>(null)
  const [search, setSearch] = useState('')
  const [expansionOverrides, setExpansionOverrides] = useState<
    Map<string, boolean>
  >(() => new Map())
  const visibleExpanded = new Set<string>()
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  let ancestor = documentId ? folderId : (byId.get(folderId)?.parent_id ?? '')
  const seen = new Set<string>()
  while (ancestor && !seen.has(ancestor)) {
    seen.add(ancestor)
    visibleExpanded.add(ancestor)
    ancestor = byId.get(ancestor)?.parent_id ?? ''
  }
  for (const [id, expanded] of expansionOverrides) {
    if (expanded) visibleExpanded.add(id)
    else visibleExpanded.delete(id)
  }
  const rows = documentTreeRows(folders, documents, visibleExpanded, search)
  useLayoutEffect(() => {
    const navigation = navigationRef.current
    const selected = navigation?.querySelector<HTMLElement>('[aria-current]')
    if (!navigation || !selected) return
    const viewport = navigation.getBoundingClientRect()
    const item = selected.getBoundingClientRect()
    if (item.top < viewport.top) navigation.scrollTop += item.top - viewport.top
    else if (item.bottom > viewport.bottom)
      navigation.scrollTop += item.bottom - viewport.bottom
  }, [documentId, folderId, search, expansionOverrides, folders])
  return (
    <div className='grid min-h-0 min-w-0 flex-1 grid-rows-[auto_minmax(0,1fr)] content-start gap-3'>
      <div className='relative px-3'>
        <Search
          aria-hidden
          className='pointer-events-none absolute start-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground'
        />
        <Input
          aria-label={t('admin.workspace.searchFiles')}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          placeholder={t('admin.workspace.searchFiles')}
          className='h-9 ps-9'
        />
      </div>
      <nav
        ref={navigationRef}
        aria-label={t('admin.workspace.files')}
        className='min-w-0 overflow-auto px-2 pb-4'
      >
        <button
          type='button'
          aria-current={!folderId && !documentId ? 'location' : undefined}
          className={cn(
            'mb-1 flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-start text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring',
            !folderId && !documentId && 'bg-accent font-medium'
          )}
          onClick={() => onFolderSelect('')}
        >
          <FolderOpen
            aria-hidden
            className='size-4 shrink-0 text-muted-foreground'
          />
          <span className='truncate'>{t('admin.workspace.rootFolder')}</span>
        </button>
        <ul className='min-w-0'>
          {rows.map((row) =>
            row.kind === 'folder' ? (
              <li
                key={`folder:${row.folder.id}`}
                className='flex min-w-0 items-center'
                style={{
                  paddingInlineStart: `${Math.min(row.depth, 6) * 0.875}rem`,
                }}
              >
                <button
                  type='button'
                  aria-label={t(
                    visibleExpanded.has(row.folder.id)
                      ? 'admin.documentForm.collapseFolder'
                      : 'admin.documentForm.expandFolder',
                    { name: row.folder.name }
                  )}
                  aria-expanded={
                    Boolean(search) || visibleExpanded.has(row.folder.id)
                  }
                  onClick={() =>
                    setExpansionOverrides((previous) => {
                      const next = new Map(previous)
                      next.set(
                        row.folder.id,
                        !visibleExpanded.has(row.folder.id)
                      )
                      return next
                    })
                  }
                  className='flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring'
                >
                  {search || visibleExpanded.has(row.folder.id) ? (
                    <ChevronDown aria-hidden className='size-3.5' />
                  ) : (
                    <ChevronRight aria-hidden className='size-3.5' />
                  )}
                </button>
                <button
                  type='button'
                  onClick={() => onFolderSelect(row.folder.id)}
                  aria-current={
                    folderId === row.folder.id && !documentId
                      ? 'location'
                      : undefined
                  }
                  className={cn(
                    'flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-start text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring',
                    folderId === row.folder.id &&
                      !documentId &&
                      'bg-accent font-medium'
                  )}
                >
                  <Folder
                    aria-hidden
                    className='size-4 shrink-0 text-muted-foreground'
                  />
                  <span className='truncate' title={row.folder.path}>
                    {row.folder.name}
                  </span>
                </button>
              </li>
            ) : (
              <li
                key={`document:${row.document.id}`}
                style={{
                  paddingInlineStart: `${Math.min(row.depth, 6) * 0.875}rem`,
                }}
              >
                <button
                  type='button'
                  aria-current={
                    row.document.id === documentId ? 'page' : undefined
                  }
                  onClick={() => onDocumentSelect(row.document)}
                  title={row.document.relative_path ?? row.document.name}
                  className={cn(
                    'flex min-h-11 w-full min-w-0 items-center gap-2 rounded-md py-1.5 ps-7 pe-2 text-start hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring',
                    row.document.id === documentId &&
                      'bg-primary/10 text-primary'
                  )}
                >
                  <FileText
                    aria-hidden
                    className='size-4 shrink-0 text-muted-foreground'
                  />
                  <span className='grid min-w-0 flex-1 gap-0.5'>
                    <span className='truncate text-sm font-medium'>
                      {row.document.file_name ??
                        row.document.relative_path?.split('/').pop() ??
                        row.document.name}
                    </span>
                    <span className='truncate text-xs text-muted-foreground'>
                      {row.document.name}
                    </span>
                  </span>
                  <span className='shrink-0 text-[11px] text-muted-foreground'>
                    {t(
                      `admin.workspace.${documentWorkflowState(row.document)}`
                    )}
                    {row.document.has_draft &&
                    documentWorkflowState(row.document) === 'published' ? (
                      <span
                        className='ms-1 inline-block size-1.5 rounded-full bg-[var(--status-review)]'
                        role='img'
                        aria-label={t('admin.workspace.hasDraft')}
                      />
                    ) : null}
                  </span>
                </button>
              </li>
            )
          )}
        </ul>
        {rows.length === 0 && (
          <p className='px-2 py-5 text-sm leading-6 text-muted-foreground'>
            {search ? t('search.empty') : t('admin.workspace.noFiles')}
          </p>
        )}
      </nav>
    </div>
  )
}
