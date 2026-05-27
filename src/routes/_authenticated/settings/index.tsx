import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '@/features/vdoc-admin/pages'

export const Route = createFileRoute('/_authenticated/settings/')({
  component: SettingsPage,
})
