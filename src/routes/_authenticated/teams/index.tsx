import { createFileRoute } from '@tanstack/react-router'
import { VdocPlaceholderPage } from '@/components/vdoc-placeholder-page'

export const Route = createFileRoute('/_authenticated/teams/')({
  component: () => (
    <VdocPlaceholderPage
      titleKey='placeholder.teams.title'
      descriptionKey='placeholder.teams.description'
      endpoint='GET /api/v1/private/teams'
    />
  ),
})
