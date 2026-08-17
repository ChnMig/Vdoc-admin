import { createFileRoute } from '@tanstack/react-router'
import { DraftsPage } from '@/features/vdoc-admin/pages'

export const Route = createFileRoute('/_authenticated/drafts/')({
  component: DraftsRoute,
})

function DraftsRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <DraftsPage
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
