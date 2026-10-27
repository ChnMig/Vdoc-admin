import { Fragment, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { saveDocumentSource } from '@/features/document-reader/save-document-source'
import {
  buildSourcePatch,
  sourceDiffLines,
  splitSourceLines,
  type SourceDiffLine,
} from './source-diff-model'

const lineStyle = {
  context: '',
  added: 'bg-[var(--status-ready-surface)] text-foreground',
  removed: 'bg-[var(--status-danger-surface)] text-foreground',
  note: 'bg-muted text-muted-foreground italic',
}

function LineNumber({ value }: { value?: number }) {
  return (
    <td
      aria-hidden='true'
      className='w-12 min-w-12 border-e px-2 text-end align-top font-mono tabular-nums opacity-65 select-none'
    >
      {value}
    </td>
  )
}

function LineContent({ line }: { line?: SourceDiffLine }) {
  const { t } = useLanguage()
  return (
    <td className='px-3 align-top break-all whitespace-pre-wrap'>
      <span aria-hidden='true' className='inline-block w-4 select-none'>
        {line?.kind === 'added' ? '+' : line?.kind === 'removed' ? '−' : ' '}
      </span>
      {line?.kind === 'note'
        ? t('admin.diff.noFinalNewline')
        : line?.text || '\u00a0'}
    </td>
  )
}

export default function SourceDiffViewer({
  before,
  after,
  fromLabel,
  toLabel,
  fileName = 'document.txt',
}: {
  before: string
  after: string
  fromLabel: string
  toLabel: string
  fileName?: string
}) {
  const { t } = useLanguage()
  const [split, setSplit] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const result = useMemo(
    () => buildSourcePatch(before, after, expanded),
    [before, after, expanded]
  )
  const lines = result.patch?.hunks.flatMap(sourceDiffLines) ?? []
  const added = lines.filter((line) => line.kind === 'added').length
  const removed = lines.filter((line) => line.kind === 'removed').length

  return (
    <section
      aria-label={t('admin.diff.sourceReview')}
      className='grid min-w-0 gap-3'
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='min-w-0 text-sm break-words'>
          <span className='font-medium'>{fromLabel}</span>
          <span className='px-2 text-muted-foreground'>→</span>
          <span className='font-medium'>{toLabel}</span>
        </p>
        <div className='flex flex-wrap items-center gap-2'>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => saveDocumentSource(before, `source-${fileName}`)}
          >
            {t('admin.diff.downloadBefore')}
          </Button>
          <Button
            size='sm'
            variant='ghost'
            onClick={() => saveDocumentSource(after, `target-${fileName}`)}
          >
            {t('admin.diff.downloadAfter')}
          </Button>
          {result.patch && (
            <span className='me-2 font-mono text-xs tabular-nums'>
              +{added} / −{removed}
            </span>
          )}
          <div
            role='group'
            aria-label={t('admin.diff.diffLayout')}
            className='inline-flex rounded-md border p-0.5'
          >
            <Button
              size='sm'
              variant={split ? 'ghost' : 'secondary'}
              aria-pressed={!split}
              onClick={() => setSplit(false)}
            >
              {t('admin.diff.unified')}
            </Button>
            <Button
              size='sm'
              variant={split ? 'secondary' : 'ghost'}
              aria-pressed={split}
              onClick={() => setSplit(true)}
            >
              {t('admin.diff.split')}
            </Button>
          </div>
          <Button
            size='sm'
            variant='outline'
            aria-pressed={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {t(
              expanded
                ? 'admin.diff.collapseContext'
                : 'admin.diff.expandContext'
            )}
          </Button>
        </div>
      </div>
      {result.reason ? (
        <Alert>
          <AlertDescription>
            {t(
              result.reason === 'large'
                ? 'admin.diff.largeSource'
                : 'admin.diff.diffTimeout'
            )}
          </AlertDescription>
        </Alert>
      ) : result.patch?.hunks.length === 0 ? (
        <p
          role='status'
          className='rounded-lg border px-4 py-8 text-center text-sm text-muted-foreground'
        >
          {t('admin.diff.identicalSource')}
        </p>
      ) : (
        <div
          className='min-w-0 overflow-x-auto rounded-lg border'
          tabIndex={0}
          role='region'
          aria-label={t('admin.diff.sourceReview')}
        >
          <table
            className={cn(
              'w-full border-collapse font-mono text-xs leading-6',
              split && 'min-w-[42rem] table-fixed'
            )}
          >
            <caption className='sr-only'>
              {t('admin.diff.sourceReview')} · {fromLabel} → {toLabel}
            </caption>
            {split && (
              <colgroup>
                <col className='w-12' />
                <col />
                <col className='w-12' />
                <col />
              </colgroup>
            )}
            <thead className='bg-muted text-start text-muted-foreground'>
              {split ? (
                <tr>
                  <th
                    colSpan={2}
                    className='border-e px-3 py-2 text-start font-medium'
                  >
                    {fromLabel}
                  </th>
                  <th colSpan={2} className='px-3 py-2 text-start font-medium'>
                    {toLabel}
                  </th>
                </tr>
              ) : (
                <tr>
                  <th className='w-12 p-2 font-medium'>
                    {t('admin.diff.oldLine')}
                  </th>
                  <th className='w-12 p-2 font-medium'>
                    {t('admin.diff.newLine')}
                  </th>
                  <th className='px-3 py-2 text-start font-medium'>
                    {t('admin.diff.sourceReview')}
                  </th>
                </tr>
              )}
            </thead>
            <tbody>
              {result.patch?.hunks.map((hunk, index) => (
                <Fragment key={index}>
                  <tr className='border-y bg-primary/5 text-muted-foreground'>
                    <td colSpan={split ? 4 : 3} className='px-4 py-1'>
                      @@ −{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},
                      {hunk.newLines} @@
                    </td>
                  </tr>
                  {split
                    ? splitSourceLines(sourceDiffLines(hunk)).map((row, i) => (
                        <tr key={i}>
                          <LineNumber value={row.before?.oldLine} />
                          <td
                            className={cn(
                              'border-e px-3 align-top break-all whitespace-pre-wrap',
                              row.before && lineStyle[row.before.kind]
                            )}
                          >
                            <span
                              aria-hidden='true'
                              className='inline-block w-4 select-none'
                            >
                              {row.before?.kind === 'removed' ? '−' : ' '}
                            </span>
                            {row.before?.kind === 'note'
                              ? t('admin.diff.noFinalNewline')
                              : row.before?.text || '\u00a0'}
                          </td>
                          <LineNumber value={row.after?.newLine} />
                          <td
                            className={cn(
                              'px-3 align-top break-all whitespace-pre-wrap',
                              row.after && lineStyle[row.after.kind]
                            )}
                          >
                            <span
                              aria-hidden='true'
                              className='inline-block w-4 select-none'
                            >
                              {row.after?.kind === 'added' ? '+' : ' '}
                            </span>
                            {row.after?.kind === 'note'
                              ? t('admin.diff.noFinalNewline')
                              : row.after?.text || '\u00a0'}
                          </td>
                        </tr>
                      ))
                    : sourceDiffLines(hunk).map((line, i) => (
                        <tr key={i} className={lineStyle[line.kind]}>
                          <LineNumber value={line.oldLine} />
                          <LineNumber value={line.newLine} />
                          <LineContent line={line} />
                        </tr>
                      ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
