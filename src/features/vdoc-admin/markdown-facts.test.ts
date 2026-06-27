import { describe, expect, it } from 'vitest'
import { parseMarkdownFacts } from './markdown-facts'

describe('parseMarkdownFacts', () => {
  it('extracts headings with depth and line numbers', () => {
    const facts = parseMarkdownFacts('# Overview\n\n### Deep dive')

    expect(facts.headings).toEqual([
      { kind: 'heading', lineNumber: 1, depth: 1, text: 'Overview' },
      { kind: 'heading', lineNumber: 3, depth: 3, text: 'Deep dive' },
    ])
  })

  it('extracts list and task items with line numbers', () => {
    const facts = parseMarkdownFacts(
      '- Ready item\n1. Ordered step\n- [x] Done task\n- [ ] Open task'
    )

    expect(facts.listItems).toEqual([
      { kind: 'list_item', lineNumber: 1, ordered: false, text: 'Ready item' },
      { kind: 'list_item', lineNumber: 2, ordered: true, text: 'Ordered step' },
    ])
    expect(facts.taskItems).toEqual([
      { kind: 'task_item', lineNumber: 3, checked: true, text: 'Done task' },
      { kind: 'task_item', lineNumber: 4, checked: false, text: 'Open task' },
    ])
  })

  it('extracts fenced code blocks while ignoring markdown inside them', () => {
    const facts = parseMarkdownFacts(
      '# API\n```ts\n# Not a heading\nconst value = 1\n```\n- Outside'
    )

    expect(facts.codeBlocks).toEqual([
      {
        kind: 'code_block',
        startLine: 2,
        endLine: 5,
        language: 'ts',
        preview: '# Not a heading\nconst value = 1',
      },
    ])
    expect(facts.headings).toHaveLength(1)
    expect(facts.listItems).toEqual([
      { kind: 'list_item', lineNumber: 6, ordered: false, text: 'Outside' },
    ])
  })

  it('extracts links from prose and list items with line numbers', () => {
    const facts = parseMarkdownFacts(
      'See [docs](https://example.test/docs).\n- [Guide](./guide.md)'
    )

    expect(facts.links).toEqual([
      {
        kind: 'link',
        lineNumber: 1,
        text: 'docs',
        url: 'https://example.test/docs',
      },
      { kind: 'link', lineNumber: 2, text: 'Guide', url: './guide.md' },
    ])
  })

  it('reports total lines for empty and non-empty markdown', () => {
    expect(parseMarkdownFacts('').totalLines).toBe(0)
    expect(parseMarkdownFacts('a\nb\n').totalLines).toBe(2)
  })
})
