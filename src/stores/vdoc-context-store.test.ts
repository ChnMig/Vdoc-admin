import { beforeEach, describe, expect, it, vi } from 'vitest'

async function importContextStore() {
  const { useVdocContextStore } = await import('./vdoc-context-store')
  return useVdocContextStore
}

describe('useVdocContextStore', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    vi.resetModules()
  })

  it('preserves the selected lifecycle context for same-tab navigation', async () => {
    const useVdocContextStore = await importContextStore()
    const context = useVdocContextStore.getState()
    context.setProjectId('project-1')
    context.setDocumentId('document-1')
    context.setVersionId('version-1')

    expect(useVdocContextStore.getState()).toMatchObject({
      projectId: 'project-1',
      documentId: 'document-1',
      versionId: 'version-1',
    })
    expect(
      JSON.parse(
        window.sessionStorage.getItem('vdoc_admin_selected_context') ?? '{}'
      )
    ).toEqual({
      projectId: 'project-1',
      documentId: 'document-1',
      versionId: 'version-1',
    })

    vi.resetModules()
    const reloadedStore = await importContextStore()
    expect(reloadedStore.getState()).toMatchObject({
      projectId: 'project-1',
      documentId: 'document-1',
      versionId: 'version-1',
    })
  })

  it('clears downstream selections when an upstream entity changes', async () => {
    const useVdocContextStore = await importContextStore()
    const context = useVdocContextStore.getState()
    context.setProjectId('project-1')
    context.setDocumentId('document-1')
    context.setVersionId('version-1')

    useVdocContextStore.getState().setProjectId('project-2')
    expect(useVdocContextStore.getState()).toMatchObject({
      projectId: 'project-2',
      documentId: '',
      versionId: '',
    })
  })
})
