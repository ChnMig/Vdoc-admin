export type MarkdownHeadingFact = {
  readonly kind: 'heading'
  readonly lineNumber: number
  readonly depth: number
  readonly text: string
}

export type MarkdownListItemFact = {
  readonly kind: 'list_item'
  readonly lineNumber: number
  readonly ordered: boolean
  readonly text: string
}

export type MarkdownTaskItemFact = {
  readonly kind: 'task_item'
  readonly lineNumber: number
  readonly checked: boolean
  readonly text: string
}

export type MarkdownCodeBlockFact = {
  readonly kind: 'code_block'
  readonly startLine: number
  readonly endLine: number
  readonly language?: string
  readonly preview: string
}

export type MarkdownLinkFact = {
  readonly kind: 'link'
  readonly lineNumber: number
  readonly text: string
  readonly url: string
}

export type MarkdownFacts = {
  readonly totalLines: number
  readonly headings: readonly MarkdownHeadingFact[]
  readonly listItems: readonly MarkdownListItemFact[]
  readonly taskItems: readonly MarkdownTaskItemFact[]
  readonly codeBlocks: readonly MarkdownCodeBlockFact[]
  readonly links: readonly MarkdownLinkFact[]
}

type ActiveCodeBlock = {
  readonly startLine: number
  readonly language?: string
  readonly lines: string[]
}

const headingPattern = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const taskPattern = /^\s*[-*+]\s+\[([ xX])]\s+(.+)$/
const unorderedListPattern = /^\s*[-*+]\s+(.+)$/
const orderedListPattern = /^\s*\d+[.)]\s+(.+)$/
const fencePattern = /^```([^\s`]*)?.*$/
const linkPattern = /\[([^\]\n]+)]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

export function parseMarkdownFacts(content: string): MarkdownFacts {
  const lines = markdownLines(content)
  const headings: MarkdownHeadingFact[] = []
  const listItems: MarkdownListItemFact[] = []
  const taskItems: MarkdownTaskItemFact[] = []
  const codeBlocks: MarkdownCodeBlockFact[] = []
  const links: MarkdownLinkFact[] = []
  let activeCodeBlock: ActiveCodeBlock | null = null

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1
    const fence = fencePattern.exec(line)

    if (activeCodeBlock) {
      if (fence) {
        codeBlocks.push({
          kind: 'code_block',
          startLine: activeCodeBlock.startLine,
          endLine: lineNumber,
          language: activeCodeBlock.language,
          preview: activeCodeBlock.lines.join('\n'),
        })
        activeCodeBlock = null
        continue
      }
      activeCodeBlock.lines.push(line)
      continue
    }

    if (fence) {
      const language = fence[1]?.trim()
      activeCodeBlock = {
        startLine: lineNumber,
        language: language && language.length > 0 ? language : undefined,
        lines: [],
      }
      continue
    }

    collectMarkdownLineFacts(line, lineNumber, {
      headings,
      listItems,
      taskItems,
      links,
    })
  }

  if (activeCodeBlock) {
    codeBlocks.push({
      kind: 'code_block',
      startLine: activeCodeBlock.startLine,
      endLine: lines.length,
      language: activeCodeBlock.language,
      preview: activeCodeBlock.lines.join('\n'),
    })
  }

  return {
    totalLines: lines.length,
    headings,
    listItems,
    taskItems,
    codeBlocks,
    links,
  }
}

function markdownLines(content: string): string[] {
  const trimmedTrailingLine = content.replace(/\r?\n$/, '')
  return trimmedTrailingLine.length > 0
    ? trimmedTrailingLine.split(/\r?\n/)
    : []
}

function collectMarkdownLineFacts(
  line: string,
  lineNumber: number,
  facts: {
    readonly headings: MarkdownHeadingFact[]
    readonly listItems: MarkdownListItemFact[]
    readonly taskItems: MarkdownTaskItemFact[]
    readonly links: MarkdownLinkFact[]
  }
) {
  const heading = headingPattern.exec(line)
  if (heading) {
    facts.headings.push({
      kind: 'heading',
      lineNumber,
      depth: heading[1].length,
      text: heading[2].trim(),
    })
  }

  const task = taskPattern.exec(line)
  if (task) {
    facts.taskItems.push({
      kind: 'task_item',
      lineNumber,
      checked: task[1].toLowerCase() === 'x',
      text: task[2].trim(),
    })
  } else {
    collectListItem(line, lineNumber, facts.listItems)
  }

  collectLinks(line, lineNumber, facts.links)
}

function collectListItem(
  line: string,
  lineNumber: number,
  listItems: MarkdownListItemFact[]
) {
  const ordered = orderedListPattern.exec(line)
  if (ordered) {
    listItems.push({
      kind: 'list_item',
      lineNumber,
      ordered: true,
      text: ordered[1].trim(),
    })
    return
  }

  const unordered = unorderedListPattern.exec(line)
  if (unordered) {
    listItems.push({
      kind: 'list_item',
      lineNumber,
      ordered: false,
      text: unordered[1].trim(),
    })
  }
}

function collectLinks(
  line: string,
  lineNumber: number,
  links: MarkdownLinkFact[]
) {
  const matches = line.matchAll(linkPattern)
  for (const match of matches) {
    const text = match[1]
    const url = match[2]
    if (text && url) {
      links.push({ kind: 'link', lineNumber, text, url })
    }
  }
}
