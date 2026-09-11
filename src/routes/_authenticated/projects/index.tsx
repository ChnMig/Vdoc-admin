import { createFileRoute } from '@tanstack/react-router'
import { ProjectsPage } from '@/features/vdoc-admin/projects-page'

export const Route = createFileRoute('/_authenticated/projects/')({
  component: ProjectsPage,
})
