import { create } from 'zustand'

const VDOC_SELECTED_CONTEXT = 'vdoc_admin_selected_context'

type SelectedContext = {
  projectId: string
  documentId: string
  versionId: string
}

interface VdocContextState extends SelectedContext {
  setProjectId: (projectId: string) => void
  setDocumentId: (documentId: string) => void
  setVersionId: (versionId: string) => void
  reset: () => void
}

const emptyContext: SelectedContext = {
  projectId: '',
  documentId: '',
  versionId: '',
}

function readContext(): SelectedContext {
  if (typeof window === 'undefined') return emptyContext
  try {
    const value = JSON.parse(
      window.sessionStorage.getItem(VDOC_SELECTED_CONTEXT) ?? '{}'
    ) as Partial<SelectedContext>
    return {
      projectId: typeof value.projectId === 'string' ? value.projectId : '',
      documentId: typeof value.documentId === 'string' ? value.documentId : '',
      versionId: typeof value.versionId === 'string' ? value.versionId : '',
    }
  } catch {
    return emptyContext
  }
}

function writeContext(context: SelectedContext): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(
      VDOC_SELECTED_CONTEXT,
      JSON.stringify(context)
    )
  } catch {
    // In-memory context still keeps navigation coherent when storage is unavailable.
  }
}

function clearContext(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(VDOC_SELECTED_CONTEXT)
  } catch {
    // In-memory reset remains authoritative for the active page.
  }
}

export const useVdocContextStore = create<VdocContextState>()((set) => ({
  ...readContext(),
  setProjectId: (projectId) =>
    set((state) => {
      const next = {
        projectId,
        documentId: projectId === state.projectId ? state.documentId : '',
        versionId: projectId === state.projectId ? state.versionId : '',
      }
      writeContext(next)
      return next
    }),
  setDocumentId: (documentId) =>
    set((state) => {
      const next = {
        projectId: state.projectId,
        documentId,
        versionId: documentId === state.documentId ? state.versionId : '',
      }
      writeContext(next)
      return next
    }),
  setVersionId: (versionId) =>
    set((state) => {
      const next = {
        projectId: state.projectId,
        documentId: state.documentId,
        versionId,
      }
      writeContext(next)
      return next
    }),
  reset: () => {
    clearContext()
    set(emptyContext)
  },
}))
