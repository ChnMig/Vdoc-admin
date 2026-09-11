import { useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { getVersion, listVersions } from '@/lib/vdoc-api'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { usePageOffset } from '@/hooks/use-page-offset'

export function useVersionChoices(
  projectId: string,
  documentId: string,
  selectedIds: readonly (string | undefined)[]
) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim())
  const [offset, setOffset] = usePageOffset(
    JSON.stringify([projectId, documentId, debouncedSearch])
  )
  const page = { page_size: 50, offset, search: debouncedSearch }
  const versionsQuery = useQuery({
    queryKey: ['versions', projectId, documentId, 'choices', page],
    queryFn: ({ signal }) =>
      listVersions(projectId, documentId, undefined, { signal, page }),
    enabled: Boolean(projectId && documentId),
  })
  const listed = versionsQuery.data?.items ?? []
  const missing = [
    ...new Set(selectedIds.filter((id): id is string => Boolean(id))),
  ].filter((id) => !listed.some((version) => version.id === id))
  const selected = useQueries({
    queries: missing.map((id) => ({
      queryKey: ['version', projectId, documentId, id],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getVersion(projectId, documentId, id, { signal }),
      enabled: Boolean(projectId && documentId),
      retry: false,
    })),
  })
  const versions = [...listed]
  for (const query of selected) {
    const selectedVersion = query.data
    if (
      selectedVersion?.project_id === projectId &&
      selectedVersion.document_id === documentId &&
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
      Boolean(projectId && documentId) &&
      selected.some((query) => query.isPending),
    versionOptions: versions.map((version) => ({
      value: version.id,
      label: version.version_name,
    })),
  }
}
