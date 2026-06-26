import * as React from 'react'
import { ChevronsUpDown, Plus } from 'lucide-react'
import { useLanguage } from '@/context/language-provider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { type Team } from './types'

type TeamSwitcherProps = {
  teams: Team[]
}

export function TeamSwitcher({ teams }: TeamSwitcherProps) {
  const { isMobile } = useSidebar()
  const { t } = useLanguage()
  const [activeTeam, setActiveTeam] = React.useState(teams[0])
  const activeTeamName = activeTeam.nameKey
    ? t(activeTeam.nameKey)
    : activeTeam.name
  const activeTeamPlan = activeTeam.planKey
    ? t(activeTeam.planKey)
    : activeTeam.plan

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='h-13 border border-sidebar-border/70 bg-background/45 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <div className='flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow-[0_1px_1px_oklch(0_0_0_/_12%)]'>
                <activeTeam.logo className='size-4' />
              </div>
              <div className='grid flex-1 text-start text-sm leading-tight'>
                <span className='truncate font-semibold'>{activeTeamName}</span>
                <span className='truncate text-xs text-sidebar-foreground/66'>
                  {activeTeamPlan}
                </span>
              </div>
              <ChevronsUpDown className='ms-auto' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
            align='start'
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className='text-xs text-muted-foreground'>
              {t('team.label')}
            </DropdownMenuLabel>
            {teams.map((team, index) => {
              const teamName = team.nameKey ? t(team.nameKey) : team.name

              return (
                <DropdownMenuItem
                  key={team.name}
                  onClick={() => setActiveTeam(team)}
                  className='gap-2 p-2'
                >
                  <div className='flex size-6 items-center justify-center rounded-sm border'>
                    <team.logo className='size-4 shrink-0' />
                  </div>
                  {teamName}
                  <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem className='gap-2 p-2'>
              <div className='flex size-6 items-center justify-center rounded-md border bg-background'>
                <Plus className='size-4' />
              </div>
              <div className='font-medium text-muted-foreground'>
                {t('team.add')}
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
