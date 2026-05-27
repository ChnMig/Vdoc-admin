import { createFileRoute } from '@tanstack/react-router'
import { MCPTokensPage } from '@/features/vdoc-admin/pages'

export const Route = createFileRoute('/_authenticated/mcp-tokens/')({
  component: MCPTokensPage,
})
