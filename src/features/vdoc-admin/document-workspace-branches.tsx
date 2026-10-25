import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import {
  archiveBranch,
  createBranch,
  listBranches,
  updateBranch,
  type BranchDTO,
  type DocumentDTO,
} from '@/lib/vdoc-api'
import { invalidateVdocQueries } from '@/lib/vdoc-query-invalidation'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ConfirmActionButton,
  EmptyState,
  FormDialog,
  LoadingErrorState,
  StatusBadge,
  TextField,
} from './page-shared'
import {
  ACTIVE_STATUS,
  ARCHIVED_OR_DISABLED_STATUS,
  fieldValue,
} from './page-utils'

type DocumentWorkspaceBranchesProps = {
  projectId: string
  document: DocumentDTO
  canManage: boolean
  interactive: boolean
  selectedBranchId?: string
  onBranchSelect?: (id: string) => void
}

type BranchChange =
  | { kind: 'create'; payload: Parameters<typeof createBranch>[2] }
  | {
      kind: 'update'
      branchId: string
      payload: Parameters<typeof updateBranch>[3]
    }
  | { kind: 'archive'; branchId: string }

export function DocumentWorkspaceBranches(
  props: DocumentWorkspaceBranchesProps
) {
  const sessionVersion = useAuthStore((state) => state.auth.sessionVersion)
  const userId = useAuthStore((state) => state.auth.user?.id)
  const scope = JSON.stringify([
    sessionVersion,
    userId,
    props.projectId,
    props.document.id,
    props.document.status,
    props.canManage,
    props.interactive,
  ])
  return (
    <ScopedDocumentWorkspaceBranches
      key={scope}
      {...props}
      scope={scope}
      sessionVersion={sessionVersion}
      userId={userId}
    />
  )
}

function ScopedDocumentWorkspaceBranches({
  projectId,
  document,
  canManage,
  interactive,
  selectedBranchId,
  onBranchSelect,
  scope,
  sessionVersion,
  userId,
}: DocumentWorkspaceBranchesProps & {
  scope: string
  sessionVersion: number
  userId?: string
}) {
  const { t } = useLanguage()
  const titleId = useId()
  const queryClient = useQueryClient()
  const activeRef = useRef(false)
  useLayoutEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
    }
  }, [])
  const canMutate = Boolean(
    projectId &&
    document.project_id === projectId &&
    canManage &&
    interactive &&
    document.status === ACTIVE_STATUS
  )
  const branchesQuery = useQuery({
    queryKey: ['branches', projectId, document.id],
    queryFn: ({ signal }) => listBranches(projectId, document.id, { signal }),
    enabled: Boolean(
      projectId && document.id && document.project_id === projectId
    ),
  })
  const sameSession = () => {
    const auth = useAuthStore.getState().auth
    return auth.sessionVersion === sessionVersion && auth.user?.id === userId
  }
  const mutation = useMutation({
    mutationFn: (change: BranchChange) => {
      if (!activeRef.current || !canMutate || !sameSession()) {
        throw new Error(t('admin.workspace.unavailable'))
      }
      if (change.kind === 'create')
        return createBranch(projectId, document.id, change.payload)
      const branches = queryClient.getQueryData<
        Awaited<ReturnType<typeof listBranches>>
      >(['branches', projectId, document.id])
      const branch = branches?.items.find((item) => item.id === change.branchId)
      if (
        !branch ||
        branch.document_id !== document.id ||
        branch.status !== ACTIVE_STATUS ||
        (change.kind === 'archive' && branch.is_default)
      ) {
        throw new Error(t('admin.workspace.unavailable'))
      }
      if (change.kind === 'archive')
        return archiveBranch(projectId, document.id, branch.id)
      return updateBranch(projectId, document.id, branch.id, {
        ...change.payload,
        // A default may have changed while the edit dialog was open.
        is_default: branch.is_default || change.payload.is_default,
      })
    },
    onSuccess: () => {
      if (!sameSession()) return
      return invalidateVdocQueries(queryClient, {
        kind: 'document',
        projectId,
        documentId: document.id,
      })
    },
  })
  const branches = (branchesQuery.data?.items ?? []).filter(
    (branch) => branch.document_id === document.id
  )
  const pending = mutation.isPending

  return (
    <section className='grid min-w-0 gap-4' aria-labelledby={titleId}>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='grid min-w-0 gap-1'>
          <h3 id={titleId} className='text-base font-semibold'>
            {t('admin.sections.branches')}
            <span className='ml-2 text-sm font-normal text-muted-foreground tabular-nums'>
              {branches.length}
            </span>
          </h3>
          <p className='max-w-prose text-sm text-muted-foreground'>
            {t('admin.workspace.branchManagementDescription')}
          </p>
        </div>
        {canMutate && (
          <FormDialog
            title={t('admin.sections.createBranch')}
            submitLabel={t('admin.common.create')}
            pending={pending}
            disabled={!branchesQuery.isSuccess}
            submissionScope={scope}
            onSubmit={(formData) =>
              mutation.mutateAsync({
                kind: 'create',
                payload: {
                  name: fieldValue(formData, 'name'),
                  description: fieldValue(formData, 'description'),
                },
              })
            }
          >
            <TextField
              label={t('admin.fields.name')}
              name='name'
              description={t('admin.workspace.branchNameHint')}
              required
            />
            <TextField
              label={t('admin.fields.description')}
              name='description'
            />
          </FormDialog>
        )}
      </div>
      <LoadingErrorState state={branchesQuery} />
      {branches.length ? (
        <ul className='divide-y'>
          {branches.map((branch) => {
            const active = branch.status === ACTIVE_STATUS
            const selected = branch.id === selectedBranchId
            return (
              <li
                key={branch.id}
                className='flex min-w-0 flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between'
              >
                <div className='grid min-w-0 gap-1.5'>
                  <div className='flex min-w-0 flex-wrap items-center gap-2'>
                    <span className='font-medium [overflow-wrap:anywhere]'>
                      {branch.name}
                    </span>
                    {selected && (
                      <StatusBadge>
                        {t('admin.workspace.currentBranch')}
                      </StatusBadge>
                    )}
                    {branch.is_default && (
                      <StatusBadge>
                        {t('admin.fields.defaultBranch')}
                      </StatusBadge>
                    )}
                    {branch.is_protected && (
                      <StatusBadge>
                        {t('admin.fields.protectedBranch')}
                      </StatusBadge>
                    )}
                    <StatusBadge muted={!active}>
                      {active
                        ? t('admin.statuses.active')
                        : branch.status === ARCHIVED_OR_DISABLED_STATUS
                          ? t('admin.statuses.archived')
                          : `${t('admin.common.unknown')} ${branch.status}`}
                    </StatusBadge>
                  </div>
                  {branch.description && (
                    <p className='max-w-prose text-sm [overflow-wrap:anywhere] text-muted-foreground'>
                      {branch.description}
                    </p>
                  )}
                </div>
                <div className='flex shrink-0 flex-wrap items-center gap-2'>
                  {onBranchSelect && active && !selected && (
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      disabled={!interactive || pending}
                      onClick={() => onBranchSelect(branch.id)}
                    >
                      {t('admin.workspace.useBranch')}
                    </Button>
                  )}
                  {canMutate && active && (
                    <>
                      <BranchEditDialog
                        branch={branch}
                        pending={pending}
                        scope={scope}
                        onUpdate={(payload) =>
                          mutation.mutateAsync({
                            kind: 'update',
                            branchId: branch.id,
                            payload,
                          })
                        }
                      />
                      <ConfirmActionButton
                        label={t('admin.common.archive')}
                        title={t('admin.confirm.archiveBranchTitle', {
                          name: branch.name,
                        })}
                        description={t(
                          'admin.confirm.archiveBranchDescription'
                        )}
                        pending={pending}
                        disabled={branch.is_default}
                        onConfirm={() =>
                          mutation.mutateAsync({
                            kind: 'archive',
                            branchId: branch.id,
                          })
                        }
                      />
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : branchesQuery.isSuccess ? (
        <EmptyState preset='branches' />
      ) : null}
    </section>
  )
}

function BranchEditDialog({
  branch,
  pending,
  scope,
  onUpdate,
}: {
  branch: BranchDTO
  pending: boolean
  scope: string
  onUpdate: (payload: Parameters<typeof updateBranch>[3]) => Promise<unknown>
}) {
  const { t } = useLanguage()
  const [edits, setEdits] = useState<
    Partial<
      Pick<BranchDTO, 'name' | 'description' | 'is_default' | 'is_protected'>
    >
  >({})
  return (
    <FormDialog
      title={t('admin.sections.editBranch')}
      description={branch.name}
      triggerLabel={t('admin.common.edit')}
      triggerVariant='outline'
      triggerSize='sm'
      submitLabel={t('admin.common.save')}
      pending={pending}
      submissionScope={`${scope}:${branch.id}`}
      resetOnSuccess={false}
      onOpenChange={(open) => {
        if (!open) setEdits({})
      }}
      onSubmit={async () => {
        const submitted = edits
        await onUpdate({
          name: (edits.name ?? branch.name).trim(),
          description: (edits.description ?? branch.description ?? '').trim(),
          is_default: branch.is_default || (edits.is_default ?? false),
          is_protected: edits.is_protected ?? branch.is_protected,
        })
        setEdits((current) => {
          const remaining = { ...current }
          for (const field of [
            'name',
            'description',
            'is_default',
            'is_protected',
          ] as const) {
            if (current[field] === submitted[field]) delete remaining[field]
          }
          return remaining
        })
      }}
    >
      <TextField
        label={t('admin.fields.name')}
        name='name'
        value={edits.name ?? branch.name}
        onChange={(name) => setEdits((current) => ({ ...current, name }))}
        description={t('admin.workspace.branchNameHint')}
        required
      />
      <TextField
        label={t('admin.fields.description')}
        name='description'
        value={edits.description ?? branch.description ?? ''}
        onChange={(description) =>
          setEdits((current) => ({ ...current, description }))
        }
      />
      <div className='grid gap-3'>
        <label className='flex items-center gap-2 text-sm'>
          <Checkbox
            name='is_default'
            checked={branch.is_default || (edits.is_default ?? false)}
            disabled={branch.is_default}
            onCheckedChange={(checked) =>
              setEdits((current) => ({
                ...current,
                is_default: checked === true,
              }))
            }
          />
          {t('admin.fields.defaultBranch')}
        </label>
        <label className='flex items-center gap-2 text-sm'>
          <Checkbox
            name='is_protected'
            checked={edits.is_protected ?? branch.is_protected}
            onCheckedChange={(checked) =>
              setEdits((current) => ({
                ...current,
                is_protected: checked === true,
              }))
            }
          />
          {t('admin.fields.protectedBranch')}
        </label>
      </div>
    </FormDialog>
  )
}
