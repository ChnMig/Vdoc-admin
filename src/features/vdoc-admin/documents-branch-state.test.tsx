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
  const user = userEvent.setup()
  await screen.findByText('dev')
  return {
    client,
    screen,
    user,
    open: async (name: string) => {
      const row = screen.getByText(name, { exact: true }).closest('tr')!
      await user.click(within(row).getByRole('button', { name: 'Edit' }))
      return within(await screen.findByRole('dialog', { name: 'Edit branch' }))
    },
    refresh: () =>
      act(() => client.invalidateQueries({ queryKey: ['branches', 'p', 'd'] })),
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
  it('shows resource facts in the list and discards canceled edits', async () => {
    const { screen, user, open } = await renderBranches()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    const branch = await open('test')
    await user.type(branch.getByLabelText('Description'), 'discard this')
    await user.click(branch.getByRole('button', { name: 'Cancel' }))
    const reopened = await open('test')
    expect(reopened.getByLabelText('Description')).toHaveValue('')
    expect(api.updateBranch).not.toHaveBeenCalled()
  })

  it('closes after successfully saving normalized values', async () => {
    const { screen, user, open } = await renderBranches()
    const branch = await open('test')
    await user.clear(branch.getByLabelText('Name'))
    await user.type(branch.getByLabelText('Name'), '  release  ')
    await user.type(branch.getByLabelText('Description'), '  release branch  ')
    await user.click(branch.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(api.updateBranch.mock.calls[0][3]).toEqual({
      name: 'release',
      description: 'release branch',
      is_default: false,
      is_protected: false,
    })
    expect(screen.getByText('release', { exact: true })).toBeInTheDocument()
  })

  it('retains the edit dialog and input when saving fails', async () => {
    api.updateBranch.mockRejectedValueOnce(new Error('Could not save branch'))
    const { screen, user, open } = await renderBranches()
    const branch = await open('test')
    await user.type(branch.getByLabelText('Description'), 'keep this')
    await user.click(branch.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Could not save branch')).toBeInTheDocument()
    expect(branch.getByLabelText('Description')).toHaveValue('keep this')
    expect(
      screen.getByRole('dialog', { name: 'Edit branch' })
    ).toBeInTheDocument()
  })

  it('keeps the initial default when only its description is saved', async () => {
    const { user, open } = await renderBranches()
    const main = await open('dev')
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
    const { user, open, refresh } = await renderBranches()
    const main = await open('dev')
    applyUpdate('feature', { is_default: true })
    await refresh()
    await waitFor(() =>
      expect(main.getByLabelText('Default branch')).toBeEnabled()
    )
    expect(main.getByLabelText('Default branch')).not.toBeChecked()

    await user.type(main.getByLabelText('Description'), 'updated description')
    await user.click(main.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.updateBranch).toHaveBeenCalledTimes(1))
    expect(api.updateBranch.mock.calls[0][3]).toEqual({
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
    const { user, open, refresh } = await renderBranches()
    const main = await open('dev')
    await user.clear(main.getByLabelText('Name'))
    await user.type(main.getByLabelText('Name'), 'development')
    await user.type(main.getByLabelText('Description'), 'unsaved description')
    await user.click(main.getByLabelText('Protected branch'))
    applyUpdate('feature', { is_default: true })
    await refresh()

    await waitFor(() =>
      expect(main.getByLabelText('Default branch')).toBeEnabled()
    )
    expect(main.getByLabelText('Name')).toHaveValue('development')
    expect(main.getByLabelText('Description')).toHaveValue(
      'unsaved description'
    )
    expect(main.getByLabelText('Protected branch')).not.toBeChecked()
    await user.click(main.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.updateBranch).toHaveBeenCalledTimes(1))
    expect(api.updateBranch.mock.calls[0][3]).toEqual({
      name: 'development',
      description: 'unsaved description',
      is_default: false,
      is_protected: false,
    })
  })

  it('preserves an explicit unsaved default selection across an unrelated save', async () => {
    const { screen, user, open, refresh } = await renderBranches()
    const feature = await open('test')
    await user.click(feature.getByLabelText('Default branch'))
    applyUpdate('main', { description: 'main metadata' })
    await refresh()

    expect(feature.getByLabelText('Default branch')).toBeChecked()
    expect(feature.getByLabelText('Default branch')).toBeEnabled()
    await user.click(feature.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.updateBranch).toHaveBeenCalledTimes(1))
    expect(api.updateBranch.mock.calls[0][3].is_default).toBe(true)
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(branches.find((branch) => branch.id === 'feature')?.is_default).toBe(
      true
    )
  })

  it('follows later server changes after successfully saving an edited flag', async () => {
    const { client, screen, user, open } = await renderBranches()
    let feature = await open('test')
    await user.click(feature.getByLabelText('Protected branch'))
    await user.click(feature.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    feature = await open('test')
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
    const { user, open } = await renderBranches()
    const main = await open('dev')
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
