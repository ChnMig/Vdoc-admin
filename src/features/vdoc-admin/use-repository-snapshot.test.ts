import { expect, it } from 'vitest'
import type { RepositoryDocument } from '@/lib/repository-api'
import type { DocumentFolderDTO } from '@/lib/vdoc-api'
import { repositoryDocumentTree } from './use-repository-snapshot'

it('merges persisted empty folders and inferred paths without case duplicates', () => {
  const folders = ['Guides', 'Guides/Empty'].map((path, i) => ({
    id: String(i),
    project_id: 'p',
    path,
    name: path.split('/').slice(-1)[0],
    parent_id: i ? '0' : null,
    created_by: 'u',
    created_at: '',
    updated_at: '',
  })) satisfies DocumentFolderDTO[]
  const catalog = [
    {
      id: 'd',
      project_id: 'p',
      name: 'Guide',
      relative_path: 'guides/API/guide.md',
      document_type: 2,
      status: 1,
    },
  ] as RepositoryDocument[]
  const tree = repositoryDocumentTree('p', catalog, folders)
  expect(tree.folders.map((f) => f.path)).toEqual([
    'Guides',
    'Guides/Empty',
    'Guides/API',
  ])
  expect(tree.folders[2].parent_id).toBe('repository-folder:Guides')
  expect(tree.documents[0].folder_id).toBe('repository-folder:Guides/API')
  expect(tree.documents[0].relative_path).toBe('guides/API/guide.md')
})
