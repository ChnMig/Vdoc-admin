import type { ReactNode } from 'react'
import { useLanguage } from '@/context/language-provider'
import { Badge } from '@/components/ui/badge'
import type { MarkdownLinkFact } from './markdown-facts'
import { markdownSafeLink } from './markdown-safe-link'

export function LinkFacts({
  links,
}: {
  readonly links: readonly MarkdownLinkFact[]
}) {
  const { t } = useLanguage()
  return (
    <FactSection
      title={t('admin.markdownFacts.links')}
      empty={links.length === 0}
    >
      {links.map((link) => (
        <LinkFactRow
          key={`${link.lineNumber}-${link.text}-${link.url}`}
          link={link}
        />
      ))}
    </FactSection>
  )
}

function LinkFactRow({ link }: { readonly link: MarkdownLinkFact }) {
  const { t } = useLanguage()
  const safeLink = markdownSafeLink(link.url)
  return (
    <div className='flex flex-wrap items-center gap-2 rounded-md border bg-background p-3 text-sm'>
      <Badge variant='outline'>L{link.lineNumber}</Badge>
      {safeLink.kind === 'safe' ? (
        <a
          className='font-medium text-primary underline-offset-4 hover:underline'
          href={safeLink.href}
        >
          {link.text}
        </a>
      ) : (
        <span className='font-medium'>{link.text}</span>
      )}
      {safeLink.kind === 'unsafe' && (
        <Badge variant='destructive'>
          {t('admin.markdownFacts.unsafeLink')}
        </Badge>
      )}
      <code className='text-xs text-muted-foreground'>{link.url}</code>
    </div>
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
