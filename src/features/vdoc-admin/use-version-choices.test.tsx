import { type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { getVersion, listVersions, type VersionDTO } from '@/lib/vdoc-api'
import { useVersionChoices } from './use-version-choices'

vi.mock('@/lib/vdoc-api', () => ({
  getVersion: vi.fn(),
  listVersions: vi.fn(),
}))

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
