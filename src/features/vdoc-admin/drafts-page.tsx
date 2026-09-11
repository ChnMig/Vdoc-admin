import { useId, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertCircle, BookOpenText, Route } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import {
  approveDraft,
  createDraft,
  getDraftContent,
  listBranches,
  listDrafts,
  listProjectMembers,
  getDocumentOverview,
  promoteDraft,
  rejectDraft,
  requestDraftChanges,
  submitDraft,
  updateDraft,
  type AISummaryTarget,
  type DraftReviewPayload,
  type BranchDTO,
  type DraftDTO,
} from '@/lib/vdoc-api'
import { type VdocPageDeepLinkProps } from '@/lib/vdoc-route-search'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { AIContextPanel } from './ai-panels'
import { useDraftEditorState } from './draft-editor-state'
import { MarkdownPreview } from './markdown-preview'
import {
  PageChrome,
  DeepLinkAlert,
  SelectorGrid,
  NativeSelect,
  FormCard,
  TextField,
  CollectionCard,
  DiffSummaryCards,
  DiffReviewList,
  ContentViewer,
  LoadingErrorState,
  StatusBadge,
  EmptyState,
} from './page-shared'
import {
  DRAFT_STATUS_SUBMITTED,
  DRAFT_STATUS_PUBLISHED,
  useInvalidateResources,
  useProjectsAndSelection,
  useDocumentsAndSelection,
  useRouteControlledString,
  activeProjectRole,
  ROLE_ADMIN,
  ROLE_WRITER,
  ACTIVE_STATUS,
  contentKindOptions,
  DOCUMENT_TYPE_MARKDOWN,
  activeContentKind,
  entityOptionLabel,
  fieldValue,
  type QueryState,
} from './page-utils'

const DRAFT_STATUS_DRAFT = 1

const DRAFT_STATUS_CHANGES_REQUESTED = 3

const DRAFT_STATUS_REJECTED = 4

type DraftAction = 'submit' | 'approve' | 'request' | 'reject'

type DraftReviewAction = Exclude<DraftAction, 'submit'>

type DraftActionRequest = {
  readonly projectId: string
  readonly documentId: string
  readonly draftId: string
  readonly action: DraftAction
  readonly comment?: string
}

function draftStatusLabel(
  status: number,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (status === DRAFT_STATUS_DRAFT) return t('admin.statuses.draft')
  if (status === DRAFT_STATUS_SUBMITTED) return t('admin.statuses.submitted')
  if (status === DRAFT_STATUS_CHANGES_REQUESTED)
    return t('admin.statuses.changesRequested')
  if (status === DRAFT_STATUS_REJECTED) return t('admin.statuses.rejected')
  if (status === DRAFT_STATUS_PUBLISHED) return t('admin.statuses.published')
  return `${t('admin.common.unknown')} ${status}`
}

function TextAreaField({
  id,
  label,
  name,
  required = false,
  defaultValue,
  value,
  onChange,
  disabled = false,
}: {
  id?: string
  label: string
  name: string
  required?: boolean
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
}) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  return (
    <div className='grid gap-2'>
      <Label htmlFor={controlId}>{label}</Label>
      <Textarea
        id={controlId}
        name={name}
        required={required}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        onChange={
          onChange ? (event) => onChange(event.currentTarget.value) : undefined
        }
        disabled={disabled}
        className='min-h-32 font-mono'
      />
    </div>
  )
}

export function DraftsPage({
  search,
  onSearchChange,
}: VdocPageDeepLinkProps = {}) {
  const { t } = useLanguage()
  const invalidate = useInvalidateResources()
  const authUser = useAuthStore((state) => state.auth.user)
  const {
    projectsQuery,
    projectId,
    setProjectId,
    projectOptions,
    invalidProjectDeepLink,
  } = useProjectsAndSelection(search?.project_id, (value) =>
    onSearchChange?.({
      project_id: value || undefined,
      document_id: undefined,
      branch_id: undefined,
      draft_id: undefined,
      version_id: undefined,
      endpoint_id: undefined,
      from_version_id: undefined,
      to_version_id: undefined,
      diff_id: undefined,
    })
  )
  const {
    documentId,
    selectedDocument,
    setDocumentId,
    documentOptions,
    invalidDocumentDeepLink,
  } = useDocumentsAndSelection(
    projectId,
    undefined,
    search?.document_id,
    (value) =>
      onSearchChange?.({
        document_id: value || undefined,
        branch_id: undefined,
        draft_id: undefined,
        version_id: undefined,
        endpoint_id: undefined,
        from_version_id: undefined,
        to_version_id: undefined,
        diff_id: undefined,
      })
  )
  const branchesQuery = useQuery({
    queryKey: ['branches', projectId, documentId],
    queryFn: ({ signal }) => listBranches(projectId, documentId, { signal }),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const [branchFilter, setBranchFilter] = useRouteControlledString(
    search?.branch_id,
    onSearchChange !== undefined
  )
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: ({ signal }) => listProjectMembers(projectId, { signal }),
    enabled: projectId.length > 0 && !authUser?.is_super_admin,
  })
  const canPublishForRole = Boolean(
    authUser?.is_super_admin ||
    activeProjectRole(membersQuery.data?.items, authUser?.id) === ROLE_ADMIN
  )
  const canDraftForRole = Boolean(
    authUser?.is_super_admin ||
    (activeProjectRole(membersQuery.data?.items, authUser?.id) ?? 0) >=
      ROLE_WRITER
  )
  const draftsQuery = useQuery({
    queryKey: ['drafts', projectId, documentId, branchFilter || 'all'],
    queryFn: ({ signal }) =>
      branchFilter
        ? listDrafts(projectId, documentId, branchFilter, { signal })
        : listDrafts(projectId, documentId, undefined, { signal }),
    enabled: projectId.length > 0 && documentId.length > 0,
  })
  const [draftId, setDraftId] = useRouteControlledString(
    search?.draft_id,
    onSearchChange !== undefined
  )
  const [contentKind, setContentKind] = useState('raw')
  const [reviewNote, setReviewNote] = useState('')
  const [pendingReviewAction, setPendingReviewAction] = useState<{
    projectId: string
    documentId: string
    draftId: string
    draftName: string
    action: DraftReviewAction
    comment?: string
  }>()
  const reviewActionLockedRef = useRef(false)
  const [promoteSourceBranchId, setPromoteSourceBranchId] = useState('')
  const [promoteTargetBranchId, setPromoteTargetBranchId] = useState('')
  const draftExistsInDocument = (draftsQuery.data?.items ?? []).some(
    (draft) => draft.id === draftId
  )
  const selectedDraft = draftsQuery.data?.items.find(
    (draft) => draft.id === draftId
  )
  const selectedProject = projectsQuery.data?.items.find(
    (project) => project.id === projectId
  )
  const activeBranches = (branchesQuery.data?.items ?? []).filter(
    (branch) => branch.status === ACTIVE_STATUS
  )
  const activeBranchIds = new Set(activeBranches.map((branch) => branch.id))
  const invalidBranchDeepLink = Boolean(
    branchesQuery.data &&
    search?.branch_id &&
    !branchesQuery.data.items.some((branch) => branch.id === search.branch_id)
  )
  const invalidDraftDeepLink = Boolean(
    !invalidBranchDeepLink &&
    draftsQuery.data &&
    search?.draft_id &&
    !draftsQuery.data.items.some((draft) => draft.id === search.draft_id)
  )
  const activeDocumentContext = Boolean(
    selectedProject?.status === ACTIVE_STATUS &&
    selectedDocument?.status === ACTIVE_STATUS
  )
  const selectedDraftBranchActive = Boolean(
    selectedDraft && activeBranchIds.has(selectedDraft.branch_id)
  )
  const selectedDraftAIInteractive = Boolean(
    selectedDraft && activeDocumentContext && selectedDraftBranchActive
  )
  const canDraft = canDraftForRole && activeDocumentContext
  const canPublish = canPublishForRole && activeDocumentContext
  const canReviewSelectedDraft = Boolean(
    canPublish &&
    selectedDraft &&
    activeBranchIds.has(selectedDraft.branch_id) &&
    selectedDraft.status === DRAFT_STATUS_SUBMITTED
  )
  const selectedDraftAITarget: AISummaryTarget | undefined = selectedDraft
    ? {
        projectId,
        documentId,
        ownerType: 'draft',
        ownerId: selectedDraft.id,
      }
    : undefined
  const draftContentKindOptions = contentKindOptions(
    t,
    selectedDocument?.document_type === DOCUMENT_TYPE_MARKDOWN
  )
  const activeDraftContentKind = activeContentKind(
    contentKind,
    draftContentKindOptions
  )
  const contentQuery = useQuery({
    queryKey: [
      'draft-content',
      projectId,
      documentId,
      draftId,
      activeDraftContentKind,
    ],
    queryFn: ({ signal }) =>
      getDraftContent(projectId, documentId, draftId, activeDraftContentKind, {
        signal,
      }),
    enabled:
      projectId.length > 0 &&
      documentId.length > 0 &&
      draftId.length > 0 &&
      draftExistsInDocument,
  })
  const editorRawContentQuery = useQuery({
    queryKey: ['draft-content', projectId, documentId, draftId, 'raw'],
    queryFn: ({ signal }) =>
      getDraftContent(projectId, documentId, draftId, 'raw', { signal }),
    enabled:
      selectedDraft !== undefined &&
      (selectedDraft.status === DRAFT_STATUS_DRAFT ||
        selectedDraft.status === DRAFT_STATUS_CHANGES_REQUESTED),
  })
  const overviewQuery = useQuery({
    queryKey: ['document-overview', projectId, documentId],
    queryFn: ({ signal }) =>
      getDocumentOverview(projectId, documentId, { signal }),
    enabled: Boolean(canPublish && projectId && documentId),
  })
  const publishedBranchIds = new Set(
    overviewQuery.data?.published_branch_ids ?? []
  )
  const promoteSourceOptions = activeBranches
    .filter((branch) => publishedBranchIds.has(branch.id))
    .map((branch) => ({ value: branch.id, label: branch.name }))
  const promoteTargetOptions = activeBranches
    .filter((branch) => branch.id !== promoteSourceBranchId)
    .map((branch) => ({ value: branch.id, label: branch.name }))
  const promotionAvailable = promoteSourceOptions.some((source) =>
    activeBranches.some((target) => target.id !== source.value)
  )
  const createMutation = useMutation({
    mutationFn: (request: {
      projectId: string
      documentId: string
      payload: Parameters<typeof createDraft>[2]
    }) => createDraft(request.projectId, request.documentId, request.payload),
    onSuccess: (_result, request) =>
      invalidate({
        kind: 'document',
        projectId: request.projectId,
        documentId: request.documentId,
      }),
  })
  const updateMutation = useMutation({
    mutationFn: ({
      projectId,
      documentId,
      id,
      payload,
    }: {
      projectId: string
      documentId: string
      id: string
      payload: Parameters<typeof updateDraft>[3]
    }) => updateDraft(projectId, documentId, id, payload),
    onSuccess: (_result, request) =>
      invalidate({
        kind: 'document',
        projectId: request.projectId,
        documentId: request.documentId,
      }),
  })
  const promoteMutation = useMutation({
    mutationFn: (payload: Parameters<typeof promoteDraft>[2]) =>
      promoteDraft(projectId, documentId, payload),
    onMutate: () => ({ projectId, documentId }),
    onSuccess: (_result, _variables, context) =>
      invalidate({
        kind: 'document',
        projectId: context?.projectId ?? projectId,
        documentId: context?.documentId ?? documentId,
      }),
  })
  const actionMutation = useMutation({
    mutationFn: (request: DraftActionRequest) => runDraftAction(request),
    onSuccess: (_data, variables) => {
      if (variables.action !== 'submit') {
        setReviewNote('')
        setPendingReviewAction(undefined)
      }
      return invalidate({
        kind: 'document',
        projectId: variables.projectId,
        documentId: variables.documentId,
      })
    },
    onSettled: () => {
      reviewActionLockedRef.current = false
    },
  })
  const handleProjectChange = (value: string) => {
    setDraftId('')
    setBranchFilter('')
    setContentKind('raw')
    setReviewNote('')
    setPendingReviewAction(undefined)
    setPromoteSourceBranchId('')
    setPromoteTargetBranchId('')
    setProjectId(value)
  }
  const handleDocumentChange = (value: string) => {
    setDraftId('')
    setBranchFilter('')
    setContentKind('raw')
    setReviewNote('')
    setPendingReviewAction(undefined)
    setPromoteSourceBranchId('')
    setPromoteTargetBranchId('')
    setDocumentId(value)
  }
  const handleDraftSelect = (value: string) => {
    setDraftId(value)
    setReviewNote('')
    setPendingReviewAction(undefined)
    const draft = draftsQuery.data?.items.find((item) => item.id === value)
    if (draft && branchFilter !== draft.branch_id) {
      setBranchFilter(draft.branch_id)
    }
    onSearchChange?.({
      branch_id: draft?.branch_id || branchFilter || undefined,
      draft_id: value || undefined,
    })
  }
  const reviewConfirmation = pendingReviewAction
    ? draftReviewConfirmation(pendingReviewAction, t)
    : undefined
  const selectedDraftContent = contentQuery.data?.content
  return (
    <PageChrome page='drafts'>
      <DeepLinkAlert
        targets={[
          ...(invalidProjectDeepLink
            ? [`${t('admin.fields.project')}: ${search?.project_id}`]
            : []),
          ...(!invalidProjectDeepLink && invalidDocumentDeepLink
            ? [`${t('admin.fields.document')}: ${search?.document_id}`]
            : []),
          ...(!invalidProjectDeepLink &&
          !invalidDocumentDeepLink &&
          invalidBranchDeepLink
            ? [`${t('admin.fields.branch')}: ${search?.branch_id}`]
            : []),
          ...(!invalidProjectDeepLink &&
          !invalidDocumentDeepLink &&
          invalidDraftDeepLink
            ? [`${t('admin.fields.draft')}: ${search?.draft_id}`]
            : []),
        ]}
      />
      <SelectorGrid>
        <NativeSelect
          label={t('admin.fields.project')}
          value={projectId}
          onChange={handleProjectChange}
          placeholder={t('admin.placeholders.selectProject')}
          options={projectOptions}
        />
        <NativeSelect
          label={t('admin.fields.document')}
          value={documentId}
          onChange={handleDocumentChange}
          placeholder={t('admin.placeholders.selectDocument')}
          options={documentOptions}
        />
        <NativeSelect
          label={t('admin.fields.branch')}
          value={branchFilter}
          onChange={(value) => {
            setDraftId('')
            setReviewNote('')
            setPendingReviewAction(undefined)
            setBranchFilter(value)
            onSearchChange?.({
              branch_id: value || undefined,
              draft_id: undefined,
            })
          }}
          placeholder={t('admin.common.all')}
          options={[
            { value: '', label: t('admin.common.all') },
            ...(branchesQuery.data?.items.map((branch) => ({
              value: branch.id,
              label: entityOptionLabel(branch.name, branch.status, t),
            })) ?? []),
          ]}
        />
        <NativeSelect
          label={t('admin.fields.draft')}
          value={draftExistsInDocument ? draftId : ''}
          onChange={handleDraftSelect}
          placeholder={t('admin.fields.draft')}
          options={
            draftsQuery.data?.items.map((draft) => ({
              value: draft.id,
              label: draft.version_name,
            })) ?? []
          }
        />
      </SelectorGrid>
      {canDraftForRole && (
        <DraftEditorCard
          contextKey={`${authUser?.id ?? ''}:${projectId}:${documentId}:${draftId || 'new'}`}
          selectedDraft={selectedDraft}
          rawContent={editorRawContentQuery.data?.content}
          rawContentState={{
            isLoading: editorRawContentQuery.isLoading,
            isError: editorRawContentQuery.isError,
            error: editorRawContentQuery.error,
          }}
          branches={activeBranches}
          contextActive={activeDocumentContext}
          pending={createMutation.isPending || updateMutation.isPending}
          onClear={() => handleDraftSelect('')}
          onCreate={(payload) =>
            createMutation.mutateAsync({ projectId, documentId, payload })
          }
          onUpdate={(id, payload) =>
            updateMutation.mutateAsync({ projectId, documentId, id, payload })
          }
        />
      )}
      {canPublish && (
        <>
          <LoadingErrorState state={overviewQuery} />
          {promotionAvailable ? (
            <FormCard
              title={t('admin.sections.promoteDraft')}
              submitLabel={t('admin.common.createPromotionDraft')}
              pending={promoteMutation.isPending}
              onSubmit={async (formData) => {
                await promoteMutation.mutateAsync({
                  source_branch_id: fieldValue(formData, 'source_branch_id'),
                  target_branch_id: fieldValue(formData, 'target_branch_id'),
                  version_name: fieldValue(formData, 'version_name'),
                  changelog: fieldValue(formData, 'changelog'),
                })
                setPromoteSourceBranchId('')
                setPromoteTargetBranchId('')
              }}
            >
              <div className='grid gap-4 md:grid-cols-2'>
                <NativeSelect
                  name='source_branch_id'
                  label={t('admin.fields.sourceBranch')}
                  placeholder={t('admin.placeholders.selectPublishedBranch')}
                  options={promoteSourceOptions}
                  value={promoteSourceBranchId}
                  onChange={(value) => {
                    setPromoteSourceBranchId(value)
                    setPromoteTargetBranchId('')
                  }}
                  required
                />
                <NativeSelect
                  name='target_branch_id'
                  label={t('admin.fields.targetBranch')}
                  placeholder={t('admin.placeholders.selectBranch')}
                  options={promoteTargetOptions}
                  value={promoteTargetBranchId}
                  onChange={setPromoteTargetBranchId}
                  disabled={!promoteSourceBranchId}
                  required
                />
                <TextField
                  label={t('admin.fields.versionName')}
                  name='version_name'
                  required
                />
                <TextField
                  label={t('admin.fields.changelog')}
                  name='changelog'
                />
              </div>
            </FormCard>
          ) : (
            !overviewQuery.isLoading &&
            !overviewQuery.isError && (
              <Alert>
                <Route />
                <AlertTitle>{t('admin.promote.unavailableTitle')}</AlertTitle>
                <AlertDescription>
                  {t('admin.promote.unavailableDescription')}
                </AlertDescription>
              </Alert>
            )
          )}
        </>
      )}
      <DraftsTable
        drafts={draftsQuery.data?.items ?? []}
        selected={draftId}
        onSelect={handleDraftSelect}
        onAction={(id, action) =>
          actionMutation.mutate({
            projectId,
            documentId,
            draftId: id,
            action,
          })
        }
        canDraft={canDraft}
        pending={actionMutation.isPending}
        activeBranchIds={activeBranchIds}
      />
      {actionMutation.isError &&
        actionMutation.variables?.action === 'submit' && (
          <Alert variant='destructive' aria-live='polite'>
            <AlertCircle />
            <AlertTitle>{t('admin.common.error')}</AlertTitle>
            <AlertDescription>{actionMutation.error.message}</AlertDescription>
          </Alert>
        )}
      {selectedDraft?.review_comment && (
        <Alert>
          <BookOpenText />
          <AlertTitle>{t('admin.fields.reviewNote')}</AlertTitle>
          <AlertDescription>{selectedDraft.review_comment}</AlertDescription>
        </Alert>
      )}
      {selectedDraft?.diff_preview && (
        <CollectionCard
          title={t('admin.sections.diffPreview')}
          count={selectedDraft.diff_preview.items.length}
        >
          <DiffSummaryCards
            summary={selectedDraft.diff_preview.summary}
            isMarkdown={
              selectedDocument?.document_type === DOCUMENT_TYPE_MARKDOWN
            }
          />
          <DiffReviewList
            items={selectedDraft.diff_preview.items}
            isMarkdown={
              selectedDocument?.document_type === DOCUMENT_TYPE_MARKDOWN
            }
          />
        </CollectionCard>
      )}
      <SelectorGrid>
        <NativeSelect
          label={t('admin.fields.contentKind')}
          value={activeDraftContentKind}
          onChange={setContentKind}
          placeholder={t('admin.types.raw')}
          options={draftContentKindOptions}
        />
      </SelectorGrid>
      <ContentViewer
        title={t('admin.sections.contentViewer')}
        content={selectedDraftContent}
      />
      {selectedDocument?.document_type === DOCUMENT_TYPE_MARKDOWN &&
        selectedDraftContent && (
          <MarkdownPreview content={selectedDraftContent} />
        )}
      <AIContextPanel
        target={selectedDraftAITarget}
        interactive={selectedDraftAIInteractive}
        canRegenerate={canPublishForRole && selectedDraftAIInteractive}
      />
      {canPublish && (
        <ReviewNotePanel
          selectedDraftName={selectedDraft?.version_name}
          value={reviewNote}
          onChange={setReviewNote}
          pending={actionMutation.isPending}
          reviewable={canReviewSelectedDraft}
          onReview={(action) => {
            if (!selectedDraft || !canReviewSelectedDraft) return
            actionMutation.reset()
            setPendingReviewAction({
              projectId,
              documentId,
              draftId: selectedDraft.id,
              draftName: selectedDraft.version_name,
              action,
              comment: reviewComment(reviewNote)?.comment,
            })
          }}
        />
      )}
      <ConfirmDialog
        open={pendingReviewAction !== undefined}
        onOpenChange={(open) => {
          if (!open && !actionMutation.isPending) {
            setPendingReviewAction(undefined)
            actionMutation.reset()
          }
        }}
        title={reviewConfirmation?.title ?? ''}
        desc={reviewConfirmation?.description ?? ''}
        confirmText={reviewConfirmation?.confirmText}
        destructive={reviewConfirmation?.destructive}
        isLoading={actionMutation.isPending}
        handleConfirm={() => {
          if (!pendingReviewAction || reviewActionLockedRef.current) return
          reviewActionLockedRef.current = true
          actionMutation.mutate({
            projectId: pendingReviewAction.projectId,
            documentId: pendingReviewAction.documentId,
            draftId: pendingReviewAction.draftId,
            action: pendingReviewAction.action,
            comment: pendingReviewAction.comment,
          })
        }}
      >
        {actionMutation.isError && (
          <Alert variant='destructive' aria-live='polite'>
            <AlertCircle />
            <AlertTitle>{t('admin.common.error')}</AlertTitle>
            <AlertDescription>
              {actionMutation.error instanceof Error
                ? actionMutation.error.message
                : t('toasts.somethingWrong')}
            </AlertDescription>
          </Alert>
        )}
      </ConfirmDialog>
    </PageChrome>
  )
}

type CreateDraftPayload = Parameters<typeof createDraft>[2]

type UpdateDraftPayload = Parameters<typeof updateDraft>[3]

function DraftEditorCard({
  contextKey,
  selectedDraft,
  rawContent,
  rawContentState,
  branches,
  contextActive,
  pending,
  onClear,
  onCreate,
  onUpdate,
}: {
  contextKey: string
  selectedDraft?: DraftDTO
  rawContent?: string
  rawContentState: QueryState
  branches: BranchDTO[]
  contextActive: boolean
  pending: boolean
  onClear: () => void
  onCreate: (payload: CreateDraftPayload) => Promise<unknown>
  onUpdate: (id: string, payload: UpdateDraftPayload) => Promise<unknown>
}) {
  const { t } = useLanguage()
  const editor = useDraftEditorState(contextKey, selectedDraft, rawContent)
  const [submitting, setSubmitting] = useState(false)
  const busy = pending || submitting
  const editable = Boolean(
    selectedDraft &&
    (selectedDraft.status === DRAFT_STATUS_DRAFT ||
      selectedDraft.status === DRAFT_STATUS_CHANGES_REQUESTED)
  )
  const selectedBranchActive = selectedDraft
    ? branches.some((branch) => branch.id === selectedDraft.branch_id)
    : true

  if (selectedDraft && !editable) {
    return (
      <Card className='border-primary/20'>
        <CardHeader className='border-b pb-5'>
          <Badge variant='outline' className='w-fit'>
            {draftStatusLabel(selectedDraft.status, t)}
          </Badge>
          <CardTitle>{t('admin.draftEditor.readOnlyTitle')}</CardTitle>
          <CardDescription>
            {t('admin.draftEditor.readOnlyDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type='button' variant='outline' onClick={onClear}>
            {t('admin.draftEditor.newDraft')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (editable && rawContentState.isLoading) {
    return <LoadingErrorState state={rawContentState} />
  }

  return (
    <FormCard
      key={contextKey}
      title={
        editable
          ? t('admin.draftEditor.editTitle')
          : t('admin.draftEditor.createTitle')
      }
      submitLabel={
        editable ? t('admin.common.update') : t('admin.common.create')
      }
      pending={busy}
      resetOnSuccess={false}
      disabled={
        !contextActive ||
        !selectedBranchActive ||
        editor.conflict ||
        (editable && (rawContent === undefined || rawContentState.isError))
      }
      onSubmit={async () => {
        if (editor.conflict)
          throw new Error(t('admin.draftEditor.conflictDescription'))
        setSubmitting(true)
        try {
          const file = editor.values.file
          const uploadedContent =
            file instanceof File && file.size > 0 ? await file.text() : ''
          const content = uploadedContent || editor.values.content
          const payload = {
            version_name: editor.values.version_name,
            changelog: editor.values.changelog,
            source_git_commit_id: editor.values.source_git_commit_id,
            content,
            schema_content: content,
          }
          if (editable && selectedDraft) {
            await onUpdate(selectedDraft.id, payload)
          } else {
            await onCreate({
              ...payload,
              branch_id: editor.values.branch_id,
            })
          }
          editor.saved()
        } finally {
          setSubmitting(false)
        }
      }}
    >
      {editable && (
        <div className='flex flex-wrap items-center justify-between gap-3 rounded-md border bg-[var(--surface-control)] p-3'>
          <p className='text-sm text-muted-foreground'>
            {t('admin.draftEditor.branchImmutable')}
          </p>
          <Button type='button' variant='outline' size='sm' onClick={onClear}>
            {t('admin.draftEditor.newDraft')}
          </Button>
        </div>
      )}
      {(!contextActive || !selectedBranchActive) && (
        <Alert>
          <AlertCircle />
          <AlertTitle>{t('admin.draftEditor.archivedTitle')}</AlertTitle>
          <AlertDescription>
            {t('admin.draftEditor.archivedDescription')}
          </AlertDescription>
        </Alert>
      )}
      {rawContentState.isError && <LoadingErrorState state={rawContentState} />}
      {editor.dirty && (
        <p role='status' className='text-sm text-muted-foreground'>
          {t('admin.draftEditor.unsavedDescription')}
        </p>
      )}
      {editor.conflict && (
        <Alert aria-live='polite'>
          <AlertCircle />
          <AlertTitle>{t('admin.draftEditor.conflictTitle')}</AlertTitle>
          <AlertDescription>
            <p>{t('admin.draftEditor.conflictDescription')}</p>
            <div className='flex flex-wrap gap-2 pt-2'>
              <Button
                type='button'
                variant='outline'
                disabled={busy}
                onClick={editor.keepEdits}
              >
                {t('admin.draftEditor.keepEdits')}
              </Button>
              <Button
                type='button'
                variant='outline'
                disabled={busy}
                onClick={editor.reload}
              >
                {t('admin.draftEditor.reload')}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      <fieldset className='grid min-w-0 gap-4' disabled={busy}>
        <div className='grid gap-4 md:grid-cols-2'>
          {editable ? (
            <TextField
              label={t('admin.fields.branch')}
              name='branch_display'
              defaultValue={
                branches.find(
                  (branch) => branch.id === selectedDraft?.branch_id
                )?.name ?? selectedDraft?.branch_id
              }
              readOnly
            />
          ) : (
            <NativeSelect
              name='branch_id'
              label={t('admin.fields.branch')}
              placeholder={t('admin.placeholders.selectBranch')}
              value={editor.values.branch_id}
              onChange={(value) => editor.change('branch_id', value)}
              options={branches.map((branch) => ({
                value: branch.id,
                label: branch.name,
              }))}
              required
            />
          )}
          <TextField
            label={t('admin.fields.versionName')}
            name='version_name'
            value={editor.values.version_name}
            onChange={(value) => editor.change('version_name', value)}
            required
          />
          <TextField
            label={t('admin.fields.gitCommit')}
            name='source_git_commit_id'
            value={editor.values.source_git_commit_id}
            onChange={(value) => editor.change('source_git_commit_id', value)}
          />
          <TextField
            label={t('admin.fields.changelog')}
            name='changelog'
            value={editor.values.changelog}
            onChange={(value) => editor.change('changelog', value)}
          />
        </div>
        <TextAreaField
          label={t('admin.fields.content')}
          name='content'
          value={editor.values.content}
          onChange={(value) => editor.change('content', value)}
        />
        <div className='grid gap-2'>
          <Label htmlFor={`schema-file-${selectedDraft?.id ?? 'new'}`}>
            {t('admin.fields.schemaFile')}
          </Label>
          <Input
            id={`schema-file-${selectedDraft?.id ?? 'new'}`}
            name='schema_file'
            type='file'
            onChange={(event) => {
              editor.change('file', event.currentTarget.files?.[0])
              event.currentTarget.value = ''
            }}
            accept='.yaml,.yml,.json,.md,text/markdown,application/json,application/yaml,text/yaml'
          />
          {editor.values.file && (
            <div className='flex flex-wrap items-center gap-2 text-sm'>
              <span className='break-all'>{editor.values.file.name}</span>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => editor.change('file', undefined)}
              >
                {t('admin.draftEditor.removeFile')}
              </Button>
            </div>
          )}
        </div>
      </fieldset>
    </FormCard>
  )
}

function reviewComment(value: string): DraftReviewPayload | undefined {
  const comment = value.trim()
  return comment.length > 0 ? { comment } : undefined
}

function runDraftAction(request: DraftActionRequest) {
  if (request.action === 'submit') {
    return submitDraft(request.projectId, request.documentId, request.draftId)
  }
  const payload = reviewComment(request.comment ?? '')
  if (request.action === 'approve') {
    return approveDraft(
      request.projectId,
      request.documentId,
      request.draftId,
      payload
    )
  }
  if (request.action === 'request') {
    return requestDraftChanges(
      request.projectId,
      request.documentId,
      request.draftId,
      payload
    )
  }
  return rejectDraft(
    request.projectId,
    request.documentId,
    request.draftId,
    payload
  )
}

function draftReviewConfirmation(
  review: {
    readonly draftName: string
    readonly action: DraftReviewAction
  },
  t: ReturnType<typeof useLanguage>['t']
) {
  if (review.action === 'approve') {
    return {
      title: t('admin.review.confirmApproveTitle', {
        draft: review.draftName,
      }),
      description: t('admin.review.confirmApproveDescription'),
      confirmText: t('admin.common.approve'),
      destructive: false,
    }
  }
  if (review.action === 'request') {
    return {
      title: t('admin.review.confirmRequestTitle', {
        draft: review.draftName,
      }),
      description: t('admin.review.confirmRequestDescription'),
      confirmText: t('admin.common.requestChanges'),
      destructive: false,
    }
  }
  return {
    title: t('admin.review.confirmRejectTitle', { draft: review.draftName }),
    description: t('admin.review.confirmRejectDescription'),
    confirmText: t('admin.common.reject'),
    destructive: true,
  }
}

function ReviewNotePanel({
  selectedDraftName,
  value,
  onChange,
  pending,
  reviewable,
  onReview,
}: {
  readonly selectedDraftName?: string
  readonly value: string
  readonly onChange: (value: string) => void
  readonly pending: boolean
  readonly reviewable: boolean
  readonly onReview: (action: DraftReviewAction) => void
}) {
  const { t } = useLanguage()
  const noteId = useId()
  return (
    <Card className='border-primary/20'>
      <CardHeader className='border-b pb-5'>
        <Badge
          className='w-fit border-primary/20 bg-primary/8 text-primary'
          variant='outline'
        >
          {t('admin.review.noteTitle')}
        </Badge>
        <CardTitle>{t('admin.fields.reviewNote')}</CardTitle>
        <CardDescription>{t('admin.review.noteDescription')}</CardDescription>
      </CardHeader>
      <CardContent className='grid gap-3'>
        <p className='text-sm text-muted-foreground'>
          {selectedDraftName
            ? t('admin.review.selectedDraft', { draft: selectedDraftName })
            : t('admin.review.noDraftSelected')}
        </p>
        <div className='grid gap-2'>
          <Label htmlFor={noteId}>{t('admin.fields.reviewNote')}</Label>
          <Textarea
            id={noteId}
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
            placeholder={t('admin.placeholders.reviewNote')}
            disabled={pending || !reviewable}
            className='min-h-24'
          />
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button
            type='button'
            disabled={pending || !reviewable}
            onClick={() => onReview('approve')}
          >
            {t('admin.common.approve')}
          </Button>
          <Button
            type='button'
            variant='outline'
            disabled={pending || !reviewable}
            onClick={() => onReview('request')}
          >
            {t('admin.common.requestChanges')}
          </Button>
          <Button
            type='button'
            variant='destructive'
            disabled={pending || !reviewable}
            onClick={() => onReview('reject')}
          >
            {t('admin.common.reject')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function DraftsTable({
  drafts,
  selected,
  onSelect,
  onAction,
  canDraft,
  pending,
  activeBranchIds,
}: {
  drafts: DraftDTO[]
  selected: string
  onSelect: (id: string) => void
  onAction: (id: string, action: DraftAction) => void
  canDraft: boolean
  pending: boolean
  activeBranchIds: ReadonlySet<string>
}) {
  const { t } = useLanguage()
  return (
    <CollectionCard title={t('admin.sections.drafts')} count={drafts.length}>
      {drafts.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.fields.versionName')}</TableHead>
              <TableHead>{t('admin.fields.status')}</TableHead>
              <TableHead>{t('admin.fields.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drafts.map((draft) => {
              const canSubmit =
                canDraft &&
                activeBranchIds.has(draft.branch_id) &&
                (draft.status === DRAFT_STATUS_DRAFT ||
                  draft.status === DRAFT_STATUS_CHANGES_REQUESTED)
              return (
                <TableRow
                  key={draft.id}
                  data-state={selected === draft.id ? 'selected' : undefined}
                >
                  <TableCell>
                    <button
                      type='button'
                      className='font-medium underline-offset-4 hover:underline'
                      onClick={() => onSelect(draft.id)}
                    >
                      {draft.version_name}
                    </button>
                    <div className='text-xs text-muted-foreground'>
                      {draft.changelog}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge>
                      {draftStatusLabel(draft.status, t)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={() => onSelect(draft.id)}
                      >
                        {t('admin.common.view')}
                      </Button>
                      {canDraft && (
                        <Button
                          variant='outline'
                          size='sm'
                          disabled={pending || !canSubmit}
                          onClick={() => onAction(draft.id, 'submit')}
                        >
                          {t('admin.common.submit')}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyState preset='drafts' />
      )}
    </CollectionCard>
  )
}
