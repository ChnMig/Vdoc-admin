import { useState, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import {
  archiveBranch,
  archiveDocument,
  createBranch,
  createDocument,
  getDocumentOverview,
  listBranches,
  listProjectMembers,
  updateBranch,
  updateDocument,
  type BranchDTO,
  type DocumentDTO,
} from '@/lib/vdoc-api'
import { type VdocPageDeepLinkProps } from '@/lib/vdoc-route-search'
import { useLanguage } from '@/context/language-provider'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DocumentFormFields,
  documentPayloadFromFormData,
} from './document-form-fields'
import { DocumentSharePanel } from './document-share-panel'
import {
  PageChrome,
  LoadingErrorState,
  DeepLinkAlert,
  SelectorGrid,
  NativeSelect,
  FormDialog,
  TextField,
  CollectionCard,
  StatusBadge,
  ConfirmActionButton,
  EmptyState,
} from './page-shared'
import {
  ACTIVE_STATUS,
  ARCHIVED_OR_DISABLED_STATUS,
  DOCUMENT_TYPE_MARKDOWN,
  DOCUMENT_TYPE_TEXT,
  isTextDocumentType,
  useInvalidateResources,
  useProjectsAndSelection,
  useDocumentsAndSelection,
  activeProjectRole,
  ROLE_ADMIN,
  DOCUMENT_TYPE_OPENAPI,
  fieldValue,
} from './page-utils'

function resourceStatusLabel(
  status: number,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (status === ACTIVE_STATUS) return t('admin.statuses.active')
  if (status === ARCHIVED_OR_DISABLED_STATUS)
    return t('admin.statuses.archived')
  return `${t('admin.common.unknown')} ${status}`
}

function documentTypeLabel(
  type: number,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (type === DOCUMENT_TYPE_MARKDOWN) return t('admin.types.markdown')
  if (type === DOCUMENT_TYPE_TEXT) return t('admin.types.text')
  return t('admin.types.openapi')
}

export function DocumentsPage({
  search,
  onSearchChange,
  workspaceSettings = false,
}: VdocPageDeepLinkProps & { workspaceSettings?: boolean } = {}) {
  const { t } = useLanguage()
  const invalidate = useInvalidateResources()
  const authUser = useAuthStore((state) => state.auth.user)
  const authSessionVersion = useAuthStore((state) => state.auth.sessionVersion)
  const [documentTypeFilter, setDocumentTypeFilter] = useState(0)
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
    documentsQuery,
    documentId,
    setDocumentId,
    documentOptions,
    invalidDocumentDeepLink,
  } = useDocumentsAndSelection(
    projectId,
    documentTypeFilter > 0 ? documentTypeFilter : undefined,
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
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: ({ signal }) => listProjectMembers(projectId, { signal }),
    enabled: projectId.length > 0 && !authUser?.is_super_admin,
  })
  const canManageShares = Boolean(
    authUser?.is_super_admin ||
    activeProjectRole(membersQuery.data?.items, authUser?.id) === ROLE_ADMIN
  )
  const canManageDocuments = canManageShares
  const selectedProject = projectsQuery.data?.items.find(
    (project) => project.id === projectId
  )
  const selectedDocument = documentsQuery.data?.items.find(
    (document) => document.id === documentId
  )
  const canMutateProject = Boolean(
    canManageDocuments && selectedProject?.status === ACTIVE_STATUS
  )
  const canMutateDocument = Boolean(
    canMutateProject && selectedDocument?.status === ACTIVE_STATUS
  )
  const overviewQuery = useQuery({
    queryKey: ['document-overview', projectId, documentId],
    queryFn: ({ signal }) =>
      getDocumentOverview(projectId, documentId, { signal }),
    enabled: Boolean(projectId && documentId),
  })
  const latestDocumentVersion = overviewQuery.data?.latest_version
  const createDocumentMutation = useMutation({
    mutationFn: (request: { projectId: string; formData: FormData }) =>
      documentPayloadFromFormData(request.formData, t).then((payload) =>
        createDocument(request.projectId, payload)
      ),
    onSuccess: (result, request) =>
      invalidate({
        kind: 'document',
        projectId: request.projectId,
        documentId: result.id,
      }),
  })
  const updateDocumentMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: Parameters<typeof updateDocument>[2]
    }) => updateDocument(projectId, id, payload),
    onMutate: () => ({ projectId, documentId }),
    onSuccess: (result, _variables, context) =>
      invalidate({
        kind: 'document',
        projectId: context?.projectId ?? projectId,
        documentId: result.id,
      }),
  })
  const archiveDocumentMutation = useMutation({
    mutationFn: (id: string) => archiveDocument(projectId, id),
    onMutate: () => ({ projectId, documentId }),
    onSuccess: (result, _variables, context) =>
      invalidate({
        kind: 'document',
        projectId: context?.projectId ?? projectId,
        documentId: result.id,
      }),
  })
  const createBranchMutation = useMutation({
    mutationFn: (payload: Parameters<typeof createBranch>[2]) =>
      createBranch(projectId, documentId, payload),
    onMutate: () => ({ projectId, documentId }),
    onSuccess: (result, _variables, context) =>
      invalidate({
        kind: 'document',
        projectId: context?.projectId ?? projectId,
        documentId: result.document_id,
      }),
  })
  const updateBranchMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string
      payload: Parameters<typeof updateBranch>[3]
    }) => updateBranch(projectId, documentId, id, payload),
    onMutate: () => ({ projectId, documentId }),
    onSuccess: (result, _variables, context) =>
      invalidate({
        kind: 'document',
        projectId: context?.projectId ?? projectId,
        documentId: result.document_id,
      }),
  })
  const archiveBranchMutation = useMutation({
    mutationFn: (id: string) => archiveBranch(projectId, documentId, id),
    onMutate: () => ({ projectId, documentId }),
    onSuccess: (result, _variables, context) =>
      invalidate({
        kind: 'document',
        projectId: context?.projectId ?? projectId,
        documentId: result.document_id,
      }),
  })
  return (
    <PageChrome page='documents'>
      <LoadingErrorState
        state={{
          isLoading: projectsQuery.isLoading || documentsQuery.isLoading,
          isError: projectsQuery.isError || documentsQuery.isError,
          error: projectsQuery.error ?? documentsQuery.error,
        }}
      />
      <DeepLinkAlert
        targets={[
          ...(invalidProjectDeepLink
            ? [`${t('admin.fields.project')}: ${search?.project_id}`]
            : []),
          ...(!invalidProjectDeepLink && invalidDocumentDeepLink
            ? [`${t('admin.fields.document')}: ${search?.document_id}`]
            : []),
        ]}
      />
      {!workspaceSettings && (
        <SelectorGrid>
          <NativeSelect
            label={t('admin.fields.project')}
            value={projectId}
            onChange={setProjectId}
            placeholder={t('admin.placeholders.selectProject')}
            options={projectOptions}
          />
          <NativeSelect
            label={t('admin.fields.document')}
            value={documentId}
            onChange={setDocumentId}
            placeholder={t('admin.placeholders.selectDocument')}
            options={documentOptions}
          />
          <NativeSelect
            label={t('admin.fields.type')}
            value={String(documentTypeFilter)}
            onChange={(value) => {
              setDocumentTypeFilter(Number(value))
              setDocumentId('')
            }}
            placeholder={t('admin.common.all')}
            options={[
              { value: '0', label: t('admin.common.all') },
              ...documentTypeOptions(t),
            ]}
          />
        </SelectorGrid>
      )}
      <DocumentsTable
        key={`${authSessionVersion}:${projectId}`}
        actions={
          canMutateProject &&
          !workspaceSettings && (
            <FormDialog
              title={t('admin.sections.createDocument')}
              submitLabel={t('admin.common.create')}
              pending={createDocumentMutation.isPending}
              submissionScope={JSON.stringify([
                authSessionVersion,
                authUser?.id,
                projectId,
              ])}
              onSubmit={(formData) =>
                createDocumentMutation.mutateAsync({
                  projectId,
                  formData,
                })
              }
            >
              <DocumentFormFields projectId={projectId} />
            </FormDialog>
          )
        }
        documents={
          workspaceSettings
            ? selectedDocument
              ? [selectedDocument]
              : []
            : (documentsQuery.data?.items ?? [])
        }
        pending={
          updateDocumentMutation.isPending || archiveDocumentMutation.isPending
        }
        onUpdate={(document) =>
          updateDocumentMutation.mutateAsync({
            id: document.id,
            payload: {
              name: document.name,
              description: document.description ?? '',
              file_name:
                document.file_name ??
                document.relative_path?.split('/').pop() ??
                '',
              folder_id: document.folder_id ?? null,
            },
          })
        }
        onArchive={(id) => archiveDocumentMutation.mutateAsync(id)}
        readOnly={!canMutateProject}
      />
      {documentId && <LoadingErrorState state={overviewQuery} />}
      {documentId && !workspaceSettings && (
        <dl className='grid min-w-0 grid-cols-2 gap-5 rounded-lg border bg-card p-5 text-sm lg:grid-cols-4'>
          {[
            [
              t('admin.sections.versions'),
              overviewQuery.data
                ? String(overviewQuery.data.version_count)
                : '—',
            ],
            [
              t('admin.fields.versionName'),
              latestDocumentVersion?.version_name ?? '—',
            ],
            [
              isTextDocumentType(selectedDocument?.document_type)
                ? t('admin.markdownFacts.lineCount', {
                    count: String(overviewQuery.data?.raw_line_count ?? '—'),
                  })
                : t('admin.sections.endpoints'),
              isTextDocumentType(selectedDocument?.document_type)
                ? overviewQuery.data
                  ? `${overviewQuery.data.raw_size_bytes} B`
                  : '—'
                : overviewQuery.data
                  ? String(overviewQuery.data.endpoint_count)
                  : '—',
            ],
            [
              t('admin.sections.branches'),
              String(branchesQuery.data?.total ?? 0),
            ],
          ].map(([label, value]) => (
            <div key={label} className='min-w-0 space-y-2'>
              <dt className='text-muted-foreground'>{label}</dt>
              <dd className='font-semibold break-words tabular-nums'>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <BranchesTable
        key={`${authSessionVersion}:${projectId}:${documentId}`}
        actions={
          canMutateDocument && (
            <FormDialog
              title={t('admin.sections.createBranch')}
              submitLabel={t('admin.common.create')}
              pending={createBranchMutation.isPending}
              submissionScope={JSON.stringify([
                authSessionVersion,
                authUser?.id,
                projectId,
                documentId,
              ])}
              onSubmit={(formData) =>
                createBranchMutation.mutateAsync({
                  name: fieldValue(formData, 'name'),
                  description: fieldValue(formData, 'description'),
                })
              }
            >
              <div className='grid gap-4'>
                <TextField
                  label={t('admin.fields.name')}
                  name='name'
                  required
                />
                <TextField
                  label={t('admin.fields.description')}
                  name='description'
                />
              </div>
            </FormDialog>
          )
        }
        branches={branchesQuery.data?.items ?? []}
        pending={
          updateBranchMutation.isPending || archiveBranchMutation.isPending
        }
        onUpdate={(branch) =>
          updateBranchMutation.mutateAsync({
            id: branch.id,
            payload: {
              name: branch.name,
              description: branch.description ?? '',
              is_default: branch.is_default,
              is_protected: branch.is_protected,
            },
          })
        }
        onArchive={(id) => archiveBranchMutation.mutateAsync(id)}
        readOnly={!canMutateDocument}
      />
      {!workspaceSettings && (
        <DocumentSharePanel
          key={`${projectId}:${documentId}`}
          projectId={projectId}
          documentId={documentId}
          documentName={selectedDocument?.name ?? ''}
          branches={branchesQuery.data?.items ?? []}
          publishedBranchIds={overviewQuery.data?.published_branch_ids ?? []}
          canManage={canManageShares}
          interactive={canMutateDocument}
        />
      )}
    </PageChrome>
  )
}

function documentTypeOptions(t: ReturnType<typeof useLanguage>['t']) {
  return [
    { value: String(DOCUMENT_TYPE_OPENAPI), label: t('admin.types.openapi') },
    { value: String(DOCUMENT_TYPE_MARKDOWN), label: t('admin.types.markdown') },
    { value: String(DOCUMENT_TYPE_TEXT), label: t('admin.types.text') },
  ]
}

function DocumentsTable({
  documents,
  onUpdate,
  onArchive,
  pending,
  readOnly = false,
  actions,
}: {
  documents: DocumentDTO[]
  onUpdate: (document: DocumentDTO) => Promise<unknown>
  onArchive: (id: string) => Promise<unknown>
  pending: boolean
  readOnly?: boolean
  actions?: ReactNode
}) {
  const { t } = useLanguage()
  return (
    <CollectionCard
      title={t('nav.documents')}
      count={documents.length}
      actions={actions}
    >
      {documents.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.fields.name')}</TableHead>
              <TableHead>{t('admin.fields.type')}</TableHead>
              <TableHead>{t('admin.fields.status')}</TableHead>
              {!readOnly && <TableHead>{t('admin.fields.actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((document) => (
              <TableRow key={document.id}>
                <TableCell className='min-w-56 whitespace-normal'>
                  <div className='grid gap-1'>
                    <span className='font-medium break-words'>
                      {document.name}
                    </span>
                    <span className='font-mono text-xs break-all text-muted-foreground'>
                      {document.relative_path}
                    </span>
                    {document.description && (
                      <span className='text-sm break-words text-muted-foreground'>
                        {document.description}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {documentTypeLabel(document.document_type, t)}
                </TableCell>
                <TableCell>
                  <StatusBadge>
                    {resourceStatusLabel(document.status, t)}
                  </StatusBadge>
                </TableCell>
                {!readOnly && (
                  <TableCell>
                    {document.status === ACTIVE_STATUS && (
                      <div className='flex items-center justify-center gap-2'>
                        <DocumentEditForm
                          document={document}
                          pending={pending}
                          onUpdate={onUpdate}
                        />
                        <ConfirmActionButton
                          label={t('admin.common.archive')}
                          title={t('admin.confirm.archiveDocumentTitle', {
                            name: document.name,
                          })}
                          description={t(
                            'admin.confirm.archiveDocumentDescription'
                          )}
                          pending={pending}
                          onConfirm={() => onArchive(document.id)}
                        />
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState preset='documents' />
      )}
    </CollectionCard>
  )
}

function DocumentEditForm({
  document,
  pending,
  onUpdate,
}: {
  document: DocumentDTO
  pending: boolean
  onUpdate: (document: DocumentDTO) => Promise<unknown>
}) {
  const { t } = useLanguage()
  return (
    <FormDialog
      title={t('admin.sections.editDocument')}
      description={document.name}
      triggerLabel={t('admin.common.edit')}
      triggerVariant='outline'
      triggerSize='sm'
      submitLabel={t('admin.common.save')}
      pending={pending}
      submissionScope={document.id}
      onSubmit={async (formData) => {
        const values = await documentPayloadFromFormData(formData, t)
        return onUpdate({
          ...document,
          name: values.name,
          description: values.description,
          file_name: values.file_name,
          folder_id: values.folder_id,
        })
      }}
    >
      <DocumentFormFields projectId={document.project_id} document={document} />
    </FormDialog>
  )
}

function BranchesTable({
  branches,
  onUpdate,
  onArchive,
  pending,
  readOnly = false,
  actions,
}: {
  branches: BranchDTO[]
  onUpdate: (branch: BranchDTO) => Promise<unknown>
  onArchive: (id: string) => Promise<unknown>
  pending: boolean
  readOnly?: boolean
  actions?: ReactNode
}) {
  const { t } = useLanguage()
  return (
    <CollectionCard
      title={t('admin.sections.branches')}
      count={branches.length}
      actions={actions}
    >
      {branches.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.fields.name')}</TableHead>
              <TableHead>{t('admin.fields.status')}</TableHead>
              {!readOnly && <TableHead>{t('admin.fields.actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell className='min-w-56 whitespace-normal'>
                  <div className='grid gap-1'>
                    <span className='font-medium break-words'>
                      {branch.name}
                    </span>
                    <span className='text-sm break-words text-muted-foreground'>
                      {branch.description || t('admin.common.none')}
                    </span>
                    <div className='flex flex-wrap justify-center gap-2'>
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
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge>
                    {resourceStatusLabel(branch.status, t)}
                  </StatusBadge>
                </TableCell>
                {!readOnly && (
                  <TableCell>
                    {branch.status === ACTIVE_STATUS && (
                      <div className='flex items-center justify-center gap-2'>
                        <BranchEditForm
                          branch={branch}
                          pending={pending}
                          onUpdate={onUpdate}
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
                          onConfirm={() => onArchive(branch.id)}
                        />
                      </div>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState preset='branches' />
      )}
    </CollectionCard>
  )
}

function BranchEditForm({
  branch,
  pending,
  onUpdate,
}: {
  branch: BranchDTO
  pending: boolean
  onUpdate: (branch: BranchDTO) => Promise<unknown>
}) {
  const { t } = useLanguage()
  // Untouched fields follow the latest server data after a branch refetch.
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
      submissionScope={branch.id}
      resetOnSuccess={false}
      onOpenChange={(open) => {
        if (!open) setEdits({})
      }}
      onSubmit={async () => {
        const submittedEdits = edits
        await onUpdate({
          ...branch,
          name: (edits.name ?? branch.name).trim(),
          description: (edits.description ?? branch.description ?? '').trim(),
          is_default: branch.is_default || (edits.is_default ?? false),
          is_protected: edits.is_protected ?? branch.is_protected,
        })
        setEdits((current) => {
          // Keep changes made while this save was pending.
          const remaining = { ...current }
          for (const field of [
            'name',
            'description',
            'is_default',
            'is_protected',
          ] as const) {
            if (current[field] === submittedEdits[field])
              delete remaining[field]
          }
          return remaining
        })
      }}
    >
      <TextField
        name='name'
        value={edits.name ?? branch.name}
        onChange={(name) => setEdits((current) => ({ ...current, name }))}
        label={t('admin.fields.name')}
        required
      />
      <TextField
        name='description'
        value={edits.description ?? branch.description ?? ''}
        onChange={(description) =>
          setEdits((current) => ({ ...current, description }))
        }
        label={t('admin.fields.description')}
      />
      <div className='grid gap-3'>
        <label className='flex items-center gap-2 text-sm'>
          <Checkbox
            name='is_default'
            checked={branch.is_default || (edits.is_default ?? false)}
            onCheckedChange={(checked) => {
              const is_default = checked === true
              setEdits((current) => ({ ...current, is_default }))
            }}
            disabled={branch.is_default}
          />
          {t('admin.fields.defaultBranch')}
        </label>
        <label className='flex items-center gap-2 text-sm'>
          <Checkbox
            name='is_protected'
            checked={edits.is_protected ?? branch.is_protected}
            onCheckedChange={(checked) => {
              const is_protected = checked === true
              setEdits((current) => ({ ...current, is_protected }))
            }}
          />
          {t('admin.fields.protectedBranch')}
        </label>
      </div>
    </FormDialog>
  )
}
