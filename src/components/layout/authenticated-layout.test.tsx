import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { AuthenticatedLayout } from './authenticated-layout'

const routeState = vi.hoisted(() => ({ pathname: '/' }))

vi.mock('@tanstack/react-router', () => ({
  Outlet: () => <div>Outlet</div>,
  useLocation: ({
    select,
  }: {
    select: (location: { pathname: string }) => unknown
  }) => select({ pathname: routeState.pathname }),
}))

vi.mock('@/context/layout-provider', () => ({
  LayoutProvider: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/context/search-provider', () => ({
  SearchProvider: ({
    children,
    auditAccess,
  }: {
    children: React.ReactNode
    auditAccess: boolean
  }) => (
    <div data-testid='search-provider' data-audit-access={auditAccess}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({
    children,
    open,
  }: {
    children: React.ReactNode
    open: boolean
  }) => (
    <div data-testid='sidebar-provider' data-open={open}>
      {children}
    </div>
  ),
  SidebarInset: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}))

vi.mock('@/components/layout/app-sidebar', () => ({
  AppSidebar: ({
    hasAuditAccess,
    workspace,
  }: {
    hasAuditAccess: boolean
    workspace: boolean
  }) => (
    <div
      data-testid='app-sidebar'
      data-audit-access={hasAuditAccess}
      data-workspace={workspace}
    />
  ),
}))

vi.mock('@/components/skip-to-main', () => ({
  SkipToMain: () => null,
}))

describe('AuthenticatedLayout audit capability', () => {
  beforeEach(() => {
    useAuthStore.getState().auth.reset()
    routeState.pathname = '/'
    document.cookie = 'sidebar_state=true; path=/'
  })

  it.each(['/', '/documents', '/drafts', '/versions', '/diffs'])(
    'starts %s with a compact management rail',
    (pathname) => {
      routeState.pathname = pathname
      const screen = render(
        <AuthenticatedLayout>
          <div>Content</div>
        </AuthenticatedLayout>
      )
      expect(screen.getByTestId('sidebar-provider')).toHaveAttribute(
        'data-open',
        'false'
      )
      expect(screen.getByTestId('app-sidebar')).toHaveAttribute(
        'data-workspace',
        'true'
      )
    }
  )

  it('keeps the saved sidebar preference for management pages', () => {
    routeState.pathname = '/projects'
    const screen = render(
      <AuthenticatedLayout>
        <div>Content</div>
      </AuthenticatedLayout>
    )
    expect(screen.getByTestId('sidebar-provider')).toHaveAttribute(
      'data-open',
      'true'
    )
    expect(screen.getByTestId('app-sidebar')).toHaveAttribute(
      'data-workspace',
      'false'
    )
  })

  it.each([
    ['authorized project admin', true],
    ['reader or writer', false],
  ] as const)('uses the identity capability for %s', (_, canAccessAudit) => {
    useAuthStore.getState().auth.setUser({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      is_super_admin: false,
      can_access_audit: canAccessAudit,
      status: 1,
    })

    const screen = render(
      <AuthenticatedLayout>
        <div>Content</div>
      </AuthenticatedLayout>
    )

    expect(screen.getByTestId('search-provider')).toHaveAttribute(
      'data-audit-access',
      String(canAccessAudit)
    )
    expect(screen.getByTestId('app-sidebar')).toHaveAttribute(
      'data-audit-access',
      String(canAccessAudit)
    )
  })
})
