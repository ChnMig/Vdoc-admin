import { createFileRoute } from '@tanstack/react-router'
import { UsersPage } from '@/features/vdoc-admin/users-page'

export const Route = createFileRoute('/_authenticated/users/')({
  component: UsersPage,
})
