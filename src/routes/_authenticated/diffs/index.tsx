import { createFileRoute } from '@tanstack/react-router'
import { VdocPlaceholderPage } from '@/components/vdoc-placeholder-page'

export const Route = createFileRoute('/_authenticated/diffs/')({
  component: () => (
    <VdocPlaceholderPage
      titleKey='placeholder.diffs.title'
      descriptionKey='placeholder.diffs.description'
      endpoint='GET /api/v1/private/diffs'
    />
  ),
})
