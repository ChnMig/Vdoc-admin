import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { useVdocContextStore } from '@/stores/vdoc-context-store'
import { AuditPage } from './audit-page'
import { useProjectsAndSelection } from './page-utils'

const api = vi.hoisted(() => ({
  listProjects: vi.fn(),
  listAuditLogs: vi.fn(),
  listProjectMembers: vi.fn(),
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
  CollectionCard: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
}))

const superAdmin = {
  id: 'super',
  email: 'super@example.test',
  name: 'Super',
  is_super_admin: true,
  can_access_audit: true,
  status: 1,
}

let client: QueryClient
beforeEach(() => {
  vi.clearAllMocks()
  useVdocContextStore.getState().reset()
  useAuthStore.getState().auth.setUser(superAdmin)
  api.listProjects.mockResolvedValue({
    items: [
      { id: 'project-a', name: 'Project A', status: 1 },
      { id: 'project-b', name: 'Project B', status: 1 },
    ],
    total: 2,
  })
  api.listAuditLogs.mockResolvedValue({ items: [], total: 0 })
  api.listProjectMembers.mockResolvedValue({ items: [], total: 0 })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => {
  cleanup()
  client.clear()
  useAuthStore.getState().auth.reset()
})

function renderWithClient(children: ReactNode) {
  return render(
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

async function selectAllProjects() {
  const screen = renderWithClient(<AuditPage />)
  const selector = screen.getByLabelText('Project')
  await waitFor(() => expect(selector).toHaveValue('project-a'))
  fireEvent.change(selector, { target: { value: '' } })
  await waitFor(() => expect(selector).toHaveValue(''))
  await waitFor(() =>
    expect(api.listAuditLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ project_id: undefined }),
      expect.anything()
    )
  )
  return { screen, selector }
}

describe('AuditPage project scope', () => {
  it('keeps an explicit global selection after refreshing projects and filters', async () => {
    const { screen, selector } = await selectAllProjects()
    await act(() => client.invalidateQueries({ queryKey: ['projects'] }))
    fireEvent.change(screen.getByLabelText('Action'), {
      target: { value: 'document.updated' },
    })
    await waitFor(() =>
      expect(api.listAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({
          project_id: undefined,
          action: 'document.updated',
        }),
        expect.anything()
      )
    )
    expect(selector).toHaveValue('')
    expect(useVdocContextStore.getState().projectId).toBe('')
    fireEvent.change(selector, { target: { value: 'project-b' } })
    await waitFor(() =>
      expect(api.listAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ project_id: 'project-b' }),
        expect.anything()
      )
    )
  })

  it('keeps the normal resource-page fallback after leaving a global audit view', async () => {
    const { screen } = await selectAllProjects()
    screen.unmount()
    function ResourceSelection() {
      const { projectId } = useProjectsAndSelection()
      return <output>{projectId}</output>
    }
    const resource = renderWithClient(<ResourceSelection />)
    expect(await resource.findByText('project-a')).toBeInTheDocument()
  })

  it('resets the explicit global scope when the authenticated session changes', async () => {
    const { selector } = await selectAllProjects()
    act(() =>
      useAuthStore.getState().auth.setSession(superAdmin, 'new-session')
    )
    await waitFor(() => expect(selector).toHaveValue('project-a'))
    await waitFor(() =>
      expect(api.listAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ project_id: 'project-a' }),
        expect.anything()
      )
    )
  })

  it('drops the global scope when SuperAdmin permission is removed', async () => {
    const { screen, selector } = await selectAllProjects()
    const previousCalls = api.listAuditLogs.mock.calls.length
    act(() =>
      useAuthStore
        .getState()
        .auth.setUser({ ...superAdmin, is_super_admin: false })
    )
    await waitFor(() => expect(selector).toHaveValue('project-a'))
    expect(
      await screen.findByText(
        'Select a project where you hold the Project Admin role.'
      )
    ).toBeInTheDocument()
    expect(api.listAuditLogs).toHaveBeenCalledTimes(previousCalls)
    expect(
      screen.queryByRole('option', { name: 'All projects' })
    ).not.toBeInTheDocument()
  })

  it.each([1, 2, 3])(
    'requires active project Admin membership for role %s',
    async (role) => {
      useAuthStore
        .getState()
        .auth.setUser({ ...superAdmin, is_super_admin: false })
      api.listProjectMembers.mockResolvedValue({
        items: [{ user_id: superAdmin.id, status: 1, role }],
        total: 1,
      })
      const screen = renderWithClient(<AuditPage />)
      const selector = screen.getByLabelText('Project')
      await waitFor(() => expect(selector).toHaveValue('project-a'))
      expect(
        screen.queryByRole('option', { name: 'All projects' })
      ).not.toBeInTheDocument()
      if (role === 3) {
        await waitFor(() => expect(api.listAuditLogs).toHaveBeenCalled())
        expect(api.listAuditLogs).toHaveBeenLastCalledWith(
          expect.objectContaining({ project_id: 'project-a' }),
          expect.anything()
        )
        fireEvent.change(selector, { target: { value: '' } })
        await waitFor(() => expect(selector).toHaveValue('project-a'))
        expect(
          api.listAuditLogs.mock.calls.every(([query]) => query.project_id)
        ).toBe(true)
      } else {
        expect(
          await screen.findByText(
            'Select a project where you hold the Project Admin role.'
          )
        ).toBeInTheDocument()
        expect(api.listAuditLogs).not.toHaveBeenCalled()
      }
    }
  )
})
