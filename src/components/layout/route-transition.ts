import type { NavigateOptions } from '@tanstack/react-router'

type RouteViewTransition = Exclude<
  NavigateOptions['viewTransition'],
  boolean | undefined
>

export const routeViewTransition: RouteViewTransition = {
  types: ({ fromLocation, pathChanged }) => {
    if (
      !fromLocation ||
      !pathChanged ||
      (typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    )
      return false
    return ['workspace-navigation']
  },
}
