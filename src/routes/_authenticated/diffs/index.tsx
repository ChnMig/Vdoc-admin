import { createFileRoute } from '@tanstack/react-router'
import { DiffsPage } from '@/features/vdoc-admin/pages'

export const Route = createFileRoute('/_authenticated/diffs/')({
  component: DiffsRoute,
})

function DiffsRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <DiffsPage
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
