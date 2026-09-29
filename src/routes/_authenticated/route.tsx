import { createFileRoute } from '@tanstack/react-router'
import { requireAuthenticatedUser } from '@/lib/auth-route'
import { vdocRouteSearchSchema } from '@/lib/vdoc-route-search'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { AuthenticatedRouteError } from '@/features/errors/authenticated-route-error'

export const Route = createFileRoute('/_authenticated')({
  validateSearch: vdocRouteSearchSchema,
  beforeLoad: ({ location, abortController }) =>
    requireAuthenticatedUser(location.href, abortController.signal),
  component: AuthenticatedLayout,
  errorComponent: AuthenticatedRouteError,
})
