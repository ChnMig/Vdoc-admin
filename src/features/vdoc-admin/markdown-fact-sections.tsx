import type { ReactNode } from 'react'
import { useLanguage } from '@/context/language-provider'
import { Badge } from '@/components/ui/badge'
import type {
  MarkdownCodeBlockFact,
  MarkdownFacts,
  MarkdownHeadingFact,
  MarkdownListItemFact,
  MarkdownTaskItemFact,
} from './markdown-facts'
import { LinkFacts } from './markdown-link-facts'

export function MarkdownFactSummary({
  facts,
}: {
  readonly facts: MarkdownFacts
}) {
  const { t } = useLanguage()
  return (
    <div className='grid gap-2 sm:grid-cols-4'>
      <FactCount
        count={facts.headings.length}
        label={t('admin.markdownFacts.headings')}
      />
      <FactCount
        count={facts.taskItems.length}
        label={t('admin.markdownFacts.tasks')}
      />
      <FactCount
        count={facts.codeBlocks.length}
        label={t('admin.markdownFacts.codeBlocks')}
      />
      <FactCount
        count={facts.links.length}
        label={t('admin.markdownFacts.links')}
      />
    </div>
  )
}

export function MarkdownFactSections({
  facts,
}: {
  readonly facts: MarkdownFacts
}) {
  return (
    <div className='grid gap-4 lg:grid-cols-2'>
      <HeadingFacts headings={facts.headings} />
      <TaskFacts tasks={facts.taskItems} />
      <ListFacts listItems={facts.listItems} />
      <CodeFacts codeBlocks={facts.codeBlocks} />
      <LinkFacts links={facts.links} />
    </div>
  )
}

function FactCount({
  count,
  label,
}: {
  readonly count: number
  readonly label: string
}) {
  const { t } = useLanguage()
  return (
    <div className='rounded-md border bg-[var(--surface-control)] p-3 text-sm'>
      <p className='font-mono text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase'>
        {label}
      </p>
      <p className='mt-1 text-lg font-semibold tabular-nums'>
        {t('admin.markdownFacts.countSummary', { count, label })}
      </p>
    </div>
  )
}

function HeadingFacts({
  headings,
}: {
  readonly headings: readonly MarkdownHeadingFact[]
}) {
  const { t } = useLanguage()
  return (
    <FactSection
      title={t('admin.markdownFacts.headings')}
      empty={headings.length === 0}
    >
      {headings.map((heading) => (
        <FactRow
          key={`${heading.lineNumber}-${heading.text}`}
          lineNumber={heading.lineNumber}
        >
          <Badge variant='outline'>H{heading.depth}</Badge>
          <span>{heading.text}</span>
        </FactRow>
      ))}
    </FactSection>
  )
}

function TaskFacts({
  tasks,
}: {
  readonly tasks: readonly MarkdownTaskItemFact[]
}) {
  const { t } = useLanguage()
  return (
    <FactSection
      title={t('admin.markdownFacts.tasks')}
      empty={tasks.length === 0}
    >
      {tasks.map((task) => (
        <FactRow
          key={`${task.lineNumber}-${task.text}`}
          lineNumber={task.lineNumber}
        >
          <Badge variant={task.checked ? 'default' : 'secondary'}>
            {task.checked
              ? t('admin.markdownFacts.checked')
              : t('admin.markdownFacts.open')}
          </Badge>
          <span>{task.text}</span>
        </FactRow>
      ))}
    </FactSection>
  )
}

function ListFacts({
  listItems,
}: {
  readonly listItems: readonly MarkdownListItemFact[]
}) {
  const { t } = useLanguage()
  return (
    <FactSection
      title={t('admin.markdownFacts.lists')}
      empty={listItems.length === 0}
    >
      {listItems.map((item) => (
        <FactRow
          key={`${item.lineNumber}-${item.text}`}
          lineNumber={item.lineNumber}
        >
          <Badge variant='secondary'>
            {item.ordered
              ? t('admin.markdownFacts.ordered')
              : t('admin.markdownFacts.unordered')}
          </Badge>
          <span>{item.text}</span>
        </FactRow>
      ))}
    </FactSection>
  )
}

function CodeFacts({
  codeBlocks,
}: {
  readonly codeBlocks: readonly MarkdownCodeBlockFact[]
}) {
  const { t } = useLanguage()
  return (
    <FactSection
      title={t('admin.markdownFacts.codeBlocks')}
      empty={codeBlocks.length === 0}
    >
      {codeBlocks.map((block) => (
        <div
          key={`${block.startLine}-${block.endLine}`}
          className='grid gap-2 rounded-md border bg-background p-3'
        >
          <div className='flex flex-wrap items-center gap-2'>
            <LineBadge lineNumber={block.startLine} />
            <Badge variant='outline'>
              {block.language ?? t('admin.markdownFacts.noLanguage')}
            </Badge>
          </div>
          <pre className='max-h-32 overflow-auto rounded-md bg-[var(--surface-control)] p-3 text-xs leading-relaxed'>
            {block.preview || t('admin.common.empty')}
          </pre>
        </div>
      ))}
    </FactSection>
  )
}

function FactSection({
  title,
  empty,
  children,
}: {
  readonly title: string
  readonly empty: boolean
  readonly children: ReactNode
}) {
  const { t } = useLanguage()
  return (
    <section className='grid content-start gap-3 rounded-md border bg-[var(--surface-control)] p-4'>
      <p className='font-medium'>{title}</p>
      {empty ? (
        <p className='text-sm text-muted-foreground'>
          {t('admin.common.empty')}
        </p>
      ) : (
        children
      )}
    </section>
  )
}

function FactRow({
  lineNumber,
  children,
}: {
  readonly lineNumber: number
  readonly children: ReactNode
}) {
  return (
    <div className='flex flex-wrap items-center gap-2 rounded-md border bg-background p-3 text-sm'>
      <LineBadge lineNumber={lineNumber} />
      {children}
    </div>
  )
}

function LineBadge({ lineNumber }: { readonly lineNumber: number }) {
  return <Badge variant='outline'>L{lineNumber}</Badge>
}
