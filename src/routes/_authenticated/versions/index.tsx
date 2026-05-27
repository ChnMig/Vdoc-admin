import { createFileRoute } from '@tanstack/react-router'
import { VersionsPage } from '@/features/vdoc-admin/pages'

export const Route = createFileRoute('/_authenticated/versions/')({
  component: VersionsPage,
})
