import { useLayoutEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderRoot,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentDTO, DocumentFolderDTO } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Input } from '@/components/ui/input'
import { DocumentTypeIcon } from './document-type-icon'
import {
  documentTreeRows,
  documentWorkflowState,
} from './document-workspace-model'
import {
  DOCUMENT_TYPE_MARKDOWN,
  DOCUMENT_TYPE_OPENAPI,
  DOCUMENT_TYPE_TEXT,
} from './page-utils'

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
  const searchQuery = search.trim().toLocaleLowerCase()
  const [searchExpansion, setSearchExpansion] = useState<{
    query: string
    collapsed: Set<string>
  }>(() => ({ query: '', collapsed: new Set() }))
  const searchCollapsed =
    searchExpansion.query === searchQuery
      ? searchExpansion.collapsed
      : new Set<string>()
  const visibleExpanded = new Set<string>()
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const selectedDocument = documents.find(
    (document) => document.id === documentId
  )
  const selectedDocumentPath = selectedDocument?.relative_path
    ?.split('/')
    .slice(0, -1)
    .join('/')
  const selectedDocumentFolderId =
    selectedDocument?.folder_id ||
    folders.find(
      (folder) =>
        folder.path.toLocaleLowerCase() ===
        selectedDocumentPath?.toLocaleLowerCase()
    )?.id ||
    ''
  let ancestor = documentId
    ? selectedDocumentFolderId
    : (byId.get(folderId)?.parent_id ?? '')
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
  const matchingRows = documentTreeRows(
    folders,
    documents,
    visibleExpanded,
    searchQuery
  )
  let hiddenBelowDepth: number | undefined
  const rows = searchQuery
    ? matchingRows.filter((row) => {
        if (hiddenBelowDepth !== undefined && row.depth > hiddenBelowDepth)
          return false
        hiddenBelowDepth =
          row.kind === 'folder' && searchCollapsed.has(row.folder.id)
            ? row.depth
            : undefined
        return true
      })
    : matchingRows
  const folderIsExpanded = (id: string) =>
    searchQuery ? !searchCollapsed.has(id) : visibleExpanded.has(id)
  const setFolderExpanded = (id: string, expanded: boolean) => {
    if (searchQuery) {
      setSearchExpansion((previous) => {
        const collapsed = new Set(
          previous.query === searchQuery ? previous.collapsed : []
        )
        if (expanded) collapsed.delete(id)
        else collapsed.add(id)
        return { query: searchQuery, collapsed }
      })
    } else {
      setExpansionOverrides((previous) => new Map(previous).set(id, expanded))
    }
  }
  const scrollSelection = documentId
    ? `document:${documentId}`
    : `folder:${folderId}`
  useLayoutEffect(() => {
    const navigation = navigationRef.current
    const selected = navigation?.querySelector<HTMLElement>('[aria-current]')
    if (!navigation || !selected) return
    const viewport = navigation.getBoundingClientRect()
    const item = selected.getBoundingClientRect()
    if (item.top < viewport.top) navigation.scrollTop += item.top - viewport.top
    else if (item.bottom > viewport.bottom)
      navigation.scrollTop += item.bottom - viewport.bottom
  }, [scrollSelection, folders])
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
          onChange={(event) => {
            const nextSearch = event.currentTarget.value
            const nextQuery = nextSearch.trim().toLocaleLowerCase()
            setSearch(nextSearch)
            if (nextQuery !== searchQuery)
              setSearchExpansion({ query: nextQuery, collapsed: new Set() })
          }}
          placeholder={t('admin.workspace.searchFiles')}
          className='h-8 border-transparent bg-muted/60 ps-9 text-sm shadow-none hover:border-input focus-visible:border-input'
        />
      </div>
      <nav
        ref={navigationRef}
        aria-label={t('admin.workspace.files')}
        className='min-h-0 min-w-0 overflow-x-hidden overflow-y-auto px-2 pb-4'
        onKeyDown={(event) => {
          if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
            return
          if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key))
            return
          const target = event.target
          if (!(target instanceof HTMLElement)) return
          const current = target.closest('button')
          const buttons = [
            ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
              'button:not(:disabled)'
            ),
          ]
          const index = buttons.findIndex((button) => button === current)
          if (index < 0) return
          const nextIndex =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : Math.max(
                    0,
                    Math.min(
                      buttons.length - 1,
                      index + (event.key === 'ArrowDown' ? 1 : -1)
                    )
                  )
          event.preventDefault()
          buttons[nextIndex]?.focus()
        }}
      >
        <button
          type='button'
          aria-current={!folderId && !documentId ? 'location' : undefined}
          aria-pressed={!folderId && !documentId}
          data-creation-target={!folderId || undefined}
          className={cn(
            'mb-1 grid min-h-9 w-full grid-cols-[0.875rem_1rem_minmax(0,1fr)] items-center gap-2 rounded-md px-2 text-start text-sm hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
            !folderId && !documentId && 'bg-primary/8 font-medium text-primary'
          )}
          onClick={() => onFolderSelect('')}
        >
          <span aria-hidden className='size-3.5' />
          <FolderRoot
            aria-hidden
            className='size-4 shrink-0 text-muted-foreground'
          />
          <span className='truncate'>{t('admin.workspace.rootFolder')}</span>
        </button>
        <ul className='min-w-0 space-y-0.5'>
          {rows.map((row) =>
            row.kind === 'folder' ? (
              <li key={`folder:${row.folder.id}`} className='min-w-0'>
                <button
                  type='button'
                  aria-label={t(
                    folderIsExpanded(row.folder.id)
                      ? 'admin.documentForm.collapseFolder'
                      : 'admin.documentForm.expandFolder',
                    { name: row.folder.name }
                  )}
                  aria-expanded={folderIsExpanded(row.folder.id)}
                  onClick={() => {
                    setFolderExpanded(
                      row.folder.id,
                      !folderIsExpanded(row.folder.id)
                    )
                    onFolderSelect(row.folder.id)
                  }}
                  onKeyDown={(event) => {
                    if (
                      event.altKey ||
                      event.ctrlKey ||
                      event.metaKey ||
                      event.shiftKey
                    )
                      return
                    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')
                      return
                    event.preventDefault()
                    setFolderExpanded(row.folder.id, event.key === 'ArrowRight')
                  }}
                  aria-current={
                    folderId === row.folder.id && !documentId
                      ? 'location'
                      : undefined
                  }
                  aria-pressed={folderId === row.folder.id && !documentId}
                  data-creation-target={folderId === row.folder.id || undefined}
                  style={{
                    paddingInlineStart: `${0.5 + Math.min(row.depth, 5) * 0.75}rem`,
                  }}
                  className={cn(
                    'grid min-h-9 w-full min-w-0 grid-cols-[0.875rem_1rem_minmax(0,1fr)] items-center gap-2 rounded-md py-1 pe-2 text-start text-sm hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
                    folderId === row.folder.id &&
                      !documentId &&
                      'bg-primary/8 font-medium text-primary'
                  )}
                >
                  {folderIsExpanded(row.folder.id) ? (
                    <ChevronDown
                      aria-hidden
                      className='size-3.5 shrink-0 text-muted-foreground'
                    />
                  ) : (
                    <ChevronRight
                      aria-hidden
                      className='size-3.5 shrink-0 text-muted-foreground'
                    />
                  )}
                  {folderIsExpanded(row.folder.id) ? (
                    <FolderOpen
                      aria-hidden
                      className='size-4 shrink-0 text-muted-foreground'
                    />
                  ) : (
                    <Folder
                      aria-hidden
                      className='size-4 shrink-0 text-muted-foreground'
                    />
                  )}
                  <span className='truncate' title={row.folder.path}>
                    {row.folder.name}
                  </span>
                </button>
              </li>
            ) : (
              <li key={`document:${row.document.id}`} className='min-w-0'>
                <button
                  type='button'
                  aria-label={[
                    row.document.document_type === DOCUMENT_TYPE_OPENAPI
                      ? t('admin.types.openapi')
                      : row.document.document_type === DOCUMENT_TYPE_MARKDOWN
                        ? t('admin.types.markdown')
                        : row.document.document_type === DOCUMENT_TYPE_TEXT
                          ? t('admin.types.text')
                          : undefined,
                    row.document.name ||
                      row.document.file_name ||
                      row.document.relative_path?.split('/').pop(),
                    row.document.name &&
                    row.document.file_name !== row.document.name
                      ? row.document.file_name
                      : undefined,
                    t(`admin.workspace.${documentWorkflowState(row.document)}`),
                    row.document.has_draft &&
                    documentWorkflowState(row.document) === 'published'
                      ? t('admin.workspace.hasDraft')
                      : undefined,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-current={
                    row.document.id === documentId ? 'page' : undefined
                  }
                  onClick={() => onDocumentSelect(row.document)}
                  title={[
                    row.document.name,
                    row.document.relative_path ?? row.document.file_name,
                  ]
                    .filter(Boolean)
                    .join('\n')}
                  style={{
                    paddingInlineStart: `${0.5 + Math.min(row.depth, 5) * 0.75}rem`,
                  }}
                  className={cn(
                    'grid min-h-9 w-full min-w-0 grid-cols-[0.875rem_1rem_minmax(0,1fr)_0.375rem] items-center gap-2 rounded-md py-1 pe-2 text-start text-sm hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
                    row.document.id === documentId &&
                      'bg-primary/8 font-medium text-primary'
                  )}
                >
                  <span aria-hidden className='size-3.5' />
                  <DocumentTypeIcon
                    documentType={row.document.document_type}
                    className={cn(
                      'text-muted-foreground',
                      row.document.id === documentId && 'text-primary'
                    )}
                  />
                  {row.document.document_type === DOCUMENT_TYPE_OPENAPI ||
                  row.document.document_type === DOCUMENT_TYPE_MARKDOWN ||
                  row.document.document_type === DOCUMENT_TYPE_TEXT ? (
                    <span className='sr-only'>
                      {t(
                        row.document.document_type === DOCUMENT_TYPE_OPENAPI
                          ? 'admin.types.openapi'
                          : row.document.document_type ===
                              DOCUMENT_TYPE_MARKDOWN
                            ? 'admin.types.markdown'
                            : 'admin.types.text'
                      )}
                    </span>
                  ) : null}
                  <span className='min-w-0 truncate'>
                    {row.document.name ||
                      row.document.file_name ||
                      row.document.relative_path?.split('/').pop()}
                    {row.document.file_name &&
                      row.document.file_name !== row.document.name && (
                        <span className='sr-only'>
                          {' '}
                          {row.document.file_name}
                        </span>
                      )}
                  </span>
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      (documentWorkflowState(row.document) === 'draft' ||
                        row.document.has_draft) &&
                        'bg-[var(--status-review)]',
                      documentWorkflowState(row.document) === 'published' &&
                        !row.document.has_draft &&
                        'bg-[var(--status-ready)]'
                    )}
                    title={t(
                      row.document.has_draft &&
                        documentWorkflowState(row.document) === 'published'
                        ? 'admin.workspace.hasDraft'
                        : `admin.workspace.${documentWorkflowState(row.document)}`
                    )}
                  >
                    <span className='sr-only'>
                      {t(
                        `admin.workspace.${documentWorkflowState(row.document)}`
                      )}
                      {row.document.has_draft &&
                        documentWorkflowState(row.document) === 'published' && (
                          <span> {t('admin.workspace.hasDraft')}</span>
                        )}
                    </span>
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
