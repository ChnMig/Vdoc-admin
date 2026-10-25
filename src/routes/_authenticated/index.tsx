import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  documentWorkspaceNavigation,
  legacyDocumentDestination,
} from '@/lib/document-workspace-navigation'
import { WorkspaceHierarchyPage } from '@/features/vdoc-admin/workspace-hierarchy-page'

export const Route = createFileRoute('/_authenticated/')({
  beforeLoad: ({ search }) => {
    if (search.document_id)
      throw redirect({ ...legacyDocumentDestination(search), replace: true })
  },
  component: WorkspaceHierarchyRoute,
})

function WorkspaceHierarchyRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <WorkspaceHierarchyPage
      search={search}
      onSearchChange={(patch, options) =>
        void navigate(documentWorkspaceNavigation(search, patch, options))
      }
      onDocumentOpen={(projectId, documentId, teamId) =>
        void navigate(
          documentWorkspaceNavigation(search, {
            project_id: projectId,
            team_id: teamId,
            document_id: documentId,
          })
        )
      }
    />
  )
}
