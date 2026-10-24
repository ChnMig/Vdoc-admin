import { describe, expect, it } from 'vitest'
import type { DocumentDTO, DocumentFolderDTO } from '@/lib/vdoc-api'
import {
  documentSelection,
  documentTreeRows,
  documentWorkflowState,
} from './document-workspace-model'

const folder = (
  id: string,
  parent_id: string | null,
  path: string
): DocumentFolderDTO => ({
  id,
  parent_id,
  path,
  name: path.split('/').pop()!,
  project_id: 'p1',
  created_by: 'u1',
  created_at: '',
  updated_at: '',
})
const document = (
  id: string,
  folder_id: string | null,
  file_name: string
): DocumentDTO => ({
  id,
  project_id: 'p1',
  folder_id,
  file_name,
  name: `Display ${id}`,
  document_type: 3,
  status: 1,
  created_by: 'u1',
  created_at: '',
  updated_at: '',
})

describe('document workspace tree model', () => {
  it('preserves arbitrarily nested folders and only opens the selected branches', () => {
    const folders = Array.from({ length: 250 }, (_, index) =>
      folder(`f${index}`, index ? `f${index - 1}` : null, `level-${index}`)
    )
    const documents = [
      document('nested', 'f249', 'notes.txt'),
      document('root', null, 'root.txt'),
    ]
    const collapsed = documentTreeRows(folders, documents, new Set(), '')
    expect(collapsed.map((row) => row.kind)).toEqual(['folder', 'document'])
    const expanded = documentTreeRows(
      folders,
      documents,
      new Set(folders.map((item) => item.id)),
      ''
    )
    expect(expanded).toHaveLength(252)
    const nested = expanded.find(
      (row) => row.kind === 'document' && row.document.id === 'nested'
    )
    expect(nested?.depth).toBe(250)
  })

  it('searches file and display names and keeps matching ancestors visible', () => {
    const rows = documentTreeRows(
      [
        folder('api', null, 'API'),
        folder('guide', 'api', 'API/guide'),
        folder('other', null, 'Other'),
      ],
      [
        document('chosen', 'guide', 'notes.txt'),
        document('hidden', 'other', 'other.txt'),
      ],
      new Set(),
      'notes'
    )
    expect(
      rows.map((row) =>
        row.kind === 'folder' ? row.folder.id : row.document.id
      )
    ).toEqual(['api', 'guide', 'chosen'])
    expect(
      documentTreeRows(
        [],
        [document('chosen', null, 'notes.txt')],
        new Set(),
        'Display chosen'
      )
    ).toHaveLength(1)
  })

  it('clears every subordinate selection when opening a different file', () => {
    expect(documentSelection(document('new', 'folder', 'new.txt'))).toEqual({
      document_id: 'new',
      folder_id: 'folder',
      workspace_view: 'content',
      branch_id: undefined,
      draft_id: undefined,
      version_id: undefined,
      endpoint_id: undefined,
      from_version_id: undefined,
      to_version_id: undefined,
      diff_id: undefined,
    })
  })

  it('uses permission scoped metadata for file workflow state', () => {
    expect(
      documentWorkflowState({
        ...document('file', null, 'file.txt'),
        workflow_state: 'published',
        has_draft: true,
      })
    ).toBe('published')
    expect(
      documentWorkflowState({
        ...document('file', null, 'file.txt'),
        latest_draft_id: 'draft-1',
      })
    ).toBe('draft')
    expect(documentWorkflowState(document('file', null, 'file.txt'))).toBe(
      'empty'
    )
  })
})
