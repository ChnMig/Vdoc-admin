import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { useVdocContextStore } from '@/stores/vdoc-context-store'
import type { BranchDTO, updateBranch } from '@/lib/vdoc-api'
import { DocumentsPage } from './documents-page'

const api = vi.hoisted(() => ({
  listProjects: vi.fn(),
  listDocuments: vi.fn(),
  listBranches: vi.fn(),
  getDocumentOverview: vi.fn(),
  updateBranch: vi.fn<typeof updateBranch>(),
}))

vi.mock('@/lib/vdoc-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/vdoc-api')>()),
  ...api,
}))

vi.mock('./page-shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./page-shared')>()),
  PageChrome: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}))

vi.mock('./document-share-panel', () => ({
  DocumentSharePanel: () => null,
}))

let branches: BranchDTO[]
const clients: QueryClient[] = []

function applyUpdate(id: string, payload: Parameters<typeof updateBranch>[3]) {
  branches = branches.map((branch) => ({
    ...branch,
    ...(payload.is_default ? { is_default: branch.id === id } : {}),
    ...(branch.id === id ? payload : {}),
  }))
  return branches.find((branch) => branch.id === id)!
}

async function renderBranches() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  const screen = render(
    <QueryClientProvider client={client}>
      <DocumentsPage />
    </QueryClientProvider>
  )
  const mainForm = (await screen.findByDisplayValue('dev')).closest('form')!
  const featureForm = (await screen.findByDisplayValue('test')).closest('form')!
  return {
    client,
    user: userEvent.setup(),
    main: within(mainForm),
    feature: within(featureForm),
  }
}

beforeEach(() => {
  useAuthStore.getState().auth.setUser({
    id: 'admin',
    email: 'admin@example.test',
    name: 'Admin',
    is_super_admin: true,
    can_access_audit: true,
    status: 1,
  })
  useVdocContextStore.getState().reset()
  api.listProjects.mockResolvedValue({
    items: [{ id: 'p', name: 'Project', status: 1 }],
    total: 1,
  })
  api.listDocuments.mockResolvedValue({
    items: [
      {
        id: 'd',
        name: 'Document',
        document_type: 2,
        relative_path: 'guide.md',
        status: 1,
      },
    ],
    total: 1,
  })
  api.getDocumentOverview.mockResolvedValue({
    version_count: 0,
    endpoint_count: 0,
    latest_version: null,
    published_branch_ids: [],
    raw_size_bytes: 0,
  })
  const shared = {
    document_id: 'd',
    kind: 1,
    status: 1,
    created_by: 'admin',
    created_at: '',
    updated_at: '',
  }
  branches = [
    {
      ...shared,
      id: 'main',
      name: 'dev',
      is_default: true,
      is_protected: true,
    },
    {
      ...shared,
      id: 'feature',
      name: 'test',
      is_default: false,
      is_protected: false,
    },
  ]
  api.listBranches.mockImplementation(async () => ({
    items: branches.map((branch) => ({ ...branch })),
    total: branches.length,
  }))
  api.updateBranch.mockImplementation(
    async (_project, _document, id, payload) => applyUpdate(id, payload)
  )
})

afterEach(() => {
  for (const client of clients) client.clear()
  clients.length = 0
  useAuthStore.getState().auth.reset()
  useVdocContextStore.getState().reset()
  vi.resetAllMocks()
})

describe('branch form state after server refresh', () => {
  it('keeps the initial default when only its description is saved', async () => {
    const { user, main } = await renderBranches()
    expect(main.getByLabelText('Default branch')).toBeChecked()
    expect(main.getByLabelText('Default branch')).toBeDisabled()

    await user.type(main.getByLabelText('Description'), 'updated description')
    await user.click(main.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(api.updateBranch).toHaveBeenCalledWith('p', 'd', 'main', {
        name: 'dev',
        description: 'updated description',
        is_default: true,
        is_protected: true,
      })
    )
  })

  it('does not restore a former default when only its description is saved', async () => {
    const { user, main, feature } = await renderBranches()
    await user.click(feature.getByLabelText('Default branch'))
    await user.click(feature.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(main.getByLabelText('Default branch')).toBeEnabled()
    )
    expect(main.getByLabelText('Default branch')).not.toBeChecked()
    expect(feature.getByLabelText('Default branch')).toBeChecked()
    expect(feature.getByLabelText('Default branch')).toBeDisabled()

    await user.type(main.getByLabelText('Description'), 'updated description')
    await user.click(main.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.updateBranch).toHaveBeenCalledTimes(2))
    expect(api.updateBranch.mock.calls[1][3]).toEqual({
      name: 'dev',
      description: 'updated description',
      is_default: false,
      is_protected: true,
    })
    expect(branches.find((branch) => branch.id === 'feature')?.is_default).toBe(
      true
    )
  })

  it('preserves unsaved name, description and protected edits when another branch becomes default', async () => {
    const { user, main, feature } = await renderBranches()
    await user.clear(main.getByLabelText('Name'))
    await user.type(main.getByLabelText('Name'), 'development')
    await user.type(main.getByLabelText('Description'), 'unsaved description')
    await user.click(main.getByLabelText('Protected branch'))
    await user.click(feature.getByLabelText('Default branch'))
    await user.click(feature.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(main.getByLabelText('Default branch')).toBeEnabled()
    )
    expect(main.getByLabelText('Name')).toHaveValue('development')
    expect(main.getByLabelText('Description')).toHaveValue(
      'unsaved description'
    )
    expect(main.getByLabelText('Protected branch')).not.toBeChecked()
    await user.click(main.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.updateBranch).toHaveBeenCalledTimes(2))
    expect(api.updateBranch.mock.calls[1][3]).toEqual({
      name: 'development',
      description: 'unsaved description',
      is_default: false,
      is_protected: false,
    })
  })

  it('preserves an explicit unsaved default selection across an unrelated save', async () => {
    const { user, main, feature } = await renderBranches()
    await user.click(feature.getByLabelText('Default branch'))
    await user.type(main.getByLabelText('Description'), 'main metadata')
    await user.click(main.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(main.getByRole('button', { name: 'Save' })).toBeEnabled()
    )

    expect(feature.getByLabelText('Default branch')).toBeChecked()
    expect(feature.getByLabelText('Default branch')).toBeEnabled()
    await user.click(feature.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.updateBranch).toHaveBeenCalledTimes(2))
    expect(api.updateBranch.mock.calls[1][3].is_default).toBe(true)
    expect(branches.find((branch) => branch.id === 'feature')?.is_default).toBe(
      true
    )
  })

  it('follows later server changes after successfully saving an edited flag', async () => {
    const { client, user, feature } = await renderBranches()
    await user.click(feature.getByLabelText('Protected branch'))
    await user.click(feature.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(feature.getByRole('button', { name: 'Save' })).toBeEnabled()
    )
    branches = branches.map((branch) =>
      branch.id === 'feature'
        ? { ...branch, name: 'server name', is_protected: false }
        : branch
    )
    await act(() =>
      client.invalidateQueries({ queryKey: ['branches', 'p', 'd'] })
    )

    await waitFor(() =>
      expect(feature.getByLabelText('Name')).toHaveValue('server name')
    )
    expect(feature.getByLabelText('Protected branch')).not.toBeChecked()
    await user.type(feature.getByLabelText('Description'), 'more metadata')
    await user.click(feature.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.updateBranch).toHaveBeenCalledTimes(2))
    expect(api.updateBranch.mock.calls[1][3].is_protected).toBe(false)
  })

  it('preserves edits made while an earlier save is pending', async () => {
    let finishSave!: () => void
    api.updateBranch.mockImplementationOnce(
      (_project, _document, id, payload) =>
        new Promise((resolve) => {
          finishSave = () => resolve(applyUpdate(id, payload))
        })
    )
    const { user, main } = await renderBranches()
    await user.type(main.getByLabelText('Description'), 'submitted')
    await user.click(main.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.updateBranch).toHaveBeenCalledTimes(1))
    await user.clear(main.getByLabelText('Description'))
    await user.type(
      main.getByLabelText('Description'),
      'new unsaved description'
    )
    await user.clear(main.getByLabelText('Name'))
    await user.type(main.getByLabelText('Name'), 'new unsaved name')
    await user.click(main.getByLabelText('Protected branch'))
    await act(async () => finishSave())
    await waitFor(() =>
      expect(main.getByRole('button', { name: 'Save' })).toBeEnabled()
    )

    expect(main.getByLabelText('Name')).toHaveValue('new unsaved name')
    expect(main.getByLabelText('Description')).toHaveValue(
      'new unsaved description'
    )
    expect(main.getByLabelText('Protected branch')).not.toBeChecked()
    await user.click(main.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.updateBranch).toHaveBeenCalledTimes(2))
    expect(api.updateBranch.mock.calls[1][3]).toEqual({
      name: 'new unsaved name',
      description: 'new unsaved description',
      is_default: true,
      is_protected: false,
    })
  })
})
