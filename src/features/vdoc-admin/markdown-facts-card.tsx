import { useMemo } from 'react'
import { FileText } from 'lucide-react'
import { useLanguage } from '@/context/language-provider'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  MarkdownFactSections,
  MarkdownFactSummary,
} from './markdown-fact-sections'
import { parseMarkdownFacts } from './markdown-facts'

export function MarkdownFactsCard({ content }: { readonly content?: string }) {
  const { t } = useLanguage()
  const facts = useMemo(() => parseMarkdownFacts(content ?? ''), [content])
  const hasFacts =
    facts.headings.length > 0 ||
    facts.listItems.length > 0 ||
    facts.taskItems.length > 0 ||
    facts.codeBlocks.length > 0 ||
    facts.links.length > 0

  return (
    <Card className='overflow-hidden'>
      <CardHeader className='border-b pb-5'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='grid gap-2'>
            <Badge className='w-fit' variant='secondary'>
              <FileText className='size-3' />
              {t('admin.types.markdown')}
            </Badge>
            <CardTitle>
              <h2>{t('admin.markdownFacts.title')}</h2>
            </CardTitle>
            <CardDescription>
              {t('admin.markdownFacts.description')}
            </CardDescription>
          </div>
          <Badge variant='outline'>
            {t('admin.markdownFacts.lineCount', { count: facts.totalLines })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className='grid gap-4 p-5'>
        <MarkdownFactSummary facts={facts} />
        {hasFacts ? (
          <MarkdownFactSections facts={facts} />
        ) : (
          <p className='rounded-md border border-dashed bg-[var(--surface-control)] p-4 text-sm text-muted-foreground'>
            {t('admin.markdownFacts.noFacts')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
