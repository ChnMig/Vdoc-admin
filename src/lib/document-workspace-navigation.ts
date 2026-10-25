import type { VdocRouteSearch } from './vdoc-route-search'

type WorkspaceView = NonNullable<VdocRouteSearch['workspace_view']>

export function clearDocumentContext(search: VdocRouteSearch): VdocRouteSearch {
  return {
    ...search,
    document_id: undefined,
    branch_id: undefined,
    draft_id: undefined,
    version_id: undefined,
    endpoint_id: undefined,
    from_version_id: undefined,
    to_version_id: undefined,
    diff_id: undefined,
    content_mode: undefined,
    workspace_view: undefined,
  }
}

export function documentDetailDestination(
  documentId: string,
  search: VdocRouteSearch,
  defaultView: WorkspaceView = 'content'
) {
  return {
    to: '/documents/$documentId' as const,
    params: { documentId },
    search: {
      ...search,
      document_id: undefined,
      workspace_view: search.workspace_view ?? defaultView,
    },
  }
}

export function legacyDocumentDestination(
  search: VdocRouteSearch,
  defaultView: WorkspaceView = 'content'
) {
  return search.document_id
    ? documentDetailDestination(search.document_id, search, defaultView)
    : {
        to: '/documents' as const,
        search: clearDocumentContext(search),
      }
}

export function documentWorkspaceNavigation(
  current: VdocRouteSearch,
  patch: Partial<VdocRouteSearch>,
  options?: { replace?: boolean }
) {
  const search = { ...current, ...patch }
  const replace = options?.replace ?? false
  if (Object.prototype.hasOwnProperty.call(patch, 'document_id')) {
    return patch.document_id
      ? {
          ...documentDetailDestination(patch.document_id, search),
          replace,
        }
      : {
          to: '/documents' as const,
          search: clearDocumentContext(search),
          replace,
        }
  }
  return {
    search: { ...search, document_id: undefined },
    replace,
  }
}

export function isWorkspaceEntryPath(destination: string | undefined) {
  if (!destination) return false
  const pathname = destination.replace(/\/$/, '') || '/'
  return ['/', '/documents', '/drafts', '/versions', '/diffs'].includes(
    pathname
  )
}

export function isDocumentDetailPath(pathname: string) {
  return /^\/documents\/[^/]+\/?$/.test(pathname)
}
