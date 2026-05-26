import { createFileRoute } from '@tanstack/react-router'
import { VdocPlaceholderPage } from '@/components/vdoc-placeholder-page'

export const Route = createFileRoute('/_authenticated/users/')({
  component: () => (
    <VdocPlaceholderPage
      titleKey='placeholder.users.title'
      descriptionKey='placeholder.users.description'
      endpoint='GET /api/v1/private/users'
    />
  ),
})
