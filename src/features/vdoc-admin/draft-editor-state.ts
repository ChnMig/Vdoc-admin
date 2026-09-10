import { useState } from 'react'
import type { DraftDTO } from '@/lib/vdoc-api'

type DraftValues = {
  branch_id: string
  version_name: string
  changelog: string
  source_git_commit_id: string
  content: string
  file?: File
}

type EditorSession = {
  baseline: DraftValues
  values: DraftValues
}

const fields = [
  'branch_id',
  'version_name',
  'changelog',
  'source_git_commit_id',
  'content',
] as const

function equalValues(left: DraftValues, right: DraftValues) {
  return (
    fields.every((field) => left[field] === right[field]) &&
    left.file === right.file
  )
}

export function useDraftEditorState(
  contextKey: string,
  draft: DraftDTO | undefined,
  rawContent: string | undefined
) {
  const [sessions, setSessions] = useState<Record<string, EditorSession>>({})
  const server: DraftValues = {
    branch_id: draft?.branch_id ?? '',
    version_name: draft?.version_name ?? '',
    changelog: draft?.changelog ?? '',
    source_git_commit_id: draft?.source_git_commit_id ?? '',
    content: rawContent ?? '',
  }
  const stored = sessions[contextKey]
  const dirty = Boolean(stored && !equalValues(stored.values, stored.baseline))
  const session =
    dirty && stored ? stored : { baseline: server, values: server }
  const conflict = Boolean(
    draft &&
    rawContent !== undefined &&
    dirty &&
    !equalValues(session.baseline, server)
  )

  function change<K extends keyof DraftValues>(
    field: K,
    value: DraftValues[K]
  ) {
    setSessions((previous) => {
      const current = previous[contextKey]
      const latest =
        current && !equalValues(current.values, current.baseline)
          ? current
          : session
      return {
        ...previous,
        [contextKey]: {
          baseline: latest.baseline,
          values: { ...latest.values, [field]: value },
        },
      }
    })
  }

  function reload() {
    setSessions((previous) => ({
      ...previous,
      [contextKey]: { baseline: server, values: server },
    }))
  }

  function keepEdits() {
    const values = { ...session.values }
    for (const field of fields) {
      if (values[field] === session.baseline[field])
        values[field] = server[field]
    }
    setSessions((previous) => ({
      ...previous,
      [contextKey]: { baseline: server, values },
    }))
  }

  function saved() {
    setSessions((previous) => {
      // A delayed completion must not discard edits made after submission.
      if (
        previous[contextKey] &&
        !equalValues(previous[contextKey].values, session.values)
      )
        return previous
      const next = { ...previous }
      delete next[contextKey]
      return next
    })
  }

  return {
    values: session.values,
    dirty,
    conflict,
    change,
    reload,
    keepEdits,
    saved,
  }
}
