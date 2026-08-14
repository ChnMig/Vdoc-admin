import { createFileRoute } from '@tanstack/react-router'
import { SkillPage } from '@/features/vdoc-admin/pages'

export const Route = createFileRoute('/_authenticated/skill/')({
  component: SkillPage,
})
