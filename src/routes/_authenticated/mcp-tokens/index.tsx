import { createFileRoute } from '@tanstack/react-router'
import { VdocPlaceholderPage } from '@/components/vdoc-placeholder-page'

export const Route = createFileRoute('/_authenticated/mcp-tokens/')({
  component: () => (
    <VdocPlaceholderPage
      title='MCP Tokens'
      description='Issue and revoke raw Vdoc MCP tokens for agent access.'
      endpoint='/api/v1/private/mcp-tokens'
    />
  ),
})
