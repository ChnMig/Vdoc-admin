import { useState } from 'react'
import { Outlet, useLocation } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { getCookie } from '@/lib/cookies'
import { isDocumentDetailPath } from '@/lib/document-workspace-navigation'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SkipToMain } from '@/components/skip-to-main'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const pathname = useLocation({ select: (location) => location.pathname })
  const documentDetail = isDocumentDetailPath(pathname)
  const workspace = [
    '/',
    '/documents',
    '/documents/',
    '/drafts',
    '/drafts/',
    '/versions',
    '/versions/',
    '/diffs',
    '/diffs/',
  ].includes(pathname)
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = getCookie('sidebar_state')
    return saved === undefined ? !workspace : saved !== 'false'
  })
  const authUser = useAuthStore((state) => state.auth.user)
  const hasAuditAccess = authUser?.can_access_audit === true
  return (
    <SearchProvider auditAccess={hasAuditAccess}>
      <LayoutProvider>
        <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SkipToMain />
          {documentDetail ? (
            <div className='app-route-surface @container/content h-svh min-h-0 w-full min-w-0 overflow-hidden bg-background text-foreground'>
              {children ?? <Outlet />}
            </div>
          ) : (
            <>
              <AppSidebar
                hasAuditAccess={hasAuditAccess}
                workspace={workspace}
              />
              <SidebarInset
                className={cn(
                  // Set content container, so we can use container queries
                  'app-route-surface @container/content',
                  'min-w-0 bg-transparent',

                  // If layout is fixed, set the height
                  // to 100svh to prevent overflow
                  'has-data-[layout=fixed]:h-svh',

                  // If layout is fixed and sidebar is inset,
                  // set the height to 100svh - spacing (total margins) to prevent overflow
                  'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]'
                )}
              >
                {children ?? <Outlet />}
              </SidebarInset>
            </>
          )}
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
