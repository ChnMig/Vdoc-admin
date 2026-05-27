import { createFileRoute } from '@tanstack/react-router'
import { DraftsPage } from '@/features/vdoc-admin/pages'

export const Route = createFileRoute('/_authenticated/drafts/')({
  component: DraftsPage,
})
