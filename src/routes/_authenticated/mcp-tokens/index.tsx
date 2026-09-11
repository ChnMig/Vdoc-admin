import { createFileRoute } from '@tanstack/react-router'
import { MCPTokensPage } from '@/features/vdoc-admin/mcptokens-page'

export const Route = createFileRoute('/_authenticated/mcp-tokens/')({
  component: MCPTokensRoute,
})

function MCPTokensRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <MCPTokensPage
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
