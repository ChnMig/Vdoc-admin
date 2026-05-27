import { createFileRoute } from '@tanstack/react-router'
import { DiffsPage } from '@/features/vdoc-admin/pages'

export const Route = createFileRoute('/_authenticated/diffs/')({
  component: DiffsPage,
})
