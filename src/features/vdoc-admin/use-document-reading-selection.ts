import { useQuery } from '@tanstack/react-query'
import {
  getDraftContent,
  getVersion,
  listBranches,
  listDrafts,
  listVersions,
  type DocumentDTO,
} from '@/lib/vdoc-api'
import type { VdocRouteSearch } from '@/lib/vdoc-route-search'
import type { DocumentReadingSelection } from './document-workspace-content'

// Reading, sharing, and AI resolve the same immutable version or saved draft.
export function useDocumentReadingSelection(
  projectId: string,
  document: DocumentDTO | undefined,
  search: VdocRouteSearch
) {
  const documentId = document?.id ?? ''
  const enabled = Boolean(projectId && documentId)
  const mode =
    search.content_mode ??
    (search.draft_id || search.workspace_view === 'drafts'
      ? 'draft'
      : document?.latest_version_id
        ? 'published'
        : document?.latest_draft_id
          ? 'draft'
          : 'published')
  const seedVersionId =
    search.version_id ??
    (mode === 'published' && !search.branch_id
      ? document?.latest_version_id
      : undefined)
  const seedDraftId =
    search.draft_id ??
    (mode === 'draft' && !search.branch_id
      ? document?.latest_draft_id
      : undefined)
  const branchesQuery = useQuery({
    queryKey: ['branches', projectId, documentId],
    queryFn: ({ signal }) => listBranches(projectId, documentId, { signal }),
    enabled,
  })
  const seedVersionQuery = useQuery({
    queryKey: ['version', projectId, documentId, seedVersionId],
    queryFn: ({ signal }) =>
      getVersion(projectId, documentId, seedVersionId!, { signal }),
    enabled: enabled && Boolean(seedVersionId),
    retry: false,
  })
  const seedDraftQuery = useQuery({
    queryKey: ['draft-content', projectId, documentId, seedDraftId, 'raw'],
    queryFn: ({ signal }) =>
      getDraftContent(projectId, documentId, seedDraftId!, 'raw', { signal }),
    enabled: enabled && Boolean(seedDraftId),
    retry: false,
  })
  const seedVersion = seedVersionQuery.data
  const seedDraft = seedDraftQuery.data?.draft
  const branches = (branchesQuery.data?.items ?? []).filter(
    (item) => item.document_id === documentId
  )
  const resolvingSeed = Boolean(
    (seedVersionId && seedVersionQuery.isPending) ||
    (seedDraftId && seedDraftQuery.isPending)
  )
  const validSeedVersion =
    seedVersion?.project_id === projectId &&
    seedVersion.document_id === documentId &&
    seedVersion.status === 1
      ? seedVersion
      : undefined
  const validSeedDraft =
    seedDraft?.project_id === projectId && seedDraft.document_id === documentId
      ? seedDraft
      : undefined
  const branchId =
    search.branch_id ??
    (mode === 'published'
      ? validSeedVersion?.branch_id
      : validSeedDraft?.branch_id) ??
    (resolvingSeed
      ? ''
      : (branches.find((branch) => branch.is_default && branch.status === 1)
          ?.id ??
        branches.find((branch) => branch.status === 1)?.id ??
        ''))
  const branch = branches.find((item) => item.id === branchId)
  const versionsQuery = useQuery({
    queryKey: ['versions', projectId, documentId, branchId, 'workspace'],
    queryFn: ({ signal }) =>
      listVersions(projectId, documentId, branchId, {
        signal,
        page: { page_size: 50, offset: 0 },
      }),
    enabled: enabled && Boolean(branch),
  })
  const draftsQuery = useQuery({
    queryKey: ['drafts', projectId, documentId, branchId, 'workspace'],
    queryFn: ({ signal }) =>
      listDrafts(projectId, documentId, branchId, {
        signal,
        page: { page_size: 50, offset: 0 },
      }),
    enabled: enabled && Boolean(branch),
  })
  const versions = (versionsQuery.data?.items ?? []).filter(
    (item) =>
      item.branch_id === branchId &&
      item.project_id === projectId &&
      item.document_id === documentId &&
      item.status === 1
  )
  if (
    validSeedVersion?.branch_id === branchId &&
    !versions.some((item) => item.id === validSeedVersion.id)
  )
    versions.push(validSeedVersion)
  const drafts = (draftsQuery.data?.items ?? []).filter(
    (item) =>
      item.branch_id === branchId &&
      item.project_id === projectId &&
      item.document_id === documentId &&
      item.status >= 1 &&
      item.status <= 4
  )
  if (
    validSeedDraft?.branch_id === branchId &&
    (validSeedDraft.status !== 5 || search.draft_id === validSeedDraft.id) &&
    !drafts.some((item) => item.id === validSeedDraft.id)
  )
    drafts.push(validSeedDraft)
  const version =
    mode === 'published'
      ? seedVersionId
        ? versions.find((item) => item.id === seedVersionId)
        : versions[0]
      : undefined
  const draft =
    mode === 'draft'
      ? seedDraftId && (search.draft_id || validSeedDraft?.status !== 5)
        ? drafts.find((item) => item.id === seedDraftId)
        : drafts[0]
      : undefined
  const selectedDraftQuery = useQuery({
    queryKey: ['draft-content', projectId, documentId, draft?.id, 'raw'],
    queryFn: ({ signal }) =>
      getDraftContent(projectId, documentId, draft!.id, 'raw', { signal }),
    enabled: enabled && Boolean(draft),
  })
  const fullDraft = selectedDraftQuery.data?.draft
  const pending =
    branchesQuery.isPending ||
    resolvingSeed ||
    Boolean(
      branch &&
      (mode === 'published'
        ? versionsQuery.isPending
        : draftsQuery.isPending ||
          Boolean(draft && selectedDraftQuery.isPending))
    )
  const invalid =
    !pending &&
    Boolean(
      (search.branch_id && !branch) ||
      (seedVersionId && mode === 'published' && !version) ||
      (search.draft_id && mode === 'draft' && !draft)
    )
  const selection: DocumentReadingSelection = {
    mode,
    branchId,
    branchName: branch?.name,
    version,
    draft:
      fullDraft?.id === draft?.id &&
      fullDraft?.branch_id === branchId &&
      fullDraft?.project_id === projectId &&
      fullDraft?.document_id === documentId
        ? fullDraft
        : undefined,
    pending,
    invalid,
  }
  return {
    selection,
    branch,
    branches,
    versions,
    drafts,
    queryStates: [
      branchesQuery,
      ...(mode === 'published'
        ? [versionsQuery, seedVersionQuery]
        : [draftsQuery, seedDraftQuery, selectedDraftQuery]),
    ],
  }
}
