import { GitBranch } from 'lucide-react'
import type { BranchDTO, DraftListDTO, VersionDTO } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import type { DocumentReadingSelection } from './document-workspace-content'
import { NativeSelect } from './page-shared'

export function DocumentWorkspaceToolbar({
  selection,
  branches,
  versions,
  drafts,
  canManage,
  onBranchChange,
  onModeChange,
  onRevisionChange,
  onManageBranches,
}: {
  selection: DocumentReadingSelection
  branches: readonly BranchDTO[]
  versions: readonly VersionDTO[]
  drafts: readonly DraftListDTO[]
  canManage: boolean
  onBranchChange: (id: string) => void
  onModeChange: (mode: 'published' | 'draft') => void
  onRevisionChange: (id: string) => void
  onManageBranches: () => void
}) {
  const { t } = useLanguage()
  return (
    <section
      aria-label={t('admin.workspace.readingContext')}
      className='@container/document-toolbar border-b pb-4'
    >
      <div className='grid min-w-0 items-start gap-3 @xl/document-toolbar:grid-cols-[minmax(0,1fr)_minmax(0,.7fr)_minmax(0,1.2fr)]'>
        <div className='grid min-w-0 gap-2'>
          <NativeSelect
            label={t('admin.fields.branch')}
            value={selection.branchId}
            placeholder={t('admin.placeholders.selectBranch')}
            onChange={onBranchChange}
            options={branches.map((branch) => ({
              value: branch.id,
              label: `${branch.name}${branch.status === 1 ? '' : ` · ${t('admin.statuses.archived')}`}`,
            }))}
          />
          {canManage && (
            <Button
              variant='link'
              size='sm'
              className='h-auto w-fit justify-start gap-1.5 p-0 text-xs'
              onClick={onManageBranches}
            >
              <GitBranch aria-hidden className='size-3.5' />
              {t('admin.workspace.manageBranches')}
            </Button>
          )}
        </div>
        <NativeSelect
          label={t('admin.workspace.contentState')}
          value={selection.mode}
          placeholder={t('admin.workspace.contentState')}
          onChange={(value) => onModeChange(value as 'published' | 'draft')}
          options={[
            { value: 'published', label: t('admin.workspace.published') },
            { value: 'draft', label: t('admin.workspace.draft') },
          ]}
        />
        <NativeSelect
          label={
            selection.mode === 'published'
              ? t('admin.fields.version')
              : t('admin.fields.draft')
          }
          value={selection.version?.id ?? selection.draft?.id ?? ''}
          placeholder={
            selection.pending
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
