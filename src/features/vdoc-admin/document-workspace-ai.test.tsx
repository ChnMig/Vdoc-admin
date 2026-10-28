import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentDTO, DraftDTO, VersionDTO } from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import { DocumentWorkspaceAI } from './document-workspace-ai'
import type { DocumentReadingSelection } from './document-workspace-content'

const api = vi.hoisted(() => ({
  getAISummary: vi.fn(),
  getAIChatSession: vi.fn(),
  listAIChatSessions: vi.fn(),
  createAIChatSession: vi.fn(),
  sendAIChatMessage: vi.fn(),
}))
vi.mock('@/lib/vdoc-api', async (load) => ({
  ...(await load<typeof import('@/lib/vdoc-api')>()),
  ...api,
}))

const document: DocumentDTO = {
  id: 'document-1',
  project_id: 'project-1',
  name: 'Release guide',
  document_type: 2,
  latest_version_id: 'latest-version',
  latest_draft_id: 'latest-draft',
  status: 1,
  created_by: 'user-1',
  created_at: '',
  updated_at: '',
}
const draft: DraftDTO = {
  id: 'selected-draft',
  revision: 'revision-1',
  review_revision: 'review-1',
  project_id: document.project_id,
  document_id: document.id,
  branch_id: 'branch-1',
  version_name: 'Next release',
  document_format: 3,
  source_type: 1,
  status: 1,
  created_by: 'user-1',
  created_at: '',
  updated_at: '',
}
const version: VersionDTO = {
  ...draft,
  id: 'older-version',
  version_name: 'Release 1.0',
  draft_id: 'published-draft',
  published_by: 'user-1',
  published_at: '',
}
const publishedSelection: DocumentReadingSelection = {
  mode: 'published',
  branchId: 'branch-1',
  version,
}

function renderAI(selection: DocumentReadingSelection, interactive = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const element = (
    nextSelection: DocumentReadingSelection,
    nextDocument = document
  ) => (
    <QueryClientProvider client={client}>
      <LanguageProvider>
        <DocumentWorkspaceAI
          projectId={nextDocument.project_id}
          document={nextDocument}
          selection={nextSelection}
          interactive={interactive}
          canRegenerate={false}
        />
      </LanguageProvider>
    </QueryClientProvider>
  )
  const screen = render(element(selection))
  return {
    ...screen,
    rerenderSelection: (nextSelection: DocumentReadingSelection) =>
      screen.rerender(element(nextSelection)),
    rerenderDocument: (nextDocument: DocumentDTO) =>
      screen.rerender(
        element({ mode: 'published', branchId: '' }, nextDocument)
      ),
  }
}

describe('document workspace AI context', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    globalThis.document.cookie = 'vdoc-admin-language=en; path=/'
    api.getAISummary.mockResolvedValue(null)
    api.getAIChatSession.mockResolvedValue({ messages: [] })
    api.listAIChatSessions.mockResolvedValue({ items: [], total: 0 })
    api.createAIChatSession.mockResolvedValue({ id: 'draft-chat' })
    api.sendAIChatMessage.mockResolvedValue({
      id: 'message-1',
      session_id: 'draft-chat',
      role: 'assistant',
      content: 'Draft answer',
    })
  })

  it('keeps document chat and unsent input while the revision summary follows the reading selection', async () => {
    const screen = renderAI(publishedSelection)
    const publishedTarget = {
      projectId: 'project-1',
      documentId: 'document-1',
      ownerType: 'version',
      ownerId: 'older-version',
    }
    await waitFor(() => {
      expect(api.getAISummary).toHaveBeenCalledWith(
        publishedTarget,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
      expect(api.listAIChatSessions).toHaveBeenCalledWith(
        { ...publishedTarget, ownerType: 'document', ownerId: 'document-1' },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })
    await userEvent.type(
      screen.getByLabelText('AI chat message'),
      'Unsent published question'
    )

    screen.rerenderSelection({ mode: 'draft', branchId: 'branch-1', draft })
    const draftTarget = {
      ...publishedTarget,
      ownerType: 'draft',
      ownerId: 'selected-draft',
    }
    await waitFor(() => {
      expect(api.getAISummary).toHaveBeenLastCalledWith(
        draftTarget,
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
      expect(api.listAIChatSessions).toHaveBeenLastCalledWith(
        { ...publishedTarget, ownerType: 'document', ownerId: 'document-1' },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })
    expect(screen.getByLabelText('AI chat message')).toHaveValue(
      'Unsent published question'
    )
    await userEvent.clear(screen.getByLabelText('AI chat message'))
    await userEvent.type(
      screen.getByLabelText('AI chat message'),
      'Question about the draft'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Send AI message' })
    )
    await waitFor(() =>
      expect(api.createAIChatSession).toHaveBeenCalledWith('project-1', {
        document_id: 'document-1',
        context_type: 'document',
        context_id: 'document-1',
        title: 'AI chat for document document-1',
      })
    )
    expect(api.sendAIChatMessage).toHaveBeenCalledWith(
      'project-1',
      'draft-chat',
      'Question about the draft',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        onDelta: expect.any(Function),
      })
    )
  })

  it.each<DocumentReadingSelection>([
    { mode: 'published', branchId: 'branch-1' },
    { mode: 'draft', branchId: 'branch-1' },
    { ...publishedSelection, pending: true },
    { ...publishedSelection, invalid: true },
    { ...publishedSelection, branchId: 'other-branch' },
    {
      ...publishedSelection,
      version: { ...version, document_id: 'other-document' },
    },
    {
      ...publishedSelection,
      version: { ...version, project_id: 'other-project' },
    },
  ])(
    'keeps document chat available without requesting an invalid revision summary: %j',
    async (selection) => {
      const screen = renderAI(selection)
      await act(async () => Promise.resolve())
      expect(api.getAISummary).not.toHaveBeenCalled()
      expect(api.listAIChatSessions).toHaveBeenCalledWith(
        {
          projectId: 'project-1',
          documentId: 'document-1',
          ownerType: 'document',
          ownerId: 'document-1',
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
      expect(screen.getByLabelText('AI chat message')).toBeEnabled()
    }
  )

  it('clears unsent chat when moving to a different document', async () => {
    const screen = renderAI(publishedSelection)
    await userEvent.type(
      screen.getByLabelText('AI chat message'),
      'Private question about document one'
    )
    screen.rerenderDocument({
      ...document,
      id: 'document-2',
      name: 'Second document',
    })
    expect(screen.getByLabelText('AI chat message')).toHaveValue('')
    await waitFor(() =>
      expect(api.listAIChatSessions).toHaveBeenLastCalledWith(
        {
          projectId: 'project-1',
          documentId: 'document-2',
          ownerType: 'document',
          ownerId: 'document-2',
        },
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    )
  })

  it('preserves read-only permissions for an exact historical target', async () => {
    const screen = renderAI(publishedSelection, false)
    await waitFor(() => expect(api.getAISummary).toHaveBeenCalledOnce())
    expect(screen.getByLabelText('AI chat message')).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Regenerate AI summary' })
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Send AI message' })
    ).toBeDisabled()
  })
})
