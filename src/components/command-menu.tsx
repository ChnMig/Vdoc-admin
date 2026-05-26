import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronRight, Laptop, Moon, Sun } from 'lucide-react'
import { useLanguage } from '@/context/language-provider'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { sidebarData } from './layout/data/sidebar-data'
import { ScrollArea } from './ui/scroll-area'

export function CommandMenu() {
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()
  const { t } = useLanguage()

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  return (
    <CommandDialog
      modal
      open={open}
      title={t('command.title')}
      description={t('command.description')}
      onOpenChange={setOpen}
    >
      <CommandInput placeholder={t('search.placeholder')} />
      <CommandList>
        <ScrollArea type='hover' className='h-72 pe-1'>
          <CommandEmpty>{t('search.empty')}</CommandEmpty>
          {sidebarData.navGroups.map((group) => {
            const groupLabel = group.titleKey ? t(group.titleKey) : group.title

            return (
              <CommandGroup key={group.title} heading={groupLabel}>
                {group.items.map((navItem, i) => {
                  const navLabel = navItem.titleKey
                    ? t(navItem.titleKey)
                    : navItem.title

                  if (navItem.url)
                    return (
                      <CommandItem
                        key={`${navItem.url}-${i}`}
                        value={navLabel}
                        onSelect={() => {
                          runCommand(() => navigate({ to: navItem.url }))
                        }}
                      >
                        <div className='flex size-4 items-center justify-center'>
                          <ArrowRight className='size-2 text-muted-foreground/80' />
                        </div>
                        {navLabel}
                      </CommandItem>
                    )

                  return navItem.items?.map((subItem, subIndex) => {
                    const subLabel = subItem.titleKey
                      ? t(subItem.titleKey)
                      : subItem.title

                    return (
                      <CommandItem
                        key={`${navItem.title}-${subItem.url}-${subIndex}`}
                        value={`${navLabel}-${subItem.url}`}
                        onSelect={() => {
                          runCommand(() => navigate({ to: subItem.url }))
                        }}
                      >
                        <div className='flex size-4 items-center justify-center'>
                          <ArrowRight className='size-2 text-muted-foreground/80' />
                        </div>
                        {navLabel} <ChevronRight /> {subLabel}
                      </CommandItem>
                    )
                  })
                })}
              </CommandGroup>
            )
          })}
          <CommandSeparator />
          <CommandGroup heading={t('command.themeGroup')}>
            <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
              <Sun /> <span>{t('theme.light')}</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
              <Moon className='scale-90' />
              <span>{t('theme.dark')}</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
              <Laptop />
              <span>{t('theme.system')}</span>
            </CommandItem>
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}
