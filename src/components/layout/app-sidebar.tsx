import { useAuthStore } from '@/stores/auth-store'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { AppTitle } from './app-title'
import { sidebarData } from './data/sidebar-data'
import { visibleNavGroups } from './data/visible-sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'

export function AppSidebar({
  hasAuditAccess = false,
  workspace = false,
}: {
  hasAuditAccess?: boolean
  workspace?: boolean
}) {
  const { collapsible, variant } = useLayout()
  const isSuperAdmin = Boolean(
    useAuthStore((state) => state.auth.user?.is_super_admin)
  )
  const navGroups = visibleNavGroups(isSuperAdmin, hasAuditAccess)
  return (
    <Sidebar
      collapsible={workspace ? 'icon' : collapsible}
      variant={variant}
      className='border-sidebar-border/90 [&_[data-sidebar=menu-button]>svg]:size-5 [&_[data-sidebar=menu-button]>svg]:text-muted-foreground [&_[data-sidebar=menu-button][data-active=true]>svg]:text-sidebar-primary-foreground'
    >
      <SidebarHeader className='h-14 flex-row items-center justify-between px-3 py-2'>
        <AppTitle />
        <SidebarTrigger className='size-9 shrink-0 text-muted-foreground md:hidden' />
      </SidebarHeader>
      <SidebarContent className='gap-1 py-3'>
        {navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter className='items-center px-3 py-4'>
        <NavUser user={sidebarData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
