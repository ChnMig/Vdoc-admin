import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { vdocRouteSearchSchema } from '@/lib/vdoc-route-search'
import { NavigationLink } from './navigation-link'

beforeEach(() => vi.spyOn(window, 'scrollTo').mockImplementation(() => {}))
afterEach(() => vi.restoreAllMocks())

function NavigationTestLinks() {
  return (
    <>
      <NavigationLink
        to='/documents'
        aria-label='Workspace'
        className='workspace-link'
        data-testid='workspace-link'
      >
        Workspace
      </NavigationLink>
      <NavigationLink to='/settings'>Settings</NavigationLink>
    </>
  )
}

async function renderNavigation() {
  const root = createRootRoute({ component: Outlet })
  const authenticated = createRoute({
    getParentRoute: () => root,
    id: '_authenticated',
    validateSearch: vdocRouteSearchSchema,
    component: Outlet,
  })
  const document = createRoute({
    getParentRoute: () => authenticated,
    path: '/documents/$documentId',
    component: NavigationTestLinks,
  })
  const workspace = createRoute({
    getParentRoute: () => authenticated,
    path: '/documents',
    component: () => <div>Workspace page</div>,
  })
  const settings = createRoute({
    getParentRoute: () => authenticated,
    path: '/settings',
    component: () => <div>Settings page</div>,
  })
  const router = createRouter({
    routeTree: root.addChildren([
      authenticated.addChildren([document, workspace, settings]),
    ]),
    history: createMemoryHistory({
      initialEntries: [
        '/documents/document-1?team_id=team-1&project_id=project-1&document_id=legacy-document&version_id=version-1&workspace_view=versions',
      ],
    }),
  })
  await router.load()
  const screen = render(<RouterProvider router={router} />)
  await screen.findByRole('link', { name: 'Workspace' })
  return { screen, router, user: userEvent.setup() }
}

describe('NavigationLink', () => {
  it('returns to the scoped workspace without reopening the previous document', async () => {
    const { screen, router, user } = await renderNavigation()
    const link = screen.getByRole('link', { name: 'Workspace' })
    expect(link).toHaveClass('workspace-link')
    expect(link).toHaveAttribute('data-testid', 'workspace-link')

    await user.click(link)
    await screen.findByText('Workspace page')
    expect(router.state.location.pathname).toBe('/documents')
    expect(router.state.location.search).toEqual({
      team_id: 'team-1',
      project_id: 'project-1',
    })
  })

  it('preserves existing navigation behavior for other management links', async () => {
    const { screen, router, user } = await renderNavigation()
    await user.click(screen.getByRole('link', { name: 'Settings' }))
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe('/settings')
    )
    expect(router.state.location.search).toEqual({
      team_id: 'team-1',
      project_id: 'project-1',
      document_id: 'legacy-document',
      version_id: 'version-1',
      workspace_view: 'versions',
    })
  })
})
