import { createFileRoute } from '@tanstack/react-router'
import { SkillPage } from '@/features/vdoc-admin/skill-page'

export const Route = createFileRoute('/_authenticated/skill/')({
  component: SkillPage,
})
