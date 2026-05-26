import { createFileRoute } from '@tanstack/react-router'
import { VdocPlaceholderPage } from '@/components/vdoc-placeholder-page'

export const Route = createFileRoute('/_authenticated/drafts/')({
  component: () => (
    <VdocPlaceholderPage
      title='Drafts'
      description='Review submitted document drafts before publication.'
      endpoint='/api/v1/private/projects/{project_id}/documents/{document_id}/drafts'
    />
  ),
})
