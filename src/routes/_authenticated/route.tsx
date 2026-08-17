import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { isUnauthenticatedError } from '@/lib/auth-errors'
import { getIdentity } from '@/lib/vdoc-api'
import { vdocRouteSearchSchema } from '@/lib/vdoc-route-search'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { AuthenticatedRouteError } from '@/features/errors/authenticated-route-error'

export const Route = createFileRoute('/_authenticated')({
  validateSearch: vdocRouteSearchSchema,
  beforeLoad: async ({ location }) => {
    const { auth } = useAuthStore.getState()
    if (!auth.accessToken) {
      throw redirect({
        to: '/sign-in',
        search: { redirect: location.href },
      })
    }

    try {
      auth.setUser(await getIdentity())
    } catch (error) {
      if (isUnauthenticatedError(error)) {
        useAuthStore.getState().auth.reset()
        throw redirect({
          to: '/sign-in',
          search: { redirect: location.href },
        })
      }
      throw error
    }
  },
  component: AuthenticatedLayout,
  errorComponent: AuthenticatedRouteError,
})
