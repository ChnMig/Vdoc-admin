import { createFileRoute } from '@tanstack/react-router'
import { VdocPlaceholderPage } from '@/components/vdoc-placeholder-page'

export const Route = createFileRoute('/_authenticated/projects/')({
  component: () => (
    <VdocPlaceholderPage
      titleKey='placeholder.projects.title'
      descriptionKey='placeholder.projects.description'
      endpoint='GET /api/v1/private/projects'
    />
  ),
})
