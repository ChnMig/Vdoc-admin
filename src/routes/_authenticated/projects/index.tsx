import { createFileRoute } from '@tanstack/react-router'
import { VdocPlaceholderPage } from '@/components/vdoc-placeholder-page'

export const Route = createFileRoute('/_authenticated/projects/')({
  component: () => (
    <VdocPlaceholderPage
      title='Projects'
      description='Track Vdoc projects that group documents, members, and review policy.'
      endpoint='/api/v1/private/projects'
    />
  ),
})
