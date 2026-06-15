import {
  Boxes,
  Diff,
  FileArchive,
  FileText,
  KeyRound,
  Layers3,
  LayoutDashboard,
  Settings,
  SquarePen,
  Users,
} from 'lucide-react'
import { Logo } from '@/assets/logo'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Vdoc',
    email: '',
    avatar: '/images/favicon.svg',
  },
  teams: [
    {
      name: 'Vdoc Admin',
      nameKey: 'app.name',
      logo: Logo,
      plan: 'Workbench + Portal',
      planKey: 'team.serviceConsolePlan',
    },
  ],
  navGroups: [
    {
      title: 'Workspace setup',
      titleKey: 'nav.groupWorkspaceSetup',
      items: [
        {
          title: 'Dashboard',
          titleKey: 'nav.dashboard',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Users',
          titleKey: 'nav.users',
          url: '/users',
          icon: Users,
        },
        {
          title: 'Teams',
          titleKey: 'nav.teams',
          url: '/teams',
          icon: Boxes,
        },
        {
          title: 'Projects',
          titleKey: 'nav.projects',
          url: '/projects',
          icon: Layers3,
        },
      ],
    },
    {
      title: 'Sources/documents',
      titleKey: 'nav.groupSourcesDocuments',
      items: [
        {
          title: 'Documents',
          titleKey: 'nav.documents',
          url: '/documents',
          icon: FileText,
        },
        {
          title: 'Drafts',
          titleKey: 'nav.drafts',
          url: '/drafts',
          icon: SquarePen,
        },
      ],
    },
    {
      title: 'Versions/diffs',
      titleKey: 'nav.groupVersionsDiffs',
      items: [
        {
          title: 'Versions',
          titleKey: 'nav.versions',
          url: '/versions',
          icon: FileArchive,
        },
        {
          title: 'Diffs',
          titleKey: 'nav.diffs',
          url: '/diffs',
          icon: Diff,
        },
      ],
    },
    {
      title: 'Agent access',
      titleKey: 'nav.groupAgentAccess',
      items: [
        {
          title: 'MCP Tokens',
          titleKey: 'nav.mcpTokens',
          url: '/mcp-tokens',
          icon: KeyRound,
        },
      ],
    },
    {
      title: 'System/settings',
      titleKey: 'nav.groupSystemSettings',
      items: [
        {
          title: 'Settings',
          titleKey: 'nav.settings',
          url: '/settings',
          icon: Settings,
        },
      ],
    },
  ],
}
