import { render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DocumentFolderDTO } from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import { FolderDestinationTree } from './folder-destination-tree'

const folder = (path: string): DocumentFolderDTO => ({
  id: path,
  project_id: 'p',
  name: path.split('/').pop()!,
  path,
  parent_id: null,
  created_by: 'admin',
  created_at: '',
  updated_at: '',
})
const folders = [
  'Archive/Quarter 4/Empty',
  'Guides/Private/Subfolder',
  'Guides/Public',
].map(folder)

beforeEach(() => {
  document.cookie = 'vdoc-admin-language=en; Path=/'
})
function setup(sourcePath?: string, defaultPath = 'Guides/Private') {
  const view = render(
    <LanguageProvider>
      <form>
        <FolderDestinationTree
          folders={folders}
          defaultPath={defaultPath}
          sourcePath={sourcePath}
        />
      </form>
    </LanguageProvider>
  )
  return {
    ...view,
    user: userEvent.setup(),
    value: () =>
      new FormData(view.container.querySelector('form')!).get('parent_path'),
  }
}

describe('folder destination tree', () => {
  it('browses nested and empty folders with the keyboard and selects a clickable ancestor path', async () => {
    const view = setup()
    const tree = within(view.getByRole('tree', { name: 'Destination folder' }))
    expect(
      tree.getByRole('treeitem', { name: 'Guides/Private' })
    ).toHaveAttribute('aria-selected', 'true')
    const archive = tree.getByRole('treeitem', { name: 'Archive' })
    archive.focus()
    await view.user.keyboard('{ArrowRight}{ArrowRight}')
    expect(
      tree.getByRole('treeitem', { name: 'Archive/Quarter 4' })
    ).toHaveFocus()
    await view.user.keyboard('{ArrowRight}{ArrowRight}{Enter}')
    expect(
      tree.getByRole('treeitem', { name: 'Archive/Quarter 4/Empty' })
    ).toHaveFocus()
    expect(view.value()).toBe('folder:Archive/Quarter 4/Empty')
    const path = within(
      view.getByRole('navigation', { name: 'Selected location' })
    )
    await view.user.click(path.getByRole('button', { name: 'Archive' }))
    expect(view.value()).toBe('folder:Archive')
    await view.user.click(path.getByRole('button', { name: 'Project root' }))
    expect(view.value()).toBe('project-root')
  })

  it('rejects the source and descendants while allowing keyboard navigation through them', async () => {
    const view = setup('gUiDeS/PrIvAtE', 'Guides')
    const tree = within(view.getByRole('tree'))
    const source = tree.getByRole('treeitem', {
      name: 'Guides/Private',
    })
    expect(source).toHaveAttribute('aria-disabled', 'true')
    await view.user.click(source)
    expect(view.value()).toBe('folder:Guides')
    source.focus()
    await view.user.keyboard('{ArrowRight}{ArrowRight}{Enter}')
    const descendant = tree.getByRole('treeitem', {
      name: 'Guides/Private/Subfolder',
    })
    expect(descendant).toHaveFocus()
    expect(descendant).toHaveAttribute('aria-disabled', 'true')
    expect(view.value()).toBe('folder:Guides')
    await view.user.keyboard('{End}{Enter}')
    expect(view.value()).toBe('folder:Guides/Public')
    await view.user.keyboard('{Home}{Enter}')
    expect(view.value()).toBe('project-root')
  })

  it('keeps a visible tab stop when a selected ancestor is collapsed', async () => {
    const view = setup()
    const tree = view.getByRole('tree')
    const root = within(tree).getByRole('treeitem', { name: 'Project root' })
    await view.user.click(root.querySelector('[data-folder-disclosure]')!)
    expect(within(tree).getAllByRole('treeitem')).toHaveLength(1)
    expect(root).toHaveAttribute('tabindex', '0')
    expect(view.value()).toBe('folder:Guides/Private')
    root.focus()
    await view.user.keyboard('{ArrowRight}{ArrowRight}')
    expect(
      within(tree).getByRole('treeitem', { name: 'Archive' })
    ).toHaveFocus()
  })
})
