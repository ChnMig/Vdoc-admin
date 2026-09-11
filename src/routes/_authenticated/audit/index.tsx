import { createFileRoute } from '@tanstack/react-router'
import { AuditPage } from '@/features/vdoc-admin/audit-page'

export const Route = createFileRoute('/_authenticated/audit/')({
  component: AuditPage,
})
