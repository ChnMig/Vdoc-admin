import { useId, useRef, useState } from 'react'
import {
  Check,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderRoot,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentFolderDTO } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'

type Row = { path: string; name: string; parent: string; level: number }
const parentPath = (path: string) => path.split('/').slice(0, -1).join('/')
const ancestors = (path: string) =>
  path.split('/').map((_, index, parts) => parts.slice(0, index + 1).join('/'))

export function FolderDestinationTree({
  folders,
  defaultPath = '',
  sourcePath,
  disabled = false,
  name = 'parent_path',
}: {
  folders: readonly DocumentFolderDTO[]
  defaultPath?: string
  sourcePath?: string
  disabled?: boolean
  name?: string
}) {
  const { t, language } = useLanguage()
  const hintId = useId()
  const blockedHintId = useId()
  const [selected, setSelected] = useState(defaultPath)
  const [focused, setFocused] = useState(defaultPath)
  const [expanded, setExpanded] = useState(
    () => new Set(['', ...ancestors(defaultPath)])
  )
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const rowsByPath = new Map<string, Row>()
  for (const folder of folders) {
    for (const path of ancestors(folder.path).filter(Boolean)) {
      if (!rowsByPath.has(path))
        rowsByPath.set(path, {
          path,
          name: path.split('/').pop() ?? path,
          parent: parentPath(path),
          level: path.split('/').length + 1,
        })
    }
  }
  const children = new Map<string, Row[]>()
  for (const row of rowsByPath.values())
    children.set(row.parent, [...(children.get(row.parent) ?? []), row])
  for (const siblings of children.values())
    siblings.sort((a, b) => a.name.localeCompare(b.name, language))
  const root: Row = {
    path: '',
    name: t('admin.workspace.rootFolder'),
    parent: '',
    level: 1,
  }
  const visible: Row[] = [root]
  const append = (path: string) => {
    if (!expanded.has(path)) return
    for (const row of children.get(path) ?? []) {
      visible.push(row)
      append(row.path)
    }
  }
  append('')
  const source = sourcePath?.toLocaleLowerCase()
  const blocked = (path: string) =>
    source !== undefined &&
    (path.toLocaleLowerCase() === source ||
      path.toLocaleLowerCase().startsWith(`${source}/`))
  const focus = (path: string) => {
    setFocused(path)
    refs.current.get(path)?.focus()
  }
  const toggle = (path: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
    if (focused.startsWith(`${path}/`) || path === '') focus(path)
  }
  const select = (path: string) => {
    if (!disabled && !blocked(path)) setSelected(path)
  }
  const selectedPath = selected && rowsByPath.has(selected) ? selected : ''
  const focusPath = visible.some((row) => row.path === focused)
    ? focused
    : visible.some((row) => row.path === selectedPath)
      ? selectedPath
      : ''
  return (
    <div className='grid min-w-0 gap-3'>
      <input
        type='hidden'
        name={name}
        value={selectedPath ? `folder:${selectedPath}` : 'project-root'}
      />
      <div className='text-sm font-medium'>
        {t('admin.workspace.destinationFolder')}
      </div>
      <div
        role='tree'
        aria-label={t('admin.workspace.destinationFolder')}
        aria-describedby={hintId}
        className='max-h-[min(20rem,40dvh)] min-h-36 min-w-0 overflow-y-auto overscroll-contain rounded-md border bg-[var(--surface-control)] p-1.5'
      >
        {visible.map((row, index) => {
          const hasChildren = Boolean(children.get(row.path)?.length)
          const isBlocked = blocked(row.path)
          const isSelected = row.path === selectedPath
          return (
            <button
              key={row.path}
              ref={(node) => {
                if (node) refs.current.set(row.path, node)
                else refs.current.delete(row.path)
              }}
              type='button'
              role='treeitem'
              aria-label={row.path || row.name}
              aria-level={row.level}
              aria-posinset={
                row.path
                  ? (children
                      .get(row.parent)
                      ?.findIndex((item) => item.path === row.path) ?? 0) + 1
                  : 1
              }
              aria-setsize={row.path ? children.get(row.parent)?.length : 1}
              aria-selected={isSelected}
              aria-expanded={hasChildren ? expanded.has(row.path) : undefined}
              aria-disabled={isBlocked || disabled || undefined}
              aria-describedby={isBlocked ? blockedHintId : undefined}
              tabIndex={row.path === focusPath ? 0 : -1}
              disabled={disabled}
              title={row.path || row.name}
              onFocus={() => setFocused(row.path)}
              onClick={(event) => {
                if (
                  (event.target as Element).closest(
                    '[data-folder-disclosure]'
                  ) &&
                  hasChildren
                )
                  toggle(row.path)
                else select(row.path)
              }}
              onKeyDown={(event) => {
                if (
                  event.altKey ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey
                )
                  return
                switch (event.key) {
                  case 'ArrowDown':
                    event.preventDefault()
                    focus(visible[Math.min(index + 1, visible.length - 1)].path)
                    break
                  case 'ArrowUp':
                    event.preventDefault()
                    focus(visible[Math.max(index - 1, 0)].path)
                    break
                  case 'Home':
                    event.preventDefault()
                    focus('')
                    break
                  case 'End':
                    event.preventDefault()
                    focus(visible[visible.length - 1].path)
                    break
                  case 'ArrowRight':
                    event.preventDefault()
                    if (hasChildren) {
                      if (!expanded.has(row.path)) toggle(row.path)
                      else focus(children.get(row.path)![0].path)
                    }
                    break
                  case 'ArrowLeft':
                    event.preventDefault()
                    if (hasChildren && expanded.has(row.path)) toggle(row.path)
                    else if (row.path) focus(row.parent)
                    break
                  case 'Enter':
                  case ' ':
                    event.preventDefault()
                    select(row.path)
                    break
                }
              }}
              style={{
                paddingInlineStart: `${0.25 + Math.min(row.level - 1, 6) * 0.9}rem`,
              }}
              className={cn(
                'grid min-h-10 w-full min-w-0 grid-cols-[1.5rem_1rem_minmax(0,1fr)_1rem] items-center gap-2 rounded-sm pe-2 text-start text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                isSelected && 'bg-primary/8 font-medium text-primary',
                isBlocked && 'text-muted-foreground opacity-60',
                disabled && 'opacity-60'
              )}
            >
              <span
                aria-hidden
                data-folder-disclosure={hasChildren || undefined}
                className='flex size-6 items-center justify-center'
              >
                {hasChildren && (
                  <ChevronRight
                    className={cn(
                      'size-3.5 transition-transform motion-reduce:transition-none',
                      expanded.has(row.path) && 'rotate-90'
                    )}
                  />
                )}
              </span>
              {!row.path ? (
                <FolderRoot aria-hidden className='size-4' />
              ) : expanded.has(row.path) ? (
                <FolderOpen aria-hidden className='size-4' />
              ) : (
                <Folder aria-hidden className='size-4' />
              )}
              <span className='truncate'>{row.name}</span>
              {isSelected && <Check aria-hidden className='size-4' />}
            </button>
          )
        })}
      </div>
      <p id={hintId} className='text-xs leading-5 text-muted-foreground'>
        {t('admin.workspace.folderDestinationHint')}
      </p>
      {sourcePath && (
        <p
          id={blockedHintId}
          className='text-xs leading-5 text-muted-foreground'
        >
          {t('admin.workspace.invalidFolderDestination')}
        </p>
      )}
      <div className='grid min-w-0 gap-1.5 border-t pt-3'>
        <span className='text-xs text-muted-foreground'>
          {t('admin.workspace.selectedDestination')}
        </span>
        <nav
          aria-label={t('admin.workspace.selectedDestination')}
          className='flex min-w-0 flex-wrap items-center gap-0.5 text-sm'
        >
          {[
            root,
            ...ancestors(selectedPath)
              .filter(Boolean)
              .map((path) => rowsByPath.get(path)!),
          ].map((row, index) => (
            <span key={row.path} className='contents'>
              {index > 0 && (
                <ChevronRight
                  aria-hidden
                  className='size-3 shrink-0 text-muted-foreground'
                />
              )}
              <button
                type='button'
                disabled={disabled}
                aria-current={
                  row.path === selectedPath ? 'location' : undefined
                }
                className='min-h-8 max-w-full rounded px-1.5 text-start break-all hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring'
                onClick={() => {
                  select(row.path)
                  setFocused(row.path)
                  setExpanded(
                    (current) =>
                      new Set([...current, '', ...ancestors(row.path)])
                  )
                }}
              >
                {row.name}
              </button>
            </span>
          ))}
        </nav>
      </div>
    </div>
  )
}
