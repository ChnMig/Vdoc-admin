import { createFileRoute, redirect } from '@tanstack/react-router'
import { legacyDocumentDestination } from '@/lib/document-workspace-navigation'

export const Route = createFileRoute('/_authenticated/diffs/')({
  beforeLoad: ({ search }) => {
    throw redirect({
      ...legacyDocumentDestination(search, 'diffs'),
      replace: true,
    })
  },
})
