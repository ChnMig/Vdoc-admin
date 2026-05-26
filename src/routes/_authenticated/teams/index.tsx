import { createFileRoute } from '@tanstack/react-router'
import { VdocPlaceholderPage } from '@/components/vdoc-placeholder-page'

export const Route = createFileRoute('/_authenticated/teams/')({
  component: () => (
    <VdocPlaceholderPage
      title='Teams'
      description='Manage Vdoc teams and their administrative ownership.'
      endpoint='/api/v1/private/teams'
    />
  ),
})
