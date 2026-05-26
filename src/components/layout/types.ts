import { type LinkProps } from '@tanstack/react-router'
import { type TranslationKey } from '@/lib/i18n'

type User = {
  name: string
  email: string
  avatar: string
}

type Team = {
  name: string
  nameKey?: TranslationKey
  logo: React.ElementType
  plan: string
  planKey?: TranslationKey
}

type BaseNavItem = {
  title: string
  titleKey?: TranslationKey
  badge?: string
  icon?: React.ElementType
}

type NavLink = BaseNavItem & {
  url: LinkProps['to'] | (string & {})
  items?: never
}

type NavCollapsible = BaseNavItem & {
  items: (BaseNavItem & { url: LinkProps['to'] | (string & {}) })[]
  url?: never
}

type NavItem = NavCollapsible | NavLink

type NavGroup = {
  title: string
  titleKey?: TranslationKey
  items: NavItem[]
}

type SidebarData = {
  user: User
  teams: Team[]
  navGroups: NavGroup[]
}

export type { SidebarData, NavGroup, NavItem, NavCollapsible, NavLink, Team }
