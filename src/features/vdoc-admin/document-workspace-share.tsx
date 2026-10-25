import { useQuery } from '@tanstack/react-query'
import {
  getDocumentOverview,
  getVersion,
  listBranches,
  type DocumentDTO,
} from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import { DocumentSharePanel } from './document-share-panel'
import { LoadingErrorState } from './page-shared'

export function DocumentWorkspaceShare({
  projectId,
  document,
  canManage,
  interactive,
  selectedVersionId,
  selectedBranchId,
  embedded = false,
}: {
  projectId: string
  document: DocumentDTO
  canManage: boolean
  interactive: boolean
  selectedVersionId?: string | null
  selectedBranchId?: string
  embedded?: boolean
}) {
  const { t } = useLanguage()
  const versionId =
    selectedVersionId === undefined
      ? (document.latest_version_id ?? null)
      : selectedVersionId
  const versionQuery = useQuery({
    queryKey: ['version', projectId, document.id, versionId],
    queryFn: ({ signal }) =>
      getVersion(projectId, document.id, versionId ?? '', { signal }),
    enabled: Boolean(versionId && canManage),
  })
  const overviewQuery = useQuery({
    queryKey: ['document-overview', projectId, document.id],
    queryFn: ({ signal }) =>
      getDocumentOverview(projectId, document.id, { signal }),
    enabled: canManage,
  })
  const branchesQuery = useQuery({
    queryKey: ['branches', projectId, document.id],
    queryFn: ({ signal }) => listBranches(projectId, document.id, { signal }),
    enabled: canManage,
  })
  if (!canManage) return null
  const selectedVersion = versionQuery.data
  const validVersion = Boolean(
    selectedVersion &&
    selectedVersion.id === versionId &&
    selectedVersion.project_id === projectId &&
    selectedVersion.document_id === document.id &&
    selectedVersion.status === 1 &&
    (!selectedBranchId || selectedVersion.branch_id === selectedBranchId)
  )
  const versionPending = Boolean(versionId && versionQuery.isPending)
  const dependenciesReady =
    overviewQuery.isSuccess &&
    branchesQuery.isSuccess &&
    !versionPending &&
    !versionQuery.isError
  return (
    <>
      <LoadingErrorState state={overviewQuery} />
      <LoadingErrorState state={branchesQuery} />
      {versionId && <LoadingErrorState state={versionQuery} />}
      {(overviewQuery.isError ||
        branchesQuery.isError ||
        versionQuery.isError) && (
        <Button
          type='button'
          variant='outline'
          className='w-fit'
          onClick={() => {
            void overviewQuery.refetch()
            void branchesQuery.refetch()
            if (versionId) void versionQuery.refetch()
          }}
        >
          {t('publicShare.retry')}
        </Button>
      )}
      {dependenciesReady && (
        <DocumentSharePanel
          projectId={projectId}
          documentId={document.id}
          documentName={document.name}
          branches={branchesQuery.data?.items ?? []}
          publishedBranchIds={overviewQuery.data?.published_branch_ids ?? []}
          canManage={canManage}
          selectedVersionId={
            versionId === null ? null : validVersion ? selectedVersion?.id : ''
          }
          selectedBranchId={
            validVersion ? selectedVersion?.branch_id : undefined
          }
          selectedVersionName={
            validVersion ? selectedVersion?.version_name : undefined
          }
          interactive={interactive}
          embedded={embedded}
        />
      )}
    </>
  )
}
