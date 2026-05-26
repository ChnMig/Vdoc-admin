import { createFileRoute } from '@tanstack/react-router'
import { VdocPlaceholderPage } from '@/components/vdoc-placeholder-page'

export const Route = createFileRoute('/_authenticated/settings/')({
  component: () => (
    <VdocPlaceholderPage
      titleKey='placeholder.settings.title'
      descriptionKey='placeholder.settings.description'
      endpoint='VITE_VDOC_API_BASE_URL'
    />
  ),
})
