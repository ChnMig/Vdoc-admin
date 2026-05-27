import { createFileRoute } from '@tanstack/react-router'
import { UsersPage } from '@/features/vdoc-admin/pages'

export const Route = createFileRoute('/_authenticated/users/')({
  component: UsersPage,
})
