import { describe, expect, it } from 'vitest'
import { visibleNavGroups } from './visible-sidebar-data'

function visibleTitles(isSuperAdmin: boolean, hasAuditAccess: boolean) {
  return visibleNavGroups(isSuperAdmin, hasAuditAccess).flatMap((group) =>
    group.items.map((item) => item.title)
  )
}

describe('visibleNavGroups', () => {
  it('reserves Users and Teams for SuperAdmin', () => {
    expect(visibleTitles(false, true)).not.toEqual(
      expect.arrayContaining(['Users', 'Teams'])
    )
    expect(visibleTitles(true, false)).toEqual(
      expect.arrayContaining(['Users', 'Teams'])
    )
  })

  it('shows Audit Logs only to SuperAdmin or a project admin', () => {
    expect(visibleTitles(false, false)).not.toContain('Audit Logs')
    expect(visibleTitles(false, true)).toContain('Audit Logs')
    expect(visibleTitles(true, false)).toContain('Audit Logs')
  })
})
