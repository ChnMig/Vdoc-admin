import { useQuery } from '@tanstack/react-query'
import {
  getRepositoryCommit,
  listRepositoryBranches,
  repositoryKeys,
  type RepositoryCommit,
} from '@/lib/repository-api'
import type { DocumentDTO, DocumentFolderDTO } from '@/lib/vdoc-api'
import type { VdocRouteSearch } from '@/lib/vdoc-route-search'

export function isLegacyRepositorySelection(search: VdocRouteSearch) {
  return Boolean(
    search.draft_id ||
    search.version_id ||
    search.diff_id ||
    search.from_draft_id ||
    search.to_draft_id ||
    search.from_version_id ||
    search.to_version_id ||
    search.content_mode ||
    (search.branch_id && !search.repository_branch_id) ||
    (search.workspace_view && search.workspace_view !== 'content')
  )
}

export function useRepositorySnapshot(
  projectId: string,
  search: VdocRouteSearch,
  enabled = true
) {
  const branchesQuery = useQuery({
    queryKey: repositoryKeys.branches(projectId),
    queryFn: ({ signal }) => listRepositoryBranches(projectId, signal),
    enabled: Boolean(projectId && enabled),
    refetchOnWindowFocus: false,
  })
  const branches = branchesQuery.data ?? []
  const branch = search.repository_branch_id
    ? branches.find((item) => item.id === search.repository_branch_id)
    : (branches.find((item) => item.name === 'main') ?? branches[0])
  const commitId = branch ? (search.commit_id ?? branch.head_commit_id) : ''
  const commitQuery = useQuery({
    queryKey: repositoryKeys.commit(projectId, commitId),
    queryFn: ({ signal }) => getRepositoryCommit(projectId, commitId, signal),
    enabled: Boolean(projectId && commitId && enabled),
    refetchOnWindowFocus: false,
  })
  return { branchesQuery, branches, branch, commitId, commitQuery }
}

export function projectRepositoryTree(
  commit: RepositoryCommit | undefined,
  legacyDocuments: readonly DocumentDTO[]
) {
  const folders = new Map<string, DocumentFolderDTO>()
  const documents: DocumentDTO[] = (commit?.files ?? []).map((file) => {
    const legacy = legacyDocuments.find((item) => item.id === file.document_id)
    const segments = file.relative_path.split('/')
    const fileName = segments.pop() ?? file.name
    let parent: string | null = null
    for (let index = 0; index < segments.length; index++) {
      const path = segments.slice(0, index + 1).join('/')
      const id = `repository-folder:${path}`
      if (!folders.has(id))
        folders.set(id, {
          id,
          project_id: commit?.project_id ?? '',
          parent_id: parent,
          name: segments[index],
          path,
          created_by: commit?.created_by ?? '',
          created_at: commit?.created_at ?? '',
          updated_at: commit?.created_at ?? '',
        })
      parent = id
    }
    return {
      ...legacy,
      id: file.document_id,
      project_id: commit?.project_id ?? '',
      name: file.name,
      document_type: file.document_type,
      relative_path: file.relative_path,
      file_name: fileName,
      folder_id: parent,
      description: file.description,
      status: 1,
      created_by: legacy?.created_by ?? commit?.created_by ?? '',
      created_at: legacy?.created_at ?? commit?.created_at ?? '',
      updated_at: commit?.created_at ?? '',
      workflow_state: undefined,
      has_draft: false,
      latest_draft_id: null,
      latest_version_id: null,
    }
  })
  return { documents, folders: [...folders.values()] }
}
