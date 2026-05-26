import { createFileRoute } from '@tanstack/react-router'
import { VdocPlaceholderPage } from '@/components/vdoc-placeholder-page'

export const Route = createFileRoute('/_authenticated/versions/')({
  component: () => (
    <VdocPlaceholderPage
      titleKey='placeholder.versions.title'
      descriptionKey='placeholder.versions.description'
      endpoint='GET /api/v1/private/versions'
    />
  ),
})
