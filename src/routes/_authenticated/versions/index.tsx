import { createFileRoute } from '@tanstack/react-router'
import { VersionsPage } from '@/features/vdoc-admin/versions-page'

export const Route = createFileRoute('/_authenticated/versions/')({
  component: VersionsRoute,
})

function VersionsRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <VersionsPage
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
