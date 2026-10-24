import { createContext, useContext, type ReactNode } from 'react'

const WorkspaceEmbeddingContext = createContext(false)

export function WorkspaceEmbedding({ children }: { children: ReactNode }) {
  return (
    <WorkspaceEmbeddingContext value={true}>
      {children}
    </WorkspaceEmbeddingContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspaceEmbedding() {
  return useContext(WorkspaceEmbeddingContext)
}
