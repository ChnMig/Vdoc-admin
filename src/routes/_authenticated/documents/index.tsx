import { createFileRoute } from '@tanstack/react-router'
import { DocumentsPage } from '@/features/vdoc-admin/pages'

export const Route = createFileRoute('/_authenticated/documents/')({
  component: DocumentsRoute,
})

function DocumentsRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <DocumentsPage
      search={search}
      onSearchChange={(patch) =>
        void navigate({
          replace: true,
          search: (current) => ({ ...current, ...patch }),
        })
      }
    />
  )
}
