import { createFileRoute } from '@tanstack/react-router'
import { ProjectsPage } from '@/features/vdoc-admin/pages'

export const Route = createFileRoute('/_authenticated/projects/')({
  component: ProjectsPage,
})
