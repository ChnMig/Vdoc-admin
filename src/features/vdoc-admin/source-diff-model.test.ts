import { describe, expect, it } from 'vitest'
import {
  buildSourcePatch,
  sourceDiffLines,
  splitSourceLines,
} from './source-diff-model'

describe('source diff review', () => {
  it('includes every change instead of sampling the first differences', () => {
    const before = Array.from({ length: 300 }, (_, i) => `old ${i}`).join('\n')
    const after = Array.from({ length: 300 }, (_, i) => `new ${i}`).join('\n')
    const result = buildSourcePatch(before, after, false)
    const lines = result.patch!.hunks.flatMap(sourceDiffLines)
    expect(lines.filter((line) => line.kind === 'removed')).toHaveLength(300)
    expect(lines.filter((line) => line.kind === 'added')).toHaveLength(300)
    expect(lines.find((line) => line.text === 'new 299')).toMatchObject({
      newLine: 300,
    })
  })

  it('preserves line numbers and pairs replacement rows in split view', () => {
    const hunk = buildSourcePatch(
      'same\nold\nend\n',
      'same\nnew\nextra\nend\n',
      false
    ).patch!.hunks[0]
    const rows = splitSourceLines(sourceDiffLines(hunk))
    expect(rows[1]).toMatchObject({
      before: { oldLine: 2, text: 'old' },
      after: { newLine: 2, text: 'new' },
    })
    expect(rows[2]).toMatchObject({
      before: undefined,
      after: { newLine: 3, text: 'extra' },
    })
    expect(rows[3]).toMatchObject({
      before: { oldLine: 3 },
      after: { newLine: 4 },
    })
  })

  it('expands unchanged context and handles identical or empty files', () => {
    const before = Array.from({ length: 100 }, (_, i) => `line ${i}\n`).join('')
    const after = before.replace('line 50', 'modified 50')
    expect(
      buildSourcePatch(before, after, false).patch!.hunks[0].oldStart
    ).toBeGreaterThan(1)
    expect(buildSourcePatch(before, after, true).patch!.hunks[0].oldStart).toBe(
      1
    )
    expect(buildSourcePatch('', '', false).patch!.hunks).toHaveLength(0)
    expect(
      buildSourcePatch('', 'first\n', false).patch!.hunks[0].lines
    ).toEqual(['+first'])
  })

  it('retains CRLF and missing-final-newline changes', () => {
    const lines = buildSourcePatch(
      'same\r\nlast',
      'same\nlast\n',
      false
    ).patch!.hunks.flatMap(sourceDiffLines)
    expect(
      lines.some((line) => line.text === 'same\r' && line.kind === 'removed')
    ).toBe(true)
    expect(lines.some((line) => line.kind === 'note')).toBe(true)
  })

  it('keeps missing-final-newline notes on their own side in split view', () => {
    const patch = buildSourcePatch('old', 'new', false).patch!
    const rows = splitSourceLines(patch.hunks.flatMap(sourceDiffLines))
    expect(rows[0]).toMatchObject({
      before: { text: 'old' },
      after: { text: 'new' },
    })
    expect(rows[1]).toMatchObject({
      before: { kind: 'note', noteFor: 'before' },
      after: { kind: 'note', noteFor: 'after' },
    })
  })

  it('explicitly declines oversized input without returning a partial diff', () => {
    expect(buildSourcePatch('a'.repeat(1_000_001), '', false)).toEqual({
      reason: 'large',
    })
    expect(buildSourcePatch('\n'.repeat(20_000), '', false)).toEqual({
      reason: 'large',
    })
  })
})
