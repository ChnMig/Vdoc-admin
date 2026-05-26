import { createFileRoute } from '@tanstack/react-router'
import { VdocPlaceholderPage } from '@/components/vdoc-placeholder-page'

export const Route = createFileRoute('/_authenticated/documents/')({
  component: () => (
    <VdocPlaceholderPage
      title='Documents'
      description='Browse OpenAPI and Markdown documents managed by Vdoc.'
      endpoint='/api/v1/private/projects/{project_id}/documents'
    />
  ),
})
