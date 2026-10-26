import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { invalidateVdocQueries } from './vdoc-query-invalidation'

describe('scoped mutation invalidation', () => {
  it('reloads cached project team names when entering a document after renaming its team', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    })
    const projects = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 'p1', team_name: 'Original team' }],
      })
      .mockResolvedValueOnce({
        items: [{ id: 'p1', team_name: 'Renamed team' }],
      })
    const projectQuery = { queryKey: ['projects'], queryFn: projects }
    await client.fetchQuery(projectQuery)
    client.setQueryData(['teams'], {
      items: [{ id: 't1', name: 'Original team' }],
    })
    client.setQueryData(['users'], { items: [] })

    await invalidateVdocQueries(client, { kind: 'teams' })
    const documentPageProjects = await client.fetchQuery(projectQuery)

    expect(projects).toHaveBeenCalledTimes(2)
    expect(documentPageProjects.items[0].team_name).toBe('Renamed team')
    expect(client.getQueryState(['teams'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['users'])?.isInvalidated).toBe(false)
    client.clear()
  })

  it('refreshes the changed document and dependent summaries without invalidating other documents or account data', async () => {
    const client = new QueryClient()
    const affected = [
      ['documents', 'p1'],
      ['versions', 'p1', 'd1'],
      ['document-overview', 'p1', 'd1'],
      ['audit-logs', ''],
      ['ai-summary', { projectId: 'p1', documentId: 'd1' }],
      [
        'ai-chat-session',
        JSON.stringify(['p1', 'd1', 'draft', 'draft1']),
        'p1',
        'chat1',
      ],
    ]
    const unaffected = [
      ['users'],
      ['teams'],
      ['health'],
      ['versions', 'p1', 'd2'],
      ['versions', 'p2', 'd1'],
      ['audit-logs', 'p2'],
      ['ai-summary', { projectId: 'p1', documentId: 'd2' }],
    ]
    for (const key of [...affected, ...unaffected])
      client.setQueryData(key, { fixture: true })
    await invalidateVdocQueries(client, {
      kind: 'document',
      projectId: 'p1',
      documentId: 'd1',
    })
    for (const key of affected)
      expect(
        client.getQueryState(key)?.isInvalidated,
        JSON.stringify(key)
      ).toBe(true)
    for (const key of unaffected)
      expect(
        client.getQueryState(key)?.isInvalidated,
        JSON.stringify(key)
      ).toBe(false)
    client.clear()
  })
})
