import { describe, expect, it } from 'vitest'
import { visibleNavGroups } from './visible-sidebar-data'

function visibleTitles(isSuperAdmin: boolean, hasAuditAccess: boolean) {
  return visibleNavGroups(isSuperAdmin, hasAuditAccess).flatMap((group) =>
    group.items.map((item) => item.title)
  )
}

describe('visibleNavGroups', () => {
  it('combines documents and management into one workspace destination', () => {
    const titles = visibleTitles(true, true)
    expect(titles.filter((title) => title === 'Workspace')).toHaveLength(1)
    for (const removed of [
      'Drafts',
      'Versions',
      'Diffs',
      'Dashboard',
      'Documents',
      'Projects',
      'Teams',
      'Users',
    ])
      expect(titles).not.toContain(removed)
    expect(titles).toEqual(
      expect.arrayContaining(['MCP Tokens', 'Audit Logs', 'Settings'])
    )
  })
  it('shows the workspace to every authenticated role', () => {
    expect(visibleTitles(false, false)).toContain('Workspace')
    expect(visibleTitles(true, false)).toContain('Workspace')
  })

  it('shows Audit Logs only to SuperAdmin or a project admin', () => {
    expect(visibleTitles(false, false)).not.toContain('Audit Logs')
    expect(visibleTitles(false, true)).toContain('Audit Logs')
    expect(visibleTitles(true, false)).toContain('Audit Logs')
  })
})
