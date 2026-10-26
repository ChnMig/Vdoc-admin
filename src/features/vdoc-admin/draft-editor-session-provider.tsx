import { useState, type ComponentProps, type ReactNode } from 'react'
import { DraftEditorSessionsContext } from './draft-editor-state'

type Sessions = NonNullable<
  ComponentProps<typeof DraftEditorSessionsContext>['value']
>['sessions']

export function DraftEditorSessionProvider({
  children,
}: {
  children: ReactNode
}) {
  const [sessions, setSessions] = useState<Sessions>({})
  return (
    <DraftEditorSessionsContext value={{ sessions, setSessions }}>
      {children}
    </DraftEditorSessionsContext>
  )
}
