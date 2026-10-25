import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EndpointDTO } from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import { DocumentWorkspaceEndpoints } from './document-workspace-endpoints'

const api = vi.hoisted(() => ({ listEndpoints: vi.fn(), getEndpoint: vi.fn() }))
vi.mock('@/lib/vdoc-api', async (load) => ({
  ...(await load<typeof import('@/lib/vdoc-api')>()),
  ...api,
}))

const endpoint: EndpointDTO = {
  id: 'endpoint-1',
  version_id: 'version-1',
  method: 'GET',
  path: '/selected-endpoint',
  operation_id: 'getSelectedEndpoint',
  summary: 'Selected endpoint summary',
  tags: ['Documents'],
  deprecated: false,
  hash: 'endpoint-hash',
  created_at: '',
  updated_at: '',
  responses: { '200': { description: 'Exact selected version response' } },
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function renderEndpoints(
  initial: {
    projectId?: string
    documentId?: string
    versionId?: string
    endpointId?: string
  } = {}
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const onEndpointChange = vi.fn()
  let target = {
    projectId: 'project-1',
    documentId: 'document-1',
    versionId: 'version-1',
    ...initial,
  }
  const element = () => (
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <DocumentWorkspaceEndpoints
          {...target}
          onEndpointChange={onEndpointChange}
        />
      </LanguageProvider>
    </QueryClientProvider>
  )
  const screen = render(element())
  return {
    ...screen,
    onEndpointChange,
    rerenderTarget(patch: Partial<typeof target>) {
      target = { ...target, ...patch }
      screen.rerender(element())
    },
  }
}

describe('document workspace endpoint ownership', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    document.cookie = 'vdoc-admin-language=en; path=/'
    api.listEndpoints.mockResolvedValue({
      items: [endpoint],
      total: 1,
      hasMore: false,
    })
    api.getEndpoint.mockResolvedValue(endpoint)
  })

  it('filters foreign-version list rows and selects an endpoint only through an explicit user action', async () => {
    api.listEndpoints.mockResolvedValue({
      items: [
        endpoint,
        {
          ...endpoint,
          id: 'foreign-endpoint',
          version_id: 'other-version',
          path: '/foreign-version',
        },
      ],
      total: 2,
    })
    const screen = renderEndpoints()
    const row = await screen.findByRole('button', { name: /selected-endpoint/ })
    expect(
      screen.queryByRole('button', { name: /foreign-version/ })
    ).not.toBeInTheDocument()
    expect(api.getEndpoint).not.toHaveBeenCalled()
    expect(screen.onEndpointChange).not.toHaveBeenCalled()
    fireEvent.click(row)
    expect(screen.onEndpointChange).toHaveBeenCalledExactlyOnceWith(
      'endpoint-1'
    )
    screen.rerenderTarget({ endpointId: 'endpoint-1' })
    expect(
      await screen.findByText('Exact selected version response', {
        exact: false,
      })
    ).toBeVisible()
    expect(api.getEndpoint).toHaveBeenCalledWith(
      'project-1',
      'document-1',
      'version-1',
      'endpoint-1',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(api.listEndpoints).toHaveBeenCalledWith(
      'project-1',
      'document-1',
      'version-1',
      undefined,
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        page: { page_size: 50, offset: 0, search: '' },
      })
    )
  })

  it.each([
    { id: 'wrong-endpoint', version_id: 'version-1' },
    { id: 'endpoint-1', version_id: 'wrong-version' },
  ])(
    'rejects detail whose identity does not match the selected target: %j',
    async (identity) => {
      api.getEndpoint.mockResolvedValue({
        ...endpoint,
        ...identity,
        path: '/secret-foreign-response',
        responses: { description: 'Untrusted endpoint detail' },
      })
      const screen = renderEndpoints({ endpointId: 'endpoint-1' })
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The selected branch or revision is unavailable'
      )
      expect(
        screen.queryByText('/secret-foreign-response')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByText('Untrusted endpoint detail', { exact: false })
      ).not.toBeInTheDocument()
      expect(screen.onEndpointChange).not.toHaveBeenCalled()
    }
  )

  it('aborts old list and detail requests and never displays their late responses in a new version', async () => {
    const oldList = deferred<{ items: EndpointDTO[] }>()
    const oldDetail = deferred<EndpointDTO>()
    const newList = deferred<{ items: EndpointDTO[] }>()
    const newDetail = deferred<EndpointDTO>()
    api.listEndpoints
      .mockReturnValueOnce(oldList.promise)
      .mockReturnValueOnce(newList.promise)
    api.getEndpoint
      .mockReturnValueOnce(oldDetail.promise)
      .mockReturnValueOnce(newDetail.promise)
    const screen = renderEndpoints({ endpointId: 'endpoint-1' })
    await waitFor(() => expect(api.getEndpoint).toHaveBeenCalledOnce())
    const oldListSignal = api.listEndpoints.mock.calls[0][4]
      .signal as AbortSignal
    const oldDetailSignal = api.getEndpoint.mock.calls[0][4]
      .signal as AbortSignal
    screen.rerenderTarget({ versionId: 'version-2', endpointId: 'endpoint-2' })
    await waitFor(() => expect(api.getEndpoint).toHaveBeenCalledTimes(2))
    expect(oldListSignal.aborted).toBe(true)
    expect(oldDetailSignal.aborted).toBe(true)
    await act(async () => {
      oldList.resolve({ items: [{ ...endpoint, path: '/late-old-list' }] })
      oldDetail.resolve({
        ...endpoint,
        path: '/late-old-detail',
        responses: { description: 'Late old version secret' },
      })
    })
    expect(screen.queryByText('/late-old-list')).not.toBeInTheDocument()
    expect(screen.queryByText('/late-old-detail')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Late old version secret', { exact: false })
    ).not.toBeInTheDocument()
    const next = {
      ...endpoint,
      id: 'endpoint-2',
      version_id: 'version-2',
      path: '/current-version',
      responses: { description: 'Current version response' },
    }
    await act(async () => {
      newList.resolve({ items: [next] })
      newDetail.resolve(next)
    })
    expect(
      await screen.findByText('Current version response', { exact: false })
    ).toBeVisible()
    expect(api.getEndpoint.mock.calls[1].slice(0, 4)).toEqual([
      'project-1',
      'document-1',
      'version-2',
      'endpoint-2',
    ])
    expect(screen.onEndpointChange).not.toHaveBeenCalled()
  })

  it.each([{ projectId: '' }, { documentId: '' }, { versionId: '' }])(
    'makes no endpoint requests for an incomplete owner scope: %j',
    async (scope) => {
      renderEndpoints({ ...scope, endpointId: 'endpoint-1' })
      await act(async () => Promise.resolve())
      expect(api.listEndpoints).not.toHaveBeenCalled()
      expect(api.getEndpoint).not.toHaveBeenCalled()
    }
  )
})
