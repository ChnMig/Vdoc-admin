import { describe, expect, it } from 'vitest'
import {
  clearDocumentContext,
  documentDetailDestination,
  documentWorkspaceNavigation,
  isDocumentDetailPath,
  isWorkspaceEntryPath,
  legacyDocumentDestination,
} from './document-workspace-navigation'
import type { VdocRouteSearch } from './vdoc-route-search'

const selected: VdocRouteSearch = {
  team_id: 'team-1',
  project_id: 'project-1',
  folder_id: 'folder-1',
  document_id: 'document-1',
  branch_id: 'branch-1',
  draft_id: 'draft-1',
  version_id: 'version-1',
  endpoint_id: 'endpoint-1',
  from_version_id: 'from-1',
  to_version_id: 'to-1',
  from_branch_id: 'source-branch',
  to_branch_id: 'target-branch',
  diff_id: 'diff-1',
  content_mode: 'draft',
  workspace_view: 'diffs',
}

describe('document workspace navigation', () => {
  it('moves document identity into the path and preserves revision deep links', () => {
    expect(documentDetailDestination('path-document', selected)).toEqual({
      to: '/documents/$documentId',
      params: { documentId: 'path-document' },
      search: { ...selected, document_id: undefined },
    })
  })

  it.each(['content', 'drafts', 'versions', 'diffs'] as const)(
    'preserves the legacy %s page intent when no view was supplied',
    (defaultView) => {
      const destination = legacyDocumentDestination(
        { ...selected, workspace_view: undefined },
        defaultView
      )
      expect(destination).toMatchObject({
        to: '/documents/$documentId',
        params: { documentId: 'document-1' },
        search: {
          document_id: undefined,
          workspace_view: defaultView,
          draft_id: 'draft-1',
          version_id: 'version-1',
          from_version_id: 'from-1',
          to_version_id: 'to-1',
          from_branch_id: 'source-branch',
          to_branch_id: 'target-branch',
          diff_id: 'diff-1',
        },
      })
    }
  )

  it('opens an uploaded document with its initial draft selection', () => {
    const destination = documentWorkspaceNavigation(
      { team_id: 'team-1', project_id: 'project-1' },
      {
        document_id: 'created-document',
        branch_id: 'created-branch',
        draft_id: 'created-draft',
        content_mode: 'draft',
        workspace_view: 'drafts',
      },
      { replace: true }
    )
    expect(destination).toEqual({
      to: '/documents/$documentId',
      params: { documentId: 'created-document' },
      search: {
        team_id: 'team-1',
        project_id: 'project-1',
        document_id: undefined,
        branch_id: 'created-branch',
        draft_id: 'created-draft',
        content_mode: 'draft',
        workspace_view: 'drafts',
      },
      replace: true,
    })
  })

  it('returns to the scoped workspace and clears document tools when identity is explicitly cleared', () => {
    const destination = documentWorkspaceNavigation(
      selected,
      { document_id: undefined, folder_id: 'folder-2' },
      { replace: true }
    )
    expect(destination).toEqual({
      to: '/documents',
      search: {
        ...clearDocumentContext(selected),
        folder_id: 'folder-2',
      },
      replace: true,
    })
    expect(
      Object.entries(destination.search).filter(
        ([, value]) => value !== undefined
      )
    ).toEqual([
      ['team_id', 'team-1'],
      ['project_id', 'project-1'],
      ['folder_id', 'folder-2'],
    ])
  })

  it('keeps the current document path when only its revision or tool changes', () => {
    const destination = documentWorkspaceNavigation(
      selected,
      { workspace_view: 'versions', version_id: 'version-2' },
      { replace: true }
    )
    expect(destination).not.toHaveProperty('to')
    expect(destination).toEqual({
      search: {
        ...selected,
        document_id: undefined,
        workspace_view: 'versions',
        version_id: 'version-2',
      },
      replace: true,
    })
  })

  it('uses normal history navigation unless replace was requested', () => {
    expect(
      documentWorkspaceNavigation({}, { document_id: 'new' }).replace
    ).toBe(false)
    expect(
      documentWorkspaceNavigation({}, { project_id: 'project-1' }).replace
    ).toBe(false)
  })

  it.each(['/', '/documents', '/documents/', '/drafts', '/versions', '/diffs'])(
    'recognizes %s as a workspace entry',
    (destination) => {
      expect(isWorkspaceEntryPath(destination)).toBe(true)
    }
  )

  it('does not treat other management destinations as workspace entries', () => {
    expect(isWorkspaceEntryPath('/settings')).toBe(false)
    expect(isWorkspaceEntryPath('/mcp-tokens')).toBe(false)
    expect(isWorkspaceEntryPath(undefined)).toBe(false)
  })

  it('redirects a legacy page without a document to the scoped workspace', () => {
    expect(
      legacyDocumentDestination(
        { ...selected, document_id: undefined },
        'diffs'
      )
    ).toEqual({ to: '/documents', search: clearDocumentContext(selected) })
  })

  it.each([
    ['/documents/document-1', true],
    ['/documents/document-1/', true],
    ['/documents', false],
    ['/documents/', false],
    ['/documents/document-1/settings', false],
    ['/settings', false],
  ] as const)(
    'recognizes the standalone document path %s',
    (path, expected) => {
      expect(isDocumentDetailPath(path)).toBe(expected)
    }
  )
})
