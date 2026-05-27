import { createFileRoute } from '@tanstack/react-router'
import { DocumentsPage } from '@/features/vdoc-admin/pages'

export const Route = createFileRoute('/_authenticated/documents/')({
  component: DocumentsPage,
})
