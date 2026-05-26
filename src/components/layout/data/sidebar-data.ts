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
    name: 'Vdoc Admin',
    email: 'admin@vdoc.local',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Vdoc Admin',
      logo: Logo,
      plan: 'Service Console',
    },
  ],
  navGroups: [
    {
      title: 'Vdoc',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Users',
          url: '/users',
          icon: Users,
        },
        {
          title: 'Teams',
          url: '/teams',
          icon: Boxes,
        },
        {
          title: 'Projects',
          url: '/projects',
          icon: Layers3,
        },
        {
          title: 'Documents',
          url: '/documents',
          icon: FileText,
        },
        {
          title: 'Drafts',
          url: '/drafts',
          icon: SquarePen,
        },
        {
          title: 'Versions',
          url: '/versions',
          icon: FileArchive,
        },
        {
          title: 'Diffs',
          url: '/diffs',
          icon: Diff,
        },
        {
          title: 'MCP Tokens',
          url: '/mcp-tokens',
          icon: KeyRound,
        },
        {
          title: 'Settings',
          url: '/settings',
          icon: Settings,
        },
      ],
    },
  ],
}
