import { useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { getVersion, listVersions } from '@/lib/vdoc-api'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { usePageOffset } from '@/hooks/use-page-offset'

export function useVersionChoices(
  projectId: string,
  documentId: string,
  selectedIds: readonly (string | undefined)[],
  branchId?: string,
  enabled = true
) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim())
  const [offset, setOffset] = usePageOffset(
    JSON.stringify([projectId, documentId, branchId, debouncedSearch])
  )
  const page = { page_size: 50, offset, search: debouncedSearch }
  const versionsQuery = useQuery({
    queryKey: [
      'versions',
      projectId,
      documentId,
      'choices',
      branchId ?? 'all',
      page,
    ],
    queryFn: ({ signal }) =>
      listVersions(projectId, documentId, branchId, { signal, page }),
    enabled: Boolean(projectId && documentId && enabled),
  })
  const belongsToScope = (version: {
    project_id: string
    document_id: string
    branch_id?: string
  }) =>
    version.project_id === projectId &&
    version.document_id === documentId &&
    (!branchId || version.branch_id === branchId)
  const listed = (versionsQuery.data?.items ?? []).filter(belongsToScope)
  const missing = [
    ...new Set(selectedIds.filter((id): id is string => Boolean(id))),
  ].filter((id) => !listed.some((version) => version.id === id))
  const selected = useQueries({
    queries: missing.map((id) => ({
      queryKey: ['version', projectId, documentId, id],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getVersion(projectId, documentId, id, { signal }),
      enabled: Boolean(projectId && documentId && enabled),
      retry: false,
    })),
  })
  const versions = [...listed]
  for (const query of selected) {
    const selectedVersion = query.data
    if (
      selectedVersion &&
      belongsToScope(selectedVersion) &&
      !versions.some((version) => version.id === selectedVersion.id)
    )
      versions.push(selectedVersion)
  }
  return {
    versionsQuery,
    versions,
    search,
    setSearch,
    offset,
    setOffset,
    isResolving:
      Boolean(projectId && documentId && enabled) &&
      selected.some((query) => query.isPending),
    versionOptions: versions.map((version) => ({
      value: version.id,
      label: version.version_name,
    })),
  }
}
