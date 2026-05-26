import { createFileRoute } from '@tanstack/react-router'
import { VdocPlaceholderPage } from '@/components/vdoc-placeholder-page'

export const Route = createFileRoute('/_authenticated/versions/')({
  component: () => (
    <VdocPlaceholderPage
      title='Versions'
      description='Inspect immutable document versions and release history.'
      endpoint='/api/v1/private/projects/{project_id}/documents/{document_id}/versions'
    />
  ),
})
