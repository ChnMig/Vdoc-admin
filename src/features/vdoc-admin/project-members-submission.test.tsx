import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { useVdocContextStore } from '@/stores/vdoc-context-store'
import { LanguageProvider } from '@/context/language-provider'
import { ProjectsPage } from './projects-page'

const api = vi.hoisted(() => ({
  listProjects: vi.fn(),
  listTeams: vi.fn(),
  listUsers: vi.fn(),
  listProjectMembers: vi.fn(),
  listProjectMemberCandidates: vi.fn(),
  addProjectMember: vi.fn(),
  patchProjectMemberRole: vi.fn(),
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
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}
const authUser = {
  id: 'admin',
  email: 'admin@example.test',
  name: 'Admin',
  status: 1,
  is_super_admin: true,
  can_access_audit: true,
}
const candidate = {
  ...authUser,
  id: 'candidate',
  email: 'candidate@example.test',
  name: 'Candidate',
  is_super_admin: false,
}
const existing = {
  ...candidate,
  id: 'existing',
  email: 'existing@example.test',
  name: 'Existing',
}
const candidate2 = {
  ...candidate,
  id: 'candidate-2',
  email: 'second@example.test',
}
const clients: QueryClient[] = []
const project = (id: string) => ({
  id,
  name: id === 'a' ? 'Project A' : 'Project B',
  status: 1,
})
const members = (id: string) => ({
  items: [
    {
      project_id: id,
      user_id: 'project-admin',
      user_email: 'project-admin@example.test',
      role: 3,
      status: 1,
      user_status: 1,
    },
    {
      project_id: id,
      user_id: 'existing',
      user_email: existing.email,
      role: 2,
      status: 1,
      user_status: 1,
    },
  ],
  total: 2,
})
beforeEach(() => {
  useAuthStore.getState().auth.setSession(authUser, 'synthetic-session')
  useVdocContextStore.getState().reset()
  useVdocContextStore.getState().setProjectId('a')
  api.listProjects.mockResolvedValue({
    items: [project('a'), project('b')],
    total: 2,
  })
  api.listTeams.mockResolvedValue({ items: [], total: 0 })
  api.listUsers.mockResolvedValue({
    items: [authUser, candidate, candidate2, existing],
    total: 4,
  })
  api.listProjectMembers.mockImplementation(async (id: string) => members(id))
  api.listProjectMemberCandidates.mockResolvedValue({
    items: [candidate],
    total: 1,
  })
  api.patchProjectMemberRole.mockResolvedValue({})
})
afterEach(() => {
  cleanup()
  for (const client of clients) client.clear()
  clients.length = 0
  useAuthStore.getState().auth.reset()
  vi.resetAllMocks()
})
async function page(mutationError?: (error: Error) => void) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false, onError: mutationError },
    },
  })
  clients.push(client)
  client.setQueryData(['project-members', 'b'], members('b'))
  const view = render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <ProjectsPage />
      </LanguageProvider>
    </QueryClientProvider>
  )
  await view.findByRole('combobox', { name: 'Role: existing@example.test' })
  const candidateSelect = () =>
    view
      .getAllByRole('combobox', { name: 'User' })
      .find((e) => (e as HTMLSelectElement).name === 'user_id')!
  const memberForm = () => candidateSelect().closest('form')!
  return { view, client, user: userEvent.setup(), candidateSelect, memberForm }
}
describe('project member submission ownership', () => {
  it.each(['unchanged', 'new-role', 'restored-role', 'new-user'])(
    'resets only unchanged input in its own project: %s',
    async (scenario) => {
      const pending = deferred<unknown>()
      api.addProjectMember.mockReturnValue(pending.promise)
      const { view, user, candidateSelect, memberForm } = await page()
      await user.selectOptions(candidateSelect(), 'candidate')
      await user.selectOptions(
        within(memberForm()).getByRole('combobox', { name: 'Role' }),
        '2'
      )
      fireEvent.submit(memberForm())
      await waitFor(() =>
        expect(api.addProjectMember).toHaveBeenCalledWith('a', {
          user_id: 'candidate',
          role: 2,
        })
      )
      if (scenario === 'new-role' || scenario === 'restored-role')
        await user.selectOptions(
          within(memberForm()).getByRole('combobox', { name: 'Role' }),
          '3'
        )
      if (scenario === 'restored-role')
        await user.selectOptions(
          within(memberForm()).getByRole('combobox', { name: 'Role' }),
          '2'
        )
      if (scenario === 'new-user')
        await user.selectOptions(candidateSelect(), 'candidate-2')
      await act(async () => pending.resolve({}))
      await waitFor(() =>
        expect(view.getByRole('button', { name: 'Add' })).toBeEnabled()
      )
      expect(
        within(memberForm()).getByRole('combobox', { name: 'Role' })
      ).toHaveValue(
        scenario === 'unchanged' ? '1' : scenario === 'new-role' ? '3' : '2'
      )
      if (scenario === 'new-user')
        expect(candidateSelect()).toHaveValue('candidate-2')
    }
  )

  it.each(['success', 'failure', 'returned-project'])(
    'does not apply old submission effects to a new project form: %s',
    async (scenario) => {
      const pending = deferred<unknown>()
      api.addProjectMember.mockReturnValue(pending.promise)
      const { view, user, candidateSelect, memberForm } = await page()
      await user.selectOptions(candidateSelect(), 'candidate')
      await user.selectOptions(
        within(memberForm()).getByRole('combobox', { name: 'Role' }),
        '2'
      )
      const submittedForm = memberForm()
      fireEvent.submit(submittedForm)
      await waitFor(() =>
        expect(api.addProjectMember).toHaveBeenCalledWith('a', {
          user_id: 'candidate',
          role: 2,
        })
      )
      await user.selectOptions(
        view.getByRole('combobox', { name: 'Project' }),
        'b'
      )
      if (scenario === 'returned-project')
        await user.selectOptions(
          view.getByRole('combobox', { name: 'Project' }),
          'a'
        )
      expect(memberForm()).not.toBe(submittedForm)
      await user.selectOptions(candidateSelect(), 'candidate-2')
      await user.selectOptions(
        within(memberForm()).getByRole('combobox', { name: 'Role' }),
        '3'
      )
      await act(async () => {
        if (scenario === 'failure')
          pending.reject(new Error('Private Project A error'))
        else pending.resolve({})
      })
      await waitFor(() =>
        expect(view.getByRole('button', { name: 'Add' })).toBeEnabled()
      )
      expect(
        within(memberForm()).getByRole('combobox', { name: 'Role' })
      ).toHaveValue('3')
      expect(candidateSelect()).toHaveValue('candidate-2')
      expect(
        view.queryByText('Private Project A error')
      ).not.toBeInTheDocument()
    }
  )

  it('keeps current-project errors recoverable without clearing the edit', async () => {
    api.addProjectMember.mockRejectedValueOnce(new Error('Cannot add member'))
    const { view, user, candidateSelect, memberForm } = await page()
    await user.selectOptions(candidateSelect(), 'candidate')
    await user.selectOptions(
      within(memberForm()).getByRole('combobox', { name: 'Role' }),
      '2'
    )
    fireEvent.submit(memberForm())
    expect(await view.findByText('Cannot add member')).toBeInTheDocument()
    expect(
      within(memberForm()).getByRole('combobox', { name: 'Role' })
    ).toHaveValue('2')
    expect(candidateSelect()).toHaveValue('candidate')
    api.addProjectMember.mockResolvedValueOnce({})
    fireEvent.submit(memberForm())
    await waitFor(() =>
      expect(view.queryByText('Cannot add member')).not.toBeInTheDocument()
    )
    await waitFor(() =>
      expect(
        within(memberForm()).getByRole('combobox', { name: 'Role' })
      ).toHaveValue('1')
    )
  })

  it('coalesces rapid submissions before the pending state is rendered', async () => {
    const pending = deferred<unknown>()
    api.addProjectMember.mockReturnValue(pending.promise)
    const { candidateSelect, memberForm, user } = await page()
    await user.selectOptions(candidateSelect(), 'candidate')
    fireEvent.submit(memberForm())
    fireEvent.submit(memberForm())
    await waitFor(() => expect(api.addProjectMember).toHaveBeenCalledOnce())
    await act(async () => pending.resolve({}))
  })

  it('discards an old submission before dispatch when the session changes', async () => {
    api.addProjectMember.mockResolvedValue({})
    const { candidateSelect, memberForm, user } = await page()
    await user.selectOptions(candidateSelect(), 'candidate')
    await act(async () => {
      fireEvent.submit(memberForm())
      useAuthStore
        .getState()
        .auth.setSession({ ...authUser, id: 'bob' }, 'bob-session')
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(api.addProjectMember).not.toHaveBeenCalled()
  })

  it('keeps an in-flight member error out of a newer session', async () => {
    const pending = deferred<unknown>()
    api.addProjectMember.mockReturnValue(pending.promise)
    const mutationError = vi.fn()
    const { view, candidateSelect, memberForm, user } =
      await page(mutationError)
    await user.selectOptions(candidateSelect(), 'candidate')
    fireEvent.submit(memberForm())
    await waitFor(() => expect(api.addProjectMember).toHaveBeenCalledOnce())
    act(() =>
      useAuthStore
        .getState()
        .auth.setSession({ ...authUser, id: 'bob' }, 'bob-session')
    )
    await act(async () => pending.reject(new Error('Private Alice failure')))
    await waitFor(() =>
      expect(view.getByRole('button', { name: 'Add' })).toBeEnabled()
    )
    expect(view.queryByText('Private Alice failure')).not.toBeInTheDocument()
    expect(mutationError).not.toHaveBeenCalled()
  })

  it('does not carry unsaved role edits into another project with the same member', async () => {
    const { view, user } = await page()
    await user.selectOptions(
      view.getByRole('combobox', { name: 'Role: existing@example.test' }),
      '1'
    )
    await user.selectOptions(
      view.getByRole('combobox', { name: 'Project' }),
      'b'
    )
    const role = view.getByRole('combobox', {
      name: 'Role: existing@example.test',
    })
    expect(role).toHaveValue('2')
    expect(
      within(role.parentElement!).queryByRole('button', { name: 'Save' })
    ).not.toBeInTheDocument()
    await user.selectOptions(role, '1')
    await user.click(
      within(role.parentElement!).getByRole('button', { name: 'Save' })
    )
    await user.click(
      within(await view.findByRole('alertdialog')).getByRole('button', {
        name: 'Save',
      })
    )
    await waitFor(() =>
      expect(api.patchProjectMemberRole).toHaveBeenCalledWith('b', 'existing', {
        role: 1,
      })
    )
  })
})
