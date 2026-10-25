import { type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { getVersion, listVersions, type VersionDTO } from '@/lib/vdoc-api'
import { useVersionChoices } from './use-version-choices'

vi.mock('@/lib/vdoc-api', () => ({
  getVersion: vi.fn(),
  listVersions: vi.fn(),
}))

beforeEach(() => vi.resetAllMocks())

it('pages choices and keeps a selected version outside the page available', async () => {
  const version = (id: string) =>
    ({
      id,
      version_name: id,
      project_id: 'p1',
      document_id: 'd1',
    }) as VersionDTO
  vi.mocked(listVersions).mockImplementation(
    async (_project, _document, _branch, options) => ({
      items: [version(options?.page?.offset === 50 ? 'page-two' : 'page-one')],
      total: 100,
    })
  )
  vi.mocked(getVersion).mockImplementation(async (_project, _document, id) =>
    version(id)
  )
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result, unmount } = renderHook(
    () => useVersionChoices('p1', 'd1', ['historic']),
    { wrapper }
  )
  await waitFor(() =>
    expect(result.current.versionOptions.map((option) => option.value)).toEqual(
      ['page-one', 'historic']
    )
  )
  act(() => result.current.setOffset(50))
  await waitFor(() =>
    expect(result.current.versionOptions.map((option) => option.value)).toEqual(
      ['page-two', 'historic']
    )
  )
  for (const call of vi.mocked(listVersions).mock.calls)
    expect(call[3]?.page?.page_size).toBe(50)
  expect(getVersion).toHaveBeenCalledWith(
    'p1',
    'd1',
    'historic',
    expect.objectContaining({ signal: expect.any(AbortSignal) })
  )
  unmount()
  client.clear()
})

it('keeps pagination and restored selections inside the selected document branch', async () => {
  const version = (id: string, branchId = 'main', documentId = 'd1') =>
    ({
      id,
      version_name: id,
      project_id: 'p1',
      document_id: documentId,
      branch_id: branchId,
    }) as VersionDTO
  vi.mocked(listVersions).mockImplementation(
    async (_project, _document, branch, options) => ({
      items: [
        version(`${branch}-${options?.page?.offset ?? 0}`, branch),
        version('wrong-branch', 'other'),
        version('wrong-document', branch, 'other-document'),
      ],
      total: 100,
    })
  )
  vi.mocked(getVersion).mockImplementation(async (_project, _document, id) =>
    id === 'foreign'
      ? version(id, 'main', 'other-document')
      : version(id, id === 'other-branch' ? 'other' : 'main')
  )
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result, rerender, unmount } = renderHook(
    ({ branchId }) =>
      useVersionChoices(
        'p1',
        'd1',
        ['historic', 'foreign', 'other-branch'],
        branchId
      ),
    { wrapper, initialProps: { branchId: 'main' } }
  )
  await waitFor(() =>
    expect(result.current.versionOptions.map((option) => option.value)).toEqual(
      ['main-0', 'historic']
    )
  )
  act(() => result.current.setOffset(50))
  await waitFor(() =>
    expect(result.current.versionOptions.map((option) => option.value)).toEqual(
      ['main-50', 'historic']
    )
  )
  rerender({ branchId: 'beta' })
  await waitFor(() =>
    expect(result.current.versionOptions.map((option) => option.value)).toEqual(
      ['beta-0']
    )
  )
  expect(result.current.offset).toBe(0)
  expect(listVersions).toHaveBeenLastCalledWith(
    'p1',
    'd1',
    'beta',
    expect.objectContaining({ page: { page_size: 50, offset: 0, search: '' } })
  )
  unmount()
  client.clear()
})
