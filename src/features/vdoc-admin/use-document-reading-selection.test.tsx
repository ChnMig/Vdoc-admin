import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  BranchDTO,
  DocumentDTO,
  DraftDTO,
  VersionDTO,
  getDraftContent,
  getVersion,
  listBranches,
  listDrafts,
  listVersions,
} from '@/lib/vdoc-api'
import type { VdocRouteSearch } from '@/lib/vdoc-route-search'
import { useDocumentReadingSelection } from './use-document-reading-selection'

const api = vi.hoisted(() => ({
  listBranches: vi.fn<typeof listBranches>(),
  listVersions: vi.fn<typeof listVersions>(),
  listDrafts: vi.fn<typeof listDrafts>(),
  getVersion: vi.fn<typeof getVersion>(),
  getDraftContent: vi.fn<typeof getDraftContent>(),
}))

vi.mock('@/lib/vdoc-api', async (load) => ({
  ...(await load<typeof import('@/lib/vdoc-api')>()),
  ...api,
}))

const document: DocumentDTO = {
  id: 'guide',
  project_id: 'project',
  name: 'Guide',
  document_type: 3,
  latest_version_id: 'latest',
  latest_draft_id: 'draft-main',
  status: 1,
  created_by: 'admin',
  created_at: '',
  updated_at: '',
}

const branch = (id: string, isDefault = false): BranchDTO => ({
  id,
  document_id: document.id,
  name: id,
  kind: 2,
  is_default: isDefault,
  is_protected: false,
  status: 1,
  created_by: 'admin',
  created_at: '',
  updated_at: '',
})
const draft = (id: string, branchId: string): DraftDTO => ({
  id,
  revision: `revision-${id}`,
  review_revision: `review-${id}`,
  project_id: document.project_id,
  document_id: document.id,
  branch_id: branchId,
  version_name: id,
  document_format: 4,
  source_type: 1,
  status: 1,
  created_by: 'admin',
  created_at: '',
  updated_at: '',
})
const version = (id: string, branchId: string): VersionDTO => ({
  ...draft(id, branchId),
  draft_id: `published-${id}`,
  published_by: 'admin',
  published_at: '',
})
const draftContent = (selected: DraftDTO) => ({
  owner_type: 'draft',
  owner_id: selected.id,
  kind: 'raw',
  content_kind: 'raw',
  content: `Content for ${selected.id}`,
  hash: '',
  draft: selected,
})
const latest = version('latest', 'main')
const historical = version('historical', 'release')
const mainDraft = draft('draft-main', 'main')
const releaseDraft = draft('draft-release', 'release')
const clients: QueryClient[] = []

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function setup(search: VdocRouteSearch = {}, selectedDocument = document) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const hook = renderHook(
    ({ currentSearch, currentDocument }) =>
      useDocumentReadingSelection('project', currentDocument, currentSearch),
    {
      wrapper,
      initialProps: {
        currentSearch: search,
        currentDocument: selectedDocument,
      },
    }
  )
  return {
    ...hook,
    client,
    change: (
      currentSearch: VdocRouteSearch,
      currentDocument = selectedDocument
    ) => hook.rerender({ currentSearch, currentDocument }),
  }
}

beforeEach(() => {
  api.listBranches.mockResolvedValue({
    items: [branch('main', true), branch('release'), branch('empty')],
    total: 3,
  })
  api.listVersions.mockImplementation(
    async (_project, _document, branchId) => ({
      items:
        branchId === 'main'
          ? [latest]
          : branchId === 'release'
            ? [historical]
            : [],
      total: branchId === 'empty' ? 0 : 1,
    })
  )
  api.listDrafts.mockImplementation(async (_project, _document, branchId) => ({
    items:
      branchId === 'main'
        ? [mainDraft]
        : branchId === 'release'
          ? [releaseDraft]
          : [],
    total: branchId === 'empty' ? 0 : 1,
  }))
  api.getVersion.mockImplementation(async (_project, _document, id) =>
    id === historical.id ? historical : latest
  )
  api.getDraftContent.mockImplementation(async (_project, _document, id) =>
    draftContent(id === releaseDraft.id ? releaseDraft : mainDraft)
  )
})

afterEach(() => {
  cleanup()
  for (const client of clients) client.clear()
  clients.length = 0
  vi.resetAllMocks()
})

describe('shared document reading selection', () => {
  it('resolves an exact historical version and its branch even outside the first list page', async () => {
    api.listVersions.mockResolvedValue({ items: [], total: 80 })
    const view = setup({ version_id: historical.id })
    await waitFor(() =>
      expect(view.result.current.selection.pending).toBe(false)
    )
    expect(view.result.current.selection).toMatchObject({
      mode: 'published',
      branchId: 'release',
      version: historical,
      invalid: false,
    })
    expect(view.result.current.versions).toEqual([historical])
    expect(api.getVersion).toHaveBeenCalledWith(
      'project',
      'guide',
      'historical',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(api.listVersions).toHaveBeenCalledWith(
      'project',
      'guide',
      'release',
      expect.objectContaining({ page: { page_size: 50, offset: 0 } })
    )
  })

  it('uses the document latest version only when no branch is selected', async () => {
    const view = setup()
    await waitFor(() =>
      expect(view.result.current.selection.pending).toBe(false)
    )
    expect(view.result.current.selection.version?.id).toBe(latest.id)
    expect(view.result.current.selection.branchId).toBe('main')
    view.change({ branch_id: 'release', content_mode: 'published' })
    await waitFor(() =>
      expect(view.result.current.selection.version?.id).toBe(historical.id)
    )
    expect(view.result.current.selection.branchId).toBe('release')
    expect(view.result.current.selection.invalid).toBe(false)
  })

  it('does not fall back to another branch when the selected branch has no versions', async () => {
    const view = setup({ branch_id: 'empty', content_mode: 'published' })
    await waitFor(() =>
      expect(view.result.current.selection.pending).toBe(false)
    )
    expect(view.result.current.selection).toMatchObject({
      mode: 'published',
      branchId: 'empty',
      version: undefined,
      invalid: false,
    })
    expect(api.getVersion).not.toHaveBeenCalled()
    expect(
      api.listVersions.mock.calls.every((call) => call[2] === 'empty')
    ).toBe(true)
  })

  it('switches published and saved draft contexts within the same branch', async () => {
    const view = setup({ branch_id: 'release', content_mode: 'published' })
    await waitFor(() =>
      expect(view.result.current.selection.version?.id).toBe(historical.id)
    )
    view.change({ branch_id: 'release', content_mode: 'draft' })
    expect(view.result.current.selection.version).toBeUndefined()
    await waitFor(() =>
      expect(view.result.current.selection.pending).toBe(false)
    )
    expect(view.result.current.selection).toMatchObject({
      mode: 'draft',
      branchId: 'release',
      draft: releaseDraft,
      version: undefined,
    })
    view.change({ branch_id: 'release', content_mode: 'published' })
    await waitFor(() =>
      expect(view.result.current.selection.version?.id).toBe(historical.id)
    )
    expect(view.result.current.selection.draft).toBeUndefined()
  })

  it('resolves an explicit draft branch without using the document latest draft', async () => {
    const view = setup({ draft_id: releaseDraft.id, content_mode: 'draft' })
    await waitFor(() =>
      expect(view.result.current.selection.pending).toBe(false)
    )
    expect(view.result.current.selection).toMatchObject({
      mode: 'draft',
      branchId: 'release',
      draft: releaseDraft,
      invalid: false,
    })
    expect(
      api.getDraftContent.mock.calls.every(
        (call) => call[2] === releaseDraft.id
      )
    ).toBe(true)
  })

  it.each([
    'missing',
    'other-document',
    'other-project',
    'other-branch',
  ] as const)('rejects an invalid version target: %s', async (scenario) => {
    if (scenario === 'missing')
      api.getVersion.mockRejectedValue(new Error('Not found'))
    else
      api.getVersion.mockResolvedValue({
        ...historical,
        ...(scenario === 'other-document'
          ? { document_id: 'another-document' }
          : {}),
        ...(scenario === 'other-project'
          ? { project_id: 'another-project' }
          : {}),
      })
    const view = setup({
      version_id: historical.id,
      ...(scenario === 'other-branch' ? { branch_id: 'main' } : {}),
    })
    await waitFor(() =>
      expect(view.result.current.selection.pending).toBe(false)
    )
    expect(view.result.current.selection.invalid).toBe(true)
    expect(view.result.current.selection.version).toBeUndefined()
  })

  it('rejects an unavailable branch without reading the default branch', async () => {
    const view = setup({ branch_id: 'missing', content_mode: 'published' })
    await waitFor(() =>
      expect(view.result.current.selection.pending).toBe(false)
    )
    expect(view.result.current.selection).toMatchObject({
      branchId: 'missing',
      invalid: true,
      version: undefined,
      draft: undefined,
    })
    expect(api.listVersions).not.toHaveBeenCalled()
    expect(api.listDrafts).not.toHaveBeenCalled()
    expect(api.getVersion).not.toHaveBeenCalled()
  })

  it('clears the old revision while a different branch loads and ignores a late response', async () => {
    const releaseVersions = deferred<Awaited<ReturnType<typeof listVersions>>>()
    api.listVersions.mockImplementation(
      async (_project, _document, branchId) =>
        branchId === 'release'
          ? releaseVersions.promise
          : {
              items: branchId === 'main' ? [latest] : [],
              total: branchId === 'main' ? 1 : 0,
            }
    )
    const view = setup({ branch_id: 'main', content_mode: 'published' })
    await waitFor(() =>
      expect(view.result.current.selection.version?.id).toBe(latest.id)
    )
    view.change({ branch_id: 'release', content_mode: 'published' })
    expect(view.result.current.selection.pending).toBe(true)
    expect(view.result.current.selection.version).toBeUndefined()
    view.change({ branch_id: 'empty', content_mode: 'published' })
    await act(async () =>
      releaseVersions.resolve({ items: [historical], total: 1 })
    )
    await waitFor(() =>
      expect(view.result.current.selection.pending).toBe(false)
    )
    expect(view.result.current.selection.branchId).toBe('empty')
    expect(view.result.current.selection.version).toBeUndefined()
  })

  it('waits for the explicit seed before choosing a default branch', async () => {
    const seed = deferred<VersionDTO>()
    api.getVersion.mockReturnValue(seed.promise)
    const view = setup({ version_id: historical.id })
    await waitFor(() => expect(api.listBranches).toHaveBeenCalled())
    expect(view.result.current.selection.pending).toBe(true)
    expect(view.result.current.selection.branchId).toBe('')
    expect(view.result.current.selection.version).toBeUndefined()
    expect(api.listVersions).not.toHaveBeenCalled()
    await act(async () => seed.resolve(historical))
    await waitFor(() =>
      expect(view.result.current.selection.version?.id).toBe(historical.id)
    )
    expect(view.result.current.selection.branchId).toBe('release')
  })

  it('never resolves a published draft as an editable reading draft', async () => {
    api.listDrafts.mockResolvedValue({
      items: [{ ...mainDraft, status: 5 }],
      total: 1,
    })
    api.getDraftContent.mockResolvedValue(
      draftContent({ ...mainDraft, status: 5 })
    )
    const view = setup({ draft_id: mainDraft.id, content_mode: 'draft' })
    await waitFor(() =>
      expect(view.result.current.selection.pending).toBe(false)
    )
    expect(view.result.current.selection.invalid).toBe(true)
    expect(view.result.current.selection.draft).toBeUndefined()
    expect(view.result.current.drafts).toEqual([])
  })

  it('does not retain the old document revision while the next document scope loads', async () => {
    const nextBranches = deferred<Awaited<ReturnType<typeof listBranches>>>()
    api.listBranches.mockImplementation(async (_project, documentId) =>
      documentId === 'next-guide'
        ? nextBranches.promise
        : { items: [branch('main', true)], total: 1 }
    )
    const view = setup({ branch_id: 'main', content_mode: 'published' })
    await waitFor(() =>
      expect(view.result.current.selection.version?.id).toBe(latest.id)
    )
    view.change(
      { branch_id: 'main', content_mode: 'published' },
      { ...document, id: 'next-guide', latest_version_id: null }
    )
    expect(view.result.current.selection.pending).toBe(true)
    expect(view.result.current.selection.version).toBeUndefined()
    expect(view.result.current.selection.draft).toBeUndefined()
    await act(async () => nextBranches.resolve({ items: [], total: 0 }))
    await waitFor(() =>
      expect(view.result.current.selection.pending).toBe(false)
    )
    expect(view.result.current.selection.invalid).toBe(true)
    expect(view.result.current.selection.version).toBeUndefined()
  })

  it('keeps draft selection pending until its full saved revision resolves', async () => {
    const saved = deferred<Awaited<ReturnType<typeof getDraftContent>>>()
    api.getDraftContent.mockReturnValue(saved.promise)
    const view = setup({ branch_id: 'release', content_mode: 'draft' })
    await waitFor(() => expect(api.getDraftContent).toHaveBeenCalled())
    expect(view.result.current.selection.pending).toBe(true)
    expect(view.result.current.selection.draft).toBeUndefined()
    expect(view.result.current.selection.version).toBeUndefined()
    await act(async () => saved.resolve(draftContent(releaseDraft)))
    await waitFor(() =>
      expect(view.result.current.selection.pending).toBe(false)
    )
    expect(view.result.current.selection.draft).toEqual(releaseDraft)
  })
})
