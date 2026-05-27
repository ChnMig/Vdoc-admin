import { createFileRoute } from '@tanstack/react-router'
import { TeamsPage } from '@/features/vdoc-admin/pages'

export const Route = createFileRoute('/_authenticated/teams/')({
  component: TeamsPage,
})
