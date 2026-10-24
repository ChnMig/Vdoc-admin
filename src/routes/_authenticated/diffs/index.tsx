import { createFileRoute } from '@tanstack/react-router'
import { DocumentWorkspacePage } from '@/features/vdoc-admin/document-workspace-page'

export const Route = createFileRoute('/_authenticated/diffs/')({
  component: DiffsRoute,
})

function DiffsRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <DocumentWorkspacePage
      defaultView='diffs'
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
