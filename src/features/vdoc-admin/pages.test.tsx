import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getEndpoint,
  getVersionContent,
  listDocuments,
  listEndpoints,
  listProjects,
  listVersions,
} from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import { VersionsPage } from './pages'

const apiMocks = vi.hoisted(() => ({
  getEndpoint: vi.fn(),
  getVersionContent: vi.fn(),
  listDocuments: vi.fn(),
  listEndpoints: vi.fn(),
  listProjects: vi.fn(),
  listVersions: vi.fn(),
}))

vi.mock('@/lib/vdoc-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/vdoc-api')>()
  return {
    ...actual,
    getEndpoint: apiMocks.getEndpoint,
    getVersionContent: apiMocks.getVersionContent,
    listDocuments: apiMocks.listDocuments,
    listEndpoints: apiMocks.listEndpoints,
    listProjects: apiMocks.listProjects,
    listVersions: apiMocks.listVersions,
  }
})

vi.mock('@/components/layout/header', () => ({
  Header: ({ children }: { readonly children: ReactNode }) => (
    <header>{children}</header>
  ),
}))

vi.mock('@/components/layout/main', () => ({
  Main: ({ children }: { readonly children: ReactNode }) => (
    <main>{children}</main>
  ),
}))

vi.mock('@/components/language-switch', () => ({
  LanguageSwitch: () => <button type='button'>Language</button>,
}))

vi.mock('@/components/profile-dropdown', () => ({
  ProfileDropdown: () => <button type='button'>Profile</button>,
}))

vi.mock('@/components/search', () => ({
  Search: () => <div>Search</div>,
}))

vi.mock('@/components/theme-switch', () => ({
  ThemeSwitch: () => <button type='button'>Theme</button>,
}))

function renderVersionsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <VersionsPage />
      </LanguageProvider>
    </QueryClientProvider>
  )
}

describe('VersionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.listProjects.mockResolvedValue({
      items: [projectFixture],
      total: 1,
    })
    apiMocks.listDocuments.mockResolvedValue({
      items: [markdownDocumentFixture],
      total: 1,
    })
    apiMocks.listVersions.mockResolvedValue({
      items: [markdownVersionFixture],
      total: 1,
    })
    apiMocks.getVersionContent.mockResolvedValue({
      owner_type: 'version',
      owner_id: 'version-1',
      kind: 'document',
      content_kind: 'raw',
      content:
        '# Markdown Guide\n\n- [ ] Review facts\n\nSee [relative](./guide.md).',
      hash: 'hash-1',
    })
  })

  it('renders Markdown facts for Markdown versions without requesting endpoints', async () => {
    const screen = renderVersionsPage()

    expect(
      await screen.findByRole('heading', { name: 'Markdown facts' })
    ).toBeInTheDocument()
    expect(await screen.findByText('Markdown Guide')).toBeInTheDocument()
    expect(await screen.findByText('Review facts')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'relative' })).toHaveAttribute(
      'href',
      './guide.md'
    )
    expect(screen.queryByLabelText('Endpoint search')).not.toBeInTheDocument()

    await waitFor(() => expect(listProjects).toHaveBeenCalledOnce())
    expect(listDocuments).toHaveBeenCalledWith('project-1')
    expect(listVersions).toHaveBeenCalledWith('project-1', 'document-1')
    expect(getVersionContent).toHaveBeenCalledWith(
      'project-1',
      'document-1',
      'version-1',
      'raw'
    )
    expect(listEndpoints).not.toHaveBeenCalled()
    expect(getEndpoint).not.toHaveBeenCalled()
  })
})

const projectFixture = {
  id: 'project-1',
  team_id: 'team-1',
  name: 'Docs project',
  status: 1,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const markdownDocumentFixture = {
  id: 'document-1',
  project_id: 'project-1',
  name: 'Markdown document',
  document_type: 2,
  status: 1,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const markdownVersionFixture = {
  id: 'version-1',
  project_id: 'project-1',
  document_id: 'document-1',
  branch_id: 'branch-1',
  draft_id: 'draft-1',
  version_name: 'v1',
  changelog: 'Initial Markdown version',
  document_format: 2,
  source_type: 1,
  status: 1,
  published_by: 'user-1',
  published_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}
