import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageProvider } from '@/context/language-provider'
import { DocumentWorkspacePage } from './document-workspace-page'

const api = vi.hoisted(() => ({
  listProjects: vi.fn(),
  listDocuments: vi.fn(),
  listDocumentFolders: vi.fn(),
  listProjectMembers: vi.fn(),
  listBranches: vi.fn(),
  listVersions: vi.fn(),
  listDrafts: vi.fn(),
  getDraftContent: vi.fn(),
  createDraft: vi.fn(),
  updateDraft: vi.fn(),
  submitDraft: vi.fn(),
}))
vi.mock('@/lib/vdoc-api', async (load) => ({
  ...(await load<typeof import('@/lib/vdoc-api')>()),
  ...api,
}))
const branch = {
  id: 'old-branch',
  document_id: 'doc',
  name: 'main',
  kind: 2,
  is_default: true,
  is_protected: false,
  status: 1,
  created_by: 'admin',
  created_at: '',
  updated_at: '',
}
const draft = {
  id: 'old-draft',
  revision: 'r1',
  review_revision: '',
  project_id: 'p',
  document_id: 'doc',
  branch_id: branch.id,
  version_name: 'historical-user-label',
  document_format: 3,
  source_type: 1,
  status: 1,
  created_by: 'admin',
  created_at: '',
  updated_at: '',
}
let client: QueryClient
beforeEach(() => {
  vi.resetAllMocks()
  document.cookie = 'vdoc-admin-language=en; path=/'
  useAuthStore.getState().auth.setUser({
    id: 'admin',
    email: 'a@example.test',
    name: 'Admin',
    status: 1,
    is_super_admin: true,
    can_access_audit: true,
  })
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  api.listProjects.mockResolvedValue({
    items: [
      {
        id: 'p',
        team_id: 't',
        name: 'Project',
        status: 1,
        created_by: 'admin',
        created_at: '',
        updated_at: '',
      },
    ],
    total: 1,
  })
  api.listDocuments.mockResolvedValue({
    items: [
      {
        id: 'doc',
        project_id: 'p',
        name: 'Legacy guide',
        document_type: 3,
        file_name: 'guide.txt',
        status: 1,
        latest_draft_id: draft.id,
        created_by: 'admin',
        created_at: '',
        updated_at: '',
      },
    ],
    total: 1,
  })
  api.listDocumentFolders.mockResolvedValue({ items: [], total: 0 })
  api.listProjectMembers.mockResolvedValue({ items: [], total: 0 })
  api.listBranches.mockResolvedValue({ items: [branch], total: 1 })
  api.listVersions.mockResolvedValue({ items: [], total: 0 })
  api.listDrafts.mockResolvedValue({ items: [draft], total: 1 })
  api.getDraftContent.mockResolvedValue({
    draft,
    content: 'Preserved old source\r\nlast line',
  })
})
afterEach(() => {
  cleanup()
  client.clear()
})
it('reads an exact legacy draft link without offering its former write workflow', async () => {
  const changes = vi.fn()
  const view = render(
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <DocumentWorkspacePage
          search={{
            team_id: 't',
            project_id: 'p',
            document_id: 'doc',
            workspace_view: 'drafts',
            draft_id: draft.id,
            branch_id: branch.id,
          }}
          onSearchChange={changes}
        />
      </LanguageProvider>
    </QueryClientProvider>
  )
  await view.findByText('Preserved old source last line')
  expect(
    view.getByText(
      'Legacy snapshots are read-only. Save new changes through project branches and commits.'
    )
  ).toBeVisible()
  expect(
    view.queryByRole('textbox', { name: 'Version name' })
  ).not.toBeInTheDocument()
  expect(
    view.queryByRole('textbox', { name: 'Content' })
  ).not.toBeInTheDocument()
  expect(
    view.queryByRole('button', { name: 'Edit draft' })
  ).not.toBeInTheDocument()
  expect(
    view.queryByRole('button', { name: /Submit for review/ })
  ).not.toBeInTheDocument()
  await userEvent.click(
    view.getByRole('button', { name: 'Open project repository' })
  )
  expect(changes).toHaveBeenLastCalledWith(
    expect.objectContaining({
      document_id: 'doc',
      draft_id: undefined,
      branch_id: undefined,
      version_id: undefined,
      repository_view: 'content',
      workspace_view: 'content',
    }),
    { replace: false }
  )
  expect(api.createDraft).not.toHaveBeenCalled()
  expect(api.updateDraft).not.toHaveBeenCalled()
  expect(api.submitDraft).not.toHaveBeenCalled()
})
