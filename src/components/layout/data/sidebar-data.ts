import {
  Boxes,
  FileText,
  GraduationCap,
  History,
  KeyRound,
  Layers3,
  Settings,
  Users,
} from 'lucide-react'
import { Logo } from '@/assets/logo'
import { getAdminBranding } from '@/lib/branding'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Vdoc',
    email: '',
    avatar: getAdminBranding().logo,
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
          title: 'Documents',
          titleKey: 'nav.documents',
          url: '/documents',
          icon: FileText,
        },
        {
          title: 'Users',
          titleKey: 'nav.users',
          url: '/users',
          icon: Users,
          requiresSuperAdmin: true,
        },
        {
          title: 'Teams',
          titleKey: 'nav.teams',
          url: '/teams',
          icon: Boxes,
          requiresSuperAdmin: true,
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
      title: 'Agent access',
      titleKey: 'nav.groupAgentAccess',
      items: [
        {
          title: 'MCP Tokens',
          titleKey: 'nav.mcpTokens',
          url: '/mcp-tokens',
          icon: KeyRound,
        },
        {
          title: 'Vdoc Skill',
          titleKey: 'nav.skill',
          url: '/skill',
          icon: GraduationCap,
        },
      ],
    },
    {
      title: 'System/settings',
      titleKey: 'nav.groupSystemSettings',
      items: [
        {
          title: 'Audit Logs',
          titleKey: 'nav.audit',
          url: '/audit',
          icon: History,
          requiresAuditAccess: true,
        },
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
