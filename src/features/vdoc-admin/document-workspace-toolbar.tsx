import type { BranchDTO, DraftListDTO, VersionDTO } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
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
  return (
    <section
      aria-label={t('admin.workspace.readingContext')}
      className='w-full min-w-0 flex-1 basis-full'
    >
      <div className='grid min-w-0 grid-cols-[minmax(0,1fr)_6.5rem_minmax(0,1fr)] items-center gap-2 sm:flex'>
        <div className='flex min-w-0 items-center gap-1 sm:w-48'>
          <OptionsSelect
            fallbackToFirstOption={false}
            className='h-8 gap-1 border-transparent bg-transparent px-2 text-xs shadow-none hover:bg-muted'
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
        <OptionsSelect
          fallbackToFirstOption={false}
          className='h-8 gap-1 border-transparent bg-transparent px-2 text-xs shadow-none hover:bg-muted sm:w-28'
          aria-label={t('admin.workspace.contentState')}
          value={selection.mode}
          placeholder={t('admin.workspace.contentState')}
          onChange={(value) => onModeChange(value as 'published' | 'draft')}
          options={[
            { value: 'published', label: t('admin.workspace.published') },
            { value: 'draft', label: t('admin.workspace.draft') },
          ]}
        />
        <OptionsSelect
          fallbackToFirstOption={false}
          className='h-8 gap-1 border-transparent bg-transparent px-2 text-xs shadow-none hover:bg-muted sm:w-48'
          aria-label={
            selection.mode === 'published'
              ? t('admin.fields.version')
              : t('admin.fields.draft')
          }
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
            (revision) => ({ value: revision.id, label: revision.version_name })
          )}
          disabled={
            selection.pending ||
            (selection.mode === 'published' ? versions : drafts).length === 0
          }
        />
      </div>
      {selection.invalid && (
        <p role='alert' className='mt-3 text-sm text-destructive'>
          {t('admin.workspace.readerUnavailable')}
        </p>
      )}
    </section>
  )
}
