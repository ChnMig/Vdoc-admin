import { useId } from 'react'
import { FilePenLine, GitBranch, History, Layers3 } from 'lucide-react'
import type { BranchDTO, DraftListDTO, VersionDTO } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Label } from '@/components/ui/label'
import { OptionsSelect } from '@/components/options-select'
import type { DocumentReadingSelection } from './document-workspace-content'

export function DocumentWorkspaceToolbar({
  selection,
  branches,
  versions,
  drafts,
  onBranchChange,
  onModeChange,
  onRevisionChange,
}: {
  selection: DocumentReadingSelection
  branches: readonly BranchDTO[]
  versions: readonly VersionDTO[]
  drafts: readonly DraftListDTO[]
  onBranchChange: (id: string) => void
  onModeChange: (mode: 'published' | 'draft') => void
  onRevisionChange: (id: string) => void
}) {
  const { t } = useLanguage()
  const id = useId()
  const revisionLabel = t(
    selection.mode === 'published'
      ? 'admin.fields.version'
      : 'admin.fields.draft'
  )
  const RevisionIcon = selection.mode === 'published' ? History : FilePenLine
  const selectClassName =
    'h-9 gap-1 px-2 hover:border-ring/45 hover:bg-accent/40 focus-visible:border-ring sm:gap-2 sm:px-3'

  return (
    <section
      aria-label={t('admin.workspace.readingContext')}
      className='w-full min-w-0 flex-1 basis-full'
    >
      <div className='grid max-w-2xl min-w-0 grid-cols-[minmax(0,1fr)_6.5rem_minmax(0,1fr)] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)] sm:gap-3'>
        <div className='grid min-w-0 gap-1.5'>
          <Label
            htmlFor={`${id}-branch`}
            className='gap-1.5 text-xs text-muted-foreground'
          >
            <GitBranch aria-hidden className='size-3.5' />
            {t('admin.fields.branch')}
          </Label>
          <OptionsSelect
            id={`${id}-branch`}
            fallbackToFirstOption={false}
            className={selectClassName}
            aria-label={t('admin.fields.branch')}
            value={selection.branchId}
            placeholder={t('admin.placeholders.selectBranch')}
            onChange={onBranchChange}
            options={branches.map((branch) => ({
              value: branch.id,
              label: `${branch.name}${branch.status === 1 ? '' : ` · ${t('admin.statuses.archived')}`}`,
            }))}
          />
        </div>
        <div className='grid min-w-0 gap-1.5'>
          <Label
            htmlFor={`${id}-state`}
            className='gap-1.5 text-xs text-muted-foreground'
          >
            <Layers3 aria-hidden className='size-3.5' />
            {t('admin.workspace.contentState')}
          </Label>
          <OptionsSelect
            id={`${id}-state`}
            fallbackToFirstOption={false}
            className={selectClassName}
            aria-label={t('admin.workspace.contentState')}
            value={selection.mode}
            placeholder={t('admin.workspace.contentState')}
            onChange={(value) => onModeChange(value as 'published' | 'draft')}
            options={[
              { value: 'published', label: t('admin.workspace.published') },
              { value: 'draft', label: t('admin.workspace.draft') },
            ]}
          />
        </div>
        <div className='grid min-w-0 gap-1.5'>
          <Label
            htmlFor={`${id}-revision`}
            className='gap-1.5 text-xs text-muted-foreground'
          >
            <RevisionIcon aria-hidden className='size-3.5' />
            {revisionLabel}
          </Label>
          <OptionsSelect
            id={`${id}-revision`}
            fallbackToFirstOption={false}
            className={selectClassName}
            aria-label={revisionLabel}
            value={selection.version?.id ?? selection.draft?.id ?? ''}
            placeholder={
              selection.invalid
                ? t(
                    selection.mode === 'published'
                      ? 'admin.fields.version'
                      : 'admin.fields.draft'
                  )
                : selection.pending
                  ? t('admin.common.loading')
                  : t(
                      selection.mode === 'published'
                        ? 'admin.workspace.noPublishedContent'
                        : 'admin.workspace.noDraftContent'
                    )
            }
            onChange={onRevisionChange}
            options={(selection.mode === 'published' ? versions : drafts).map(
              (revision) => ({
                value: revision.id,
                label: revision.version_name,
              })
            )}
            disabled={
              selection.pending ||
              (selection.mode === 'published' ? versions : drafts).length === 0
            }
          />
        </div>
      </div>
      {selection.invalid && (
        <p role='alert' className='mt-3 text-sm text-destructive'>
          {t('admin.workspace.readerUnavailable')}
        </p>
      )}
    </section>
  )
}
