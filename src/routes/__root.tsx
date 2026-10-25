import { type QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Toaster } from '@/components/ui/sonner'
import { NavigationProgress } from '@/components/navigation-progress'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: () => {
    return (
      <>
        <NavigationProgress />
        <Outlet />
        <Toaster duration={5000} />
        {import.meta.env.MODE === 'development' && (
          <>
            <ReactQueryDevtools buttonPosition='bottom-left' />
            <TanStackRouterDevtools position='bottom-right' />
          </>
        )}
      </>
    )
  },
  notFoundComponent: lazyRouteComponent(
    () => import('@/features/errors/not-found-error'),
    'NotFoundError'
  ),
  errorComponent: lazyRouteComponent(
    () => import('@/features/errors/general-error'),
    'GeneralError'
  ),
})
