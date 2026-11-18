import { Logo } from '@/assets/logo'
import { getAdminBranding } from '@/lib/branding'
import { useLanguage } from '@/context/language-provider'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { NavigationLink } from './navigation-link'

export function AppTitle() {
  const { setOpenMobile } = useSidebar()
  const { t } = useLanguage()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          size='lg'
          tooltip={t('app.name')}
          className='h-10 gap-3 group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center'
        >
          <NavigationLink
            to='/documents'
            aria-label={t('app.name')}
            onClick={() => setOpenMobile(false)}
          >
            <Logo className='size-6' />
            <span className='flex min-w-0 flex-1 items-center gap-2 font-semibold group-data-[collapsible=icon]:hidden'>
              <span className='truncate'>{t('app.name')}</span>
              {getAdminBranding().beta && (
                <span className='rounded-md bg-surface-control px-2 py-1 text-xs font-medium text-muted-foreground'>
                  Beta
                </span>
              )}
            </span>
          </NavigationLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
