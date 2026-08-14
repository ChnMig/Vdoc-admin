/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from '@tanstack/react-router'
import { parseAndEraseDocumentShareFragment } from '@/lib/document-share-url'
import { PublicDocumentSharePage } from '@/features/public-share/public-document-share-page'

export const Route = createFileRoute('/share/$shareId')({
  beforeLoad: () => ({
    shareSecret: parseAndEraseDocumentShareFragment(window.location, history),
  }),
  component: PublicShareRoute,
})

function PublicShareRoute() {
  const { shareId } = Route.useParams()
  const { shareSecret } = Route.useRouteContext()
  return (
    <PublicDocumentSharePage
      key={`${shareId}:${shareSecret ?? ''}`}
      shareId={shareId}
      secret={shareSecret}
    />
  )
}
