import { createFileRoute } from '@tanstack/react-router'
import { AuditPage } from '@/features/vdoc-admin/pages'

export const Route = createFileRoute('/_authenticated/audit/')({
  component: AuditPage,
})
