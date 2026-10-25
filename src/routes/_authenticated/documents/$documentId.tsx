import { createFileRoute } from '@tanstack/react-router'
import { documentWorkspaceNavigation } from '@/lib/document-workspace-navigation'
import { DocumentWorkspacePage } from '@/features/vdoc-admin/document-workspace-page'

export const Route = createFileRoute('/_authenticated/documents/$documentId')({
  component: DocumentDetailRoute,
})

function DocumentDetailRoute() {
  const search = Route.useSearch()
  const { documentId } = Route.useParams()
  const navigate = Route.useNavigate()
  return (
    <DocumentWorkspacePage
      defaultView='content'
      search={{ ...search, document_id: documentId }}
      onSearchChange={(patch, options) =>
        void navigate(documentWorkspaceNavigation(search, patch, options))
      }
    />
  )
}
