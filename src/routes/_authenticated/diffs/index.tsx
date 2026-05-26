import { createFileRoute } from '@tanstack/react-router'
import { VdocPlaceholderPage } from '@/components/vdoc-placeholder-page'

export const Route = createFileRoute('/_authenticated/diffs/')({
  component: () => (
    <VdocPlaceholderPage
      title='Diffs'
      description='Compare document versions and review semantic change summaries.'
      endpoint='/api/v1/private/projects/{project_id}/documents/{document_id}/diffs'
    />
  ),
})
