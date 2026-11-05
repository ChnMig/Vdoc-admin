import { describe, expect, it } from 'vitest'
import { resourceLocation } from './resource-location'

describe('resource locations copied for MCP', () => {
  it('distinguishes identical names and paths in different projects', () => {
    const scope = {
      teamId: 'team-a',
      teamName: '研发团队',
      projectId: 'project-a',
      projectName: '文档工程/协作平台',
    }
    const path = '版本变更/feat 1.11/前端接口 #1%.md'
    const first = JSON.parse(resourceLocation(scope, path, 'doc-a')!)
    const second = JSON.parse(
      resourceLocation(
        { ...scope, teamId: 'team-b', projectId: 'project-b' },
        path,
        'doc-b'
      )!
    )
    expect(first).toEqual({
      team_id: 'team-a',
      team_name: '研发团队',
      project_id: 'project-a',
      project_name: '文档工程/协作平台',
      document_id: 'doc-a',
      relative_path: path,
    })
    expect(second).toMatchObject({
      project_id: 'project-b',
      team_id: 'team-b',
      document_id: 'doc-b',
      relative_path: path,
    })
    expect(first).not.toEqual(second)
  })

  it('represents the project root using the MCP empty path without losing scope', () => {
    expect(JSON.parse(resourceLocation({ projectId: 'project' }, '')!)).toEqual(
      {
        project_id: 'project',
        path: '',
      }
    )
    expect(resourceLocation({ projectId: '' }, 'guides')).toBeUndefined()
    expect(
      resourceLocation({ projectId: 'project' }, undefined)
    ).toBeUndefined()
  })
})
