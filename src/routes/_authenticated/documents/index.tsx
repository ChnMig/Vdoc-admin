import { createFileRoute } from '@tanstack/react-router'
import { VdocPlaceholderPage } from '@/components/vdoc-placeholder-page'

export const Route = createFileRoute('/_authenticated/documents/')({
  component: () => (
    <VdocPlaceholderPage
      titleKey='placeholder.documents.title'
      descriptionKey='placeholder.documents.description'
      endpoint='GET /api/v1/private/documents'
    />
  ),
})
