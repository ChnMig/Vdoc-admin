import { createFileRoute } from '@tanstack/react-router'
import { DocumentWorkspacePage } from '@/features/vdoc-admin/document-workspace-page'

export const Route = createFileRoute('/_authenticated/')({
  component: DocumentWorkspaceRoute,
})

function DocumentWorkspaceRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <DocumentWorkspacePage
      defaultView='content'
      search={search}
      onSearchChange={(patch, options) =>
        void navigate({
          replace: options?.replace ?? false,
          search: (current) => ({ ...current, ...patch }),
        })
      }
    />
  )
}
