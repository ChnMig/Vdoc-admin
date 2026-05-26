import { createFileRoute } from '@tanstack/react-router'
import { VdocPlaceholderPage } from '@/components/vdoc-placeholder-page'

export const Route = createFileRoute('/_authenticated/drafts/')({
  component: () => (
    <VdocPlaceholderPage
      titleKey='placeholder.drafts.title'
      descriptionKey='placeholder.drafts.description'
      endpoint='GET /api/v1/private/drafts'
    />
  ),
})
