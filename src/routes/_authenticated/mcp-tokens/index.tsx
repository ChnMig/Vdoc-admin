import { createFileRoute } from '@tanstack/react-router'
import { VdocPlaceholderPage } from '@/components/vdoc-placeholder-page'

export const Route = createFileRoute('/_authenticated/mcp-tokens/')({
  component: () => (
    <VdocPlaceholderPage
      titleKey='placeholder.mcpTokens.title'
      descriptionKey='placeholder.mcpTokens.description'
      endpoint='GET /api/v1/private/mcp-tokens'
    />
  ),
})
