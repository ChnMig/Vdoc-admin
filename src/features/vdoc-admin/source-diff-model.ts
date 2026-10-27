import { structuredPatch, type StructuredPatch } from 'diff'

export type SourceDiffLine = {
  kind: 'context' | 'added' | 'removed' | 'note'
  text: string
  oldLine?: number
  newLine?: number
  noteFor?: 'before' | 'after' | 'both'
}

// Bound synchronous work before running Myers; never show a partial diff as complete.
export function buildSourcePatch(
  before: string,
  after: string,
  expanded: boolean
) {
  if (
    before.length + after.length > 1_000_000 ||
    before.split('\n').length + after.split('\n').length > 20_000
  )
    return { reason: 'large' as const }
  const patch = structuredPatch(
    'source',
    'target',
    before,
    after,
    undefined,
    undefined,
    {
      context: expanded ? 20_000 : 4,
      timeout: 200,
    }
  )
  return patch ? { patch } : { reason: 'timeout' as const }
}

export function sourceDiffLines(
  hunk: StructuredPatch['hunks'][number]
): SourceDiffLine[] {
  let oldLine = hunk.oldStart
  let newLine = hunk.newStart
  let previous = ' '
  return hunk.lines.map((line) => {
    const text = line.slice(1)
    const previousKind = previous
    if (line[0] !== '\\') previous = line[0]
    switch (line[0]) {
      case '+':
        return { kind: 'added', text, newLine: newLine++ }
      case '-':
        return { kind: 'removed', text, oldLine: oldLine++ }
      case ' ':
        return { kind: 'context', text, oldLine: oldLine++, newLine: newLine++ }
      default:
        return {
          kind: 'note',
          text: line,
          noteFor:
            previousKind === '-'
              ? 'before'
              : previousKind === '+'
                ? 'after'
                : 'both',
        }
    }
  })
}

export function splitSourceLines(lines: SourceDiffLine[]) {
  const rows: { before?: SourceDiffLine; after?: SourceDiffLine }[] = []
  for (let i = 0; i < lines.length;) {
    const line = lines[i]
    if (line.kind === 'context') {
      rows.push({ before: line, after: line })
      i++
      continue
    }
    const removed: SourceDiffLine[] = []
    const added: SourceDiffLine[] = []
    while (i < lines.length && lines[i].kind !== 'context') {
      const changed = lines[i++]
      if (
        changed.kind === 'removed' ||
        (changed.kind === 'note' && changed.noteFor !== 'after')
      )
        removed.push(changed)
      if (
        changed.kind === 'added' ||
        (changed.kind === 'note' && changed.noteFor !== 'before')
      )
        added.push(changed)
    }
    for (let j = 0; j < Math.max(removed.length, added.length); j++) {
      rows.push({ before: removed[j], after: added[j] })
    }
  }
  return rows
}
