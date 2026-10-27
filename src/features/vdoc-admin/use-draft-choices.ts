import { useQueries, useQuery } from '@tanstack/react-query'
import { getDraftContent, listDrafts } from '@/lib/vdoc-api'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { usePageOffset } from '@/hooks/use-page-offset'

export function useDraftChoices(
  projectId: string,
  documentId: string,
  selectedId: string,
  branchId: string,
  search: string,
  enabled: boolean
) {
  const debouncedSearch = useDebouncedValue(search.trim())
  const [offset, setOffset] = usePageOffset(
    JSON.stringify([projectId, documentId, branchId, debouncedSearch])
  )
  const page = { page_size: 50, offset, search: debouncedSearch }
  const draftsQuery = useQuery({
    queryKey: ['drafts', projectId, documentId, 'diff-choices', branchId, page],
    queryFn: ({ signal }) =>
      listDrafts(projectId, documentId, branchId, { signal, page }),
    enabled: Boolean(projectId && documentId && branchId && enabled),
  })
  const belongs = (draft: {
    project_id: string
    document_id: string
    branch_id: string
  }) =>
    draft.project_id === projectId &&
    draft.document_id === documentId &&
    draft.branch_id === branchId
  const drafts = (draftsQuery.data?.items ?? []).filter(belongs)
  const missing =
    selectedId && !drafts.some((draft) => draft.id === selectedId)
      ? [selectedId]
      : []
  const resolved = useQueries({
    queries: missing.map((id) => ({
      queryKey: ['draft', projectId, documentId, id, 'diff-choice'],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getDraftContent(projectId, documentId, id, 'raw', { signal }),
      enabled: Boolean(projectId && documentId && branchId && enabled),
      retry: false,
    })),
  })
  for (const query of resolved)
    if (
      query.data?.draft &&
      belongs(query.data.draft) &&
      !drafts.some((draft) => draft.id === query.data.draft.id)
    )
      drafts.push(query.data.draft)
  return {
    drafts,
    draftsQuery,
    offset,
    setOffset,
    isResolving: resolved.some((query) => query.isPending),
  }
}
