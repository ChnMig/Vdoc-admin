import type { DocumentDTO, DocumentFolderDTO } from '@/lib/vdoc-api'
import type { VdocRouteSearch } from '@/lib/vdoc-route-search'

export type WorkspaceView = NonNullable<VdocRouteSearch['workspace_view']>

export const emptyDocumentSelection = {
  document_id: undefined,
  branch_id: undefined,
  draft_id: undefined,
  version_id: undefined,
  endpoint_id: undefined,
  from_version_id: undefined,
  to_version_id: undefined,
  diff_id: undefined,
} satisfies Partial<VdocRouteSearch>

export function documentSelection(document: DocumentDTO) {
  return {
    ...emptyDocumentSelection,
    document_id: document.id,
    folder_id: document.folder_id ?? undefined,
    workspace_view: 'content' as const,
  }
}

export function documentWorkflowState(document: DocumentDTO) {
  return (
    document.workflow_state ??
    (document.latest_version_id
      ? 'published'
      : document.latest_draft_id
        ? 'draft'
        : 'empty')
  )
}

export type WorkspaceTreeRow =
  | { kind: 'folder'; folder: DocumentFolderDTO; depth: number }
  | { kind: 'document'; document: DocumentDTO; depth: number }

export function documentTreeRows(
  folders: readonly DocumentFolderDTO[],
  documents: readonly DocumentDTO[],
  expanded: ReadonlySet<string>,
  search: string
): WorkspaceTreeRow[] {
  const query = search.trim().toLocaleLowerCase()
  const foldersById = new Map(folders.map((folder) => [folder.id, folder]))
  const foldersByPath = new Map(
    folders.map((folder) => [folder.path.toLocaleLowerCase(), folder.id])
  )
  const folderForDocument = (document: DocumentDTO) => {
    if (document.folder_id) return document.folder_id
    const path = document.relative_path?.split('/').slice(0, -1).join('/')
    return path ? (foldersByPath.get(path.toLocaleLowerCase()) ?? '') : ''
  }
  const visibleFolders = new Set<string>()
  const includeAncestors = (folderId: string) => {
    const seen = new Set<string>()
    let current = folderId
    while (current && !seen.has(current)) {
      seen.add(current)
      visibleFolders.add(current)
      current = foldersById.get(current)?.parent_id ?? ''
    }
  }
  const matchingDocuments = documents.filter((document) => {
    const matches =
      !query ||
      [document.name, document.file_name, document.relative_path]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
        .includes(query)
    if (matches) includeAncestors(folderForDocument(document))
    return matches
  })
  for (const folder of folders)
    if (!query || folder.path.toLocaleLowerCase().includes(query))
      includeAncestors(folder.id)
  const children = new Map<string, WorkspaceTreeRow[]>()
  const append = (parentId: string, row: WorkspaceTreeRow) =>
    children.set(parentId, [...(children.get(parentId) ?? []), row])
  for (const folder of folders) {
    if (visibleFolders.has(folder.id))
      append(folder.parent_id ?? '', { kind: 'folder', folder, depth: 0 })
  }
  for (const document of matchingDocuments)
    append(folderForDocument(document), {
      kind: 'document',
      document,
      depth: 0,
    })
  for (const siblings of children.values())
    siblings.sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1
      const leftName =
        left.kind === 'folder'
          ? left.folder.name
          : (left.document.file_name ?? left.document.name)
      const rightName =
        right.kind === 'folder'
          ? right.folder.name
          : (right.document.file_name ?? right.document.name)
      return leftName.localeCompare(rightName)
    })
  const result: WorkspaceTreeRow[] = []
  const seen = new Set<string>()
  const pending = [...(children.get('') ?? [])].reverse()
  while (pending.length) {
    const row = pending.pop()!
    const key =
      row.kind === 'folder'
        ? `folder:${row.folder.id}`
        : `document:${row.document.id}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(row)
    if (row.kind === 'folder' && (query || expanded.has(row.folder.id)))
      for (const child of [...(children.get(row.folder.id) ?? [])].reverse())
        pending.push({ ...child, depth: row.depth + 1 })
  }
  return result
}
