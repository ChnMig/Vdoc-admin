import { useQuery } from '@tanstack/react-query'
import { Outlet } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { listProjectMembers, listProjects } from '@/lib/vdoc-api'
import { LayoutProvider } from '@/context/layout-provider'
import { SearchProvider } from '@/context/search-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SkipToMain } from '@/components/skip-to-main'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  const authUser = useAuthStore((state) => state.auth.user)
  const isSuperAdmin = Boolean(authUser?.is_super_admin)
  const projectsQuery = useQuery({
    queryKey: ['projects', 'navigation-permissions'],
    queryFn: listProjects,
    enabled: !isSuperAdmin,
  })
  const auditAccessQuery = useQuery({
    queryKey: [
      'navigation-audit-access',
      authUser?.id,
      ...(projectsQuery.data?.items.map((project) => project.id) ?? []),
    ],
    queryFn: async () => {
      const projectIds =
        projectsQuery.data?.items.map((project) => project.id) ?? []
      const memberLists = await Promise.all(
        projectIds.map((projectId) => listProjectMembers(projectId))
      )
      return memberLists.some((list) =>
        list.items.some(
          (member) => member.user_id === authUser?.id && member.role === 3
        )
      )
    },
    enabled: !isSuperAdmin && Boolean(authUser?.id) && projectsQuery.isSuccess,
  })
  const hasAuditAccess = isSuperAdmin || auditAccessQuery.data === true
  return (
    <SearchProvider auditAccess={hasAuditAccess}>
      <LayoutProvider>
        <SidebarProvider defaultOpen={defaultOpen}>
          <SkipToMain />
          <AppSidebar hasAuditAccess={hasAuditAccess} />
          <SidebarInset
            className={cn(
              // Set content container, so we can use container queries
              '@container/content',
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
        </SidebarProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}
