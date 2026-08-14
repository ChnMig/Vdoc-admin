import { type NavGroup } from '../types'
import { sidebarData } from './sidebar-data'

export function visibleNavGroups(
  isSuperAdmin: boolean,
  hasAuditAccess = false
): NavGroup[] {
  return sidebarData.navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (!item.requiresSuperAdmin || isSuperAdmin) &&
          (!item.requiresAuditAccess || isSuperAdmin || hasAuditAccess)
      ),
    }))
    .filter((group) => group.items.length > 0)
}
