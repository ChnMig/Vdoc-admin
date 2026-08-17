import { describe, expect, it } from 'vitest'
import { vdocRouteSearchSchema } from './vdoc-route-search'

describe('vdocRouteSearchSchema', () => {
  it('keeps exact supported entity IDs and normalizes surrounding space', () => {
    expect(
      vdocRouteSearchSchema.parse({
        project_id: ' project-1 ',
        document_id: 'document-1',
        branch_id: 'branch-1',
        draft_id: 'draft-1',
        version_id: 'version-1',
        endpoint_id: 'endpoint-1',
        from_version_id: 'version-0',
        to_version_id: 'version-1',
        diff_id: 'diff-1',
        token_id: 'token-1',
      })
    ).toEqual({
      project_id: 'project-1',
      document_id: 'document-1',
      branch_id: 'branch-1',
      draft_id: 'draft-1',
      version_id: 'version-1',
      endpoint_id: 'endpoint-1',
      from_version_id: 'version-0',
      to_version_id: 'version-1',
      diff_id: 'diff-1',
      token_id: 'token-1',
    })
  })

  it('drops blank, non-string, and oversized search values', () => {
    expect(
      vdocRouteSearchSchema.parse({
        project_id: ' ',
        document_id: 42,
        version_id: 'x'.repeat(129),
      })
    ).toEqual({
      project_id: undefined,
      document_id: undefined,
      version_id: undefined,
    })
  })
})
