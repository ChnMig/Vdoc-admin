import { createFileRoute } from '@tanstack/react-router'
import { LegalPage } from '@/features/legal/legal-page'

export const Route = createFileRoute('/privacy')({
  component: () => <LegalPage kind='privacy' />,
})
