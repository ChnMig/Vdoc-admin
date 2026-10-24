import { useQuery } from '@tanstack/react-query'
import {
  getDocumentOverview,
  listBranches,
  type DocumentDTO,
} from '@/lib/vdoc-api'
import { DocumentSharePanel } from './document-share-panel'
import { LoadingErrorState } from './page-shared'

export function DocumentWorkspaceShare({
  projectId,
  document,
  canManage,
  interactive,
}: {
  projectId: string
  document: DocumentDTO
  canManage: boolean
  interactive: boolean
}) {
  const overviewQuery = useQuery({
    queryKey: ['document-overview', projectId, document.id],
    queryFn: ({ signal }) =>
      getDocumentOverview(projectId, document.id, { signal }),
  })
  const branchesQuery = useQuery({
    queryKey: ['branches', projectId, document.id],
    queryFn: ({ signal }) => listBranches(projectId, document.id, { signal }),
  })
  return (
    <>
      <LoadingErrorState state={overviewQuery} />
      <LoadingErrorState state={branchesQuery} />
      <DocumentSharePanel
        projectId={projectId}
        documentId={document.id}
        documentName={document.name}
        branches={branchesQuery.data?.items ?? []}
        publishedBranchIds={overviewQuery.data?.published_branch_ids ?? []}
        canManage={canManage}
        interactive={
          interactive && overviewQuery.isSuccess && branchesQuery.isSuccess
        }
      />
    </>
  )
}
