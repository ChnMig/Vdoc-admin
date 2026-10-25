import { createFileRoute, redirect } from '@tanstack/react-router'
import { legacyDocumentDestination } from '@/lib/document-workspace-navigation'

export const Route = createFileRoute('/_authenticated/versions/')({
  beforeLoad: ({ search }) => {
    throw redirect({
      ...legacyDocumentDestination(
        search,
        search.endpoint_id ? 'content' : 'versions'
      ),
      replace: true,
    })
  },
})
