import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { translate } from '@/lib/i18n'
import type {
  archiveBranch,
  BranchDTO,
  createBranch,
  DocumentDTO,
  listBranches,
  updateBranch,
} from '@/lib/vdoc-api'
import { DocumentWorkspaceBranches } from './document-workspace-branches'

const api = vi.hoisted(() => ({
  listBranches: vi.fn<typeof listBranches>(),
  createBranch: vi.fn<typeof createBranch>(),
  updateBranch: vi.fn<typeof updateBranch>(),
  archiveBranch: vi.fn<typeof archiveBranch>(),
}))

vi.mock('@/lib/vdoc-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/vdoc-api')>()),
  ...api,
}))

const document: DocumentDTO = {
  id: 'd',
  project_id: 'p',
  name: 'Guide',
  document_type: 2,
  status: 1,
  created_by: 'admin',
  created_at: '',
  updated_at: '',
}
const main: BranchDTO = {
  id: 'main',
  document_id: 'd',
  name: 'main',
  kind: 2,
  description: 'Published guide',
  is_default: true,
  is_protected: true,
  status: 1,
  created_by: 'admin',
  created_at: '',
  updated_at: '',
}
const release: BranchDTO = {
  ...main,
  id: 'release',
  name: 'release/2026',
  description: '',
  is_default: false,
  is_protected: false,
}
const archived: BranchDTO = {
  ...release,
  id: 'old',
  name: 'archive/2025',
  status: 2,
}
let branches: BranchDTO[]
const clients: QueryClient[] = []

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((resolveValue, rejectValue) => {
    resolve = resolveValue
    reject = rejectValue
  })
  return { promise, resolve, reject }
}

function setup(
  overrides: Partial<Parameters<typeof DocumentWorkspaceBranches>[0]> = {}
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(client)
  let props = {
    projectId: 'p',
    document,
    canManage: true,
    interactive: true,
    selectedBranchId: main.id,
    ...overrides,
  }
  const content = () => (
    <QueryClientProvider client={client}>
      <DocumentWorkspaceBranches {...props} />
    </QueryClientProvider>
  )
  const screen = render(content())
  const user = userEvent.setup()
  return {
    client,
    screen,
    user,
    rerender: (next: typeof overrides) => {
      props = { ...props, ...next }
      screen.rerender(content())
    },
    row: (name: string) =>
      within(screen.getByText(name, { exact: true }).closest('li')!),
    edit: async (name = release.name) => {
      const row = await screen.findByText(name, { exact: true })
      await user.click(
        within(row.closest('li')!).getByRole('button', { name: 'Edit' })
      )
      return within(await screen.findByRole('dialog', { name: 'Edit branch' }))
    },
    create: async (name: string) => {
      await screen.findByText(main.name, { exact: true })
      await user.click(screen.getByRole('button', { name: 'Create branch' }))
      const dialog = within(
        await screen.findByRole('dialog', { name: 'Create branch' })
      )
      await user.type(dialog.getByLabelText('Name'), name)
      return dialog
    },
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
  branches = [main, release, archived].map((branch) => ({ ...branch }))
  api.listBranches.mockImplementation(async (_projectId, documentId) => ({
    items: branches.map((branch) => ({ ...branch, document_id: documentId })),
    total: branches.length,
  }))
  api.createBranch.mockImplementation(
    async (_project, documentId, payload) => ({
      ...release,
      ...payload,
      id: 'created',
      document_id: documentId,
    })
  )
  api.updateBranch.mockImplementation(
    async (_project, _document, id, payload) => {
      branches = branches.map((branch) => ({
        ...branch,
        ...(payload.is_default ? { is_default: branch.id === id } : {}),
        ...(branch.id === id ? payload : {}),
      }))
      return branches.find((branch) => branch.id === id)!
    }
  )
  api.archiveBranch.mockResolvedValue({ ...release, status: 2 })
})

afterEach(() => {
  cleanup()
  for (const client of clients) client.clear()
  clients.length = 0
  useAuthStore.getState().auth.reset()
  vi.resetAllMocks()
})

describe('document branch management', () => {
  it('shows branch facts and prevents changes to archived/default branches', async () => {
    const view = setup()
    await view.screen.findByText(release.name)
    expect(view.row(main.name).getByText('Default branch')).toBeVisible()
    expect(view.row(main.name).getByText('Protected branch')).toBeVisible()
    expect(
      view.row(main.name).getByRole('button', { name: 'Archive' })
    ).toBeDisabled()
    expect(view.row(archived.name).getByText('Archived')).toBeVisible()
    expect(
      view.row(archived.name).queryByRole('button')
    ).not.toBeInTheDocument()
    const dialog = await view.edit(main.name)
    expect(
      dialog.getByRole('checkbox', { name: 'Default branch' })
    ).toBeDisabled()
    expect(
      dialog.getByRole('checkbox', { name: 'Protected branch' })
    ).toBeChecked()
  })

  it.each([
    { canManage: false },
    { interactive: false },
    { document: { ...document, status: 2 } },
  ])(
    'keeps branch facts visible when mutation is unavailable: %j',
    async (overrides) => {
      const view = setup(overrides)
      await view.screen.findByText(release.name)
      expect(
        view.screen.queryByRole('button', { name: 'Create branch' })
      ).not.toBeInTheDocument()
      expect(
        view.screen.queryByRole('button', { name: 'Edit' })
      ).not.toBeInTheDocument()
      expect(
        view.screen.queryByRole('button', { name: 'Archive' })
      ).not.toBeInTheDocument()
    }
  )

  it('creates a custom branch with normalized name and description', async () => {
    const view = setup()
    const dialog = await view.create('  docs/中文-v2  ')
    await view.user.type(
      dialog.getByLabelText('Description'),
      '  New release  '
    )
    await view.user.click(dialog.getByRole('button', { name: 'Create' }))
    await waitFor(() =>
      expect(api.createBranch).toHaveBeenCalledWith('p', 'd', {
        name: 'docs/中文-v2',
        description: 'New release',
      })
    )
    await waitFor(() =>
      expect(view.screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(api.listBranches.mock.calls.length).toBeGreaterThan(1)
  })

  it('retains edits after a failed save and saves default/protected changes on retry', async () => {
    api.updateBranch.mockRejectedValueOnce(
      new Error('Branch name is already used')
    )
    const view = setup()
    const dialog = await view.edit()
    await view.user.clear(dialog.getByLabelText('Name'))
    await view.user.type(dialog.getByLabelText('Name'), 'release/candidate')
    await view.user.type(dialog.getByLabelText('Description'), 'Candidate')
    await view.user.click(
      dialog.getByRole('checkbox', { name: 'Default branch' })
    )
    await view.user.click(
      dialog.getByRole('checkbox', { name: 'Protected branch' })
    )
    await view.user.click(dialog.getByRole('button', { name: 'Save' }))
    expect(await dialog.findByText('Branch name is already used')).toBeVisible()
    expect(dialog.getByLabelText('Name')).toHaveValue('release/candidate')
    await view.user.click(dialog.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(view.screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(api.updateBranch).toHaveBeenLastCalledWith('p', 'd', 'release', {
      name: 'release/candidate',
      description: 'Candidate',
      is_default: true,
      is_protected: true,
    })
    expect(
      view.row('release/candidate').getByText('Default branch')
    ).toBeVisible()
  })

  it('follows server flags after refetch without overwriting unsaved description', async () => {
    const view = setup()
    const dialog = await view.edit()
    await view.user.type(dialog.getByLabelText('Description'), 'Unsaved')
    branches = branches.map((branch) => ({
      ...branch,
      is_default: branch.id === release.id,
      is_protected: branch.id === release.id,
    }))
    await act(() =>
      view.client.invalidateQueries({ queryKey: ['branches', 'p', 'd'] })
    )
    expect(dialog.getByLabelText('Description')).toHaveValue('Unsaved')
    await waitFor(() =>
      expect(
        dialog.getByRole('checkbox', { name: 'Default branch' })
      ).toBeDisabled()
    )
    expect(
      dialog.getByRole('checkbox', { name: 'Protected branch' })
    ).toBeChecked()
    await view.user.click(dialog.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(api.updateBranch).toHaveBeenCalledWith('p', 'd', 'release', {
        name: release.name,
        description: 'Unsaved',
        is_default: true,
        is_protected: true,
      })
    )
  })

  it('confirms archive and rechecks default status before sending', async () => {
    const view = setup()
    await view.screen.findByText(release.name)
    await view.user.click(
      view.row(release.name).getByRole('button', { name: 'Archive' })
    )
    const dialog = within(await view.screen.findByRole('alertdialog'))
    branches = branches.map((branch) => ({
      ...branch,
      is_default: branch.id === release.id,
    }))
    await act(() =>
      view.client.invalidateQueries({ queryKey: ['branches', 'p', 'd'] })
    )
    await view.user.click(dialog.getByRole('button', { name: 'Archive' }))
    await waitFor(() => expect(api.archiveBranch).not.toHaveBeenCalled())
    expect(await dialog.findByRole('alert')).toBeVisible()
  })

  it('archives an active non-default branch after confirmation', async () => {
    const view = setup()
    await view.screen.findByText(release.name)
    await view.user.click(
      view.row(release.name).getByRole('button', { name: 'Archive' })
    )
    const dialog = within(await view.screen.findByRole('alertdialog'))
    expect(api.archiveBranch).not.toHaveBeenCalled()
    await view.user.click(dialog.getByRole('button', { name: 'Archive' }))
    await waitFor(() =>
      expect(api.archiveBranch).toHaveBeenCalledWith('p', 'd', release.id)
    )
    await waitFor(() =>
      expect(view.screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    )
  })

  it('selects an active branch without mutating it', async () => {
    const onBranchSelect = vi.fn()
    const view = setup({ onBranchSelect })
    await view.screen.findByText(release.name)
    const label = translate('en', 'admin.workspace.useBranch')
    expect(
      view.row(main.name).queryByRole('button', { name: label })
    ).not.toBeInTheDocument()
    await view.user.click(
      view.row(release.name).getByRole('button', { name: label })
    )
    expect(onBranchSelect).toHaveBeenCalledWith(release.id)
    expect(api.createBranch).not.toHaveBeenCalled()
    expect(api.updateBranch).not.toHaveBeenCalled()
    expect(api.archiveBranch).not.toHaveBeenCalled()
  })

  it.each(['resolve', 'reject'] as const)(
    'keeps late create %s owned by its original document',
    async (settlement) => {
      const request = deferred<BranchDTO>()
      api.createBranch.mockReturnValueOnce(request.promise)
      const view = setup()
      const first = await view.create('from-first')
      await view.user.click(first.getByRole('button', { name: 'Create' }))
      await waitFor(() => expect(api.createBranch).toHaveBeenCalledOnce())
      view.client.setQueryData(['versions', 'p', 'd'], { items: [] })
      view.client.setQueryData(['versions', 'p', 'other'], { items: [] })
      view.rerender({ document: { ...document, id: 'other' } })
      expect(view.screen.queryByRole('dialog')).not.toBeInTheDocument()
      const next = await view.create('keep-second')
      await act(async () => {
        if (settlement === 'resolve')
          request.resolve({ ...release, id: 'created' })
        else request.reject(new Error('Old request failed'))
      })
      expect(next.getByLabelText('Name')).toHaveValue('keep-second')
      expect(next.queryByText('Old request failed')).not.toBeInTheDocument()
      expect(
        view.client.getQueryState(['versions', 'p', 'd'])?.isInvalidated
      ).toBe(settlement === 'resolve')
      expect(
        view.client.getQueryState(['versions', 'p', 'other'])?.isInvalidated
      ).toBe(false)
    }
  )

  it('ignores an old session completion after authentication changes', async () => {
    const request = deferred<BranchDTO>()
    api.createBranch.mockReturnValueOnce(request.promise)
    const view = setup()
    const first = await view.create('first-session')
    await view.user.click(first.getByRole('button', { name: 'Create' }))
    await waitFor(() => expect(api.createBranch).toHaveBeenCalledOnce())
    act(() => useAuthStore.getState().auth.setAccessToken('new-session'))
    view.client.setQueryData(['versions', 'p', 'd'], { items: [] })
    const next = await view.create('second-session')
    await act(async () => request.resolve({ ...release, id: 'created' }))
    expect(next.getByLabelText('Name')).toHaveValue('second-session')
    expect(
      view.client.getQueryState(['versions', 'p', 'd'])?.isInvalidated
    ).toBe(false)
  })
})
