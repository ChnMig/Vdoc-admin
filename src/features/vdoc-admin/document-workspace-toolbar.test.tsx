import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BranchDTO, DraftDTO, VersionDTO } from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import type { DocumentReadingSelection } from './document-workspace-content'
import { DocumentWorkspaceToolbar } from './document-workspace-toolbar'

const branch: BranchDTO = {
  id: 'branch-1',
  document_id: 'document-1',
  name: 'main',
  kind: 2,
  is_default: true,
  is_protected: false,
  status: 1,
  created_by: 'user-1',
  created_at: '',
  updated_at: '',
}
const draft: DraftDTO = {
  id: 'draft-1',
  project_id: 'project-1',
  document_id: branch.document_id,
  branch_id: branch.id,
  revision: 'draft-revision',
  review_revision: 'review-revision',
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
  id: 'version-1',
  version_name: 'Release 1.0',
  draft_id: draft.id,
  published_by: 'user-1',
  published_at: '',
}

function renderToolbar(
  selection: DocumentReadingSelection,
  { emptyRevisions = false }: { emptyRevisions?: boolean } = {}
) {
  const callbacks = {
    onBranchChange: vi.fn(),
    onModeChange: vi.fn(),
    onRevisionChange: vi.fn(),
    onManageBranches: vi.fn(),
  }
  const element = (nextSelection: DocumentReadingSelection) => (
    <LanguageProvider>
      <DocumentWorkspaceToolbar
        selection={nextSelection}
        branches={[branch]}
        versions={emptyRevisions ? [] : [version]}
        drafts={emptyRevisions ? [] : [draft]}
        canManage={false}
        {...callbacks}
      />
    </LanguageProvider>
  )
  const screen = render(element(selection))
  return {
    ...screen,
    ...callbacks,
    rerenderSelection: (nextSelection: DocumentReadingSelection) =>
      screen.rerender(element(nextSelection)),
  }
}

describe('DocumentWorkspaceToolbar recovery selections', () => {
  beforeEach(() => {
    document.cookie = 'vdoc-admin-language=en; path=/'
  })

  it('does not pretend an invalid branch is selected and lets the sole valid branch recover the route', async () => {
    const user = userEvent.setup()
    const screen = renderToolbar({
      mode: 'published',
      branchId: 'missing-branch',
      invalid: true,
    })
    const control = screen.getByRole('combobox', { name: 'Branch' })
    expect(control).not.toHaveTextContent('main')
    expect(control).toHaveAttribute('value', '')
    expect(screen.onBranchChange).not.toHaveBeenCalled()

    await user.click(control)
    const option = await screen.findByRole('option', { name: 'main' })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    expect(option).toHaveAttribute('aria-selected', 'false')
    await user.click(option)
    expect(screen.onBranchChange).toHaveBeenCalledExactlyOnceWith(branch.id)
    expect(screen.onRevisionChange).not.toHaveBeenCalled()
    expect(screen.onModeChange).not.toHaveBeenCalled()

    screen.rerenderSelection({
      mode: 'published',
      branchId: branch.id,
      version,
    })
    expect(control).toHaveTextContent('main')
    expect(control).toHaveAttribute('value', branch.id)
  })

  it.each([false, true])(
    'lets the sole valid version recover an invalid route without falsely selecting it (invalid DTO: %s)',
    async (hasInvalidVersion) => {
      const user = userEvent.setup()
      const screen = renderToolbar({
        mode: 'published',
        branchId: branch.id,
        invalid: true,
        version: hasInvalidVersion
          ? { ...version, id: 'missing-version', version_name: 'Unavailable' }
          : undefined,
      })
      const control = screen.getByRole('combobox', { name: 'Version' })
      expect(control).toBeEnabled()
      expect(control).not.toHaveTextContent(version.version_name)
      expect(control).toHaveAttribute('value', '')
      expect(screen.onRevisionChange).not.toHaveBeenCalled()

      await user.click(control)
      const option = await screen.findByRole('option', {
        name: version.version_name,
      })
      expect(screen.getAllByRole('option')).toHaveLength(1)
      expect(option).toHaveAttribute('aria-selected', 'false')
      await user.click(option)
      expect(screen.onRevisionChange).toHaveBeenCalledExactlyOnceWith(
        version.id
      )
      expect(screen.onBranchChange).not.toHaveBeenCalled()

      screen.rerenderSelection({
        mode: 'published',
        branchId: branch.id,
        version,
      })
      expect(control).toHaveTextContent(version.version_name)
      expect(control).toHaveAttribute('value', version.id)
    }
  )

  it.each([
    { mode: 'published' as const, pending: true, emptyRevisions: false },
    { mode: 'draft' as const, pending: true, emptyRevisions: false },
    { mode: 'published' as const, pending: false, emptyRevisions: true },
    { mode: 'draft' as const, pending: false, emptyRevisions: true },
  ])(
    'keeps unavailable revision choices disabled: %j',
    async ({ mode, pending, emptyRevisions }) => {
      const user = userEvent.setup()
      const screen = renderToolbar(
        { mode, branchId: branch.id, pending },
        { emptyRevisions }
      )
      const control = screen.getByRole('combobox', {
        name: mode === 'published' ? 'Version' : 'Draft',
      })
      expect(control).toBeDisabled()
      expect(screen.getByRole('combobox', { name: 'Branch' })).toBeEnabled()
      await user.click(control)
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
      expect(screen.onRevisionChange).not.toHaveBeenCalled()
      expect(screen.onBranchChange).not.toHaveBeenCalled()
    }
  )
})
