import { useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DocumentSharePanel } from './document-share-panel'
import {
  PageChrome,
  LoadingErrorState,
  DeepLinkAlert,
  SelectorGrid,
  NativeSelect,
  FormCard,
  TextField,
  StatCard,
  CollectionCard,
  StatusBadge,
  ConfirmActionButton,
  EmptyState,
} from './page-shared'
import {
  ACTIVE_STATUS,
  ARCHIVED_OR_DISABLED_STATUS,
  DOCUMENT_TYPE_MARKDOWN,
  useInvalidateResources,
  useProjectsAndSelection,
  useDocumentsAndSelection,
  activeProjectRole,
  ROLE_ADMIN,
  DOCUMENT_TYPE_OPENAPI,
  fieldValue,
  numberValue,
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
  return t('admin.types.openapi')
}

export function DocumentsPage({
  search,
  onSearchChange,
}: VdocPageDeepLinkProps = {}) {
  const { t } = useLanguage()
  const invalidate = useInvalidateResources()
  const authUser = useAuthStore((state) => state.auth.user)
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
    mutationFn: (payload: Parameters<typeof createDocument>[1]) =>
      createDocument(projectId, payload),
    onMutate: () => ({ projectId, documentId }),
    onSuccess: (result, _variables, context) =>
      invalidate({
        kind: 'document',
        projectId: context?.projectId ?? projectId,
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
      {canMutateProject && (
        <FormCard
          title={t('admin.sections.createDocument')}
          submitLabel={t('admin.common.create')}
          pending={createDocumentMutation.isPending}
          onSubmit={(formData) =>
            createDocumentMutation.mutateAsync({
              name: fieldValue(formData, 'name'),
              description: fieldValue(formData, 'description'),
              relative_path: fieldValue(formData, 'relative_path'),
              document_type: numberValue(
                formData,
                'document_type',
                DOCUMENT_TYPE_OPENAPI
              ),
            })
          }
        >
          <div className='grid gap-4 md:grid-cols-2'>
            <TextField label={t('admin.fields.name')} name='name' required />
            <TextField
              label={t('admin.fields.relativePath')}
              name='relative_path'
              required
            />
            <NativeSelect
              name='document_type'
              label={t('admin.fields.type')}
              placeholder={t('admin.types.openapi')}
              options={documentTypeOptions(t)}
            />
            <TextField
              label={t('admin.fields.description')}
              name='description'
            />
          </div>
        </FormCard>
      )}
      <DocumentsTable
        documents={documentsQuery.data?.items ?? []}
        pending={
          updateDocumentMutation.isPending || archiveDocumentMutation.isPending
        }
        onUpdate={(document) =>
          updateDocumentMutation.mutateAsync({
            id: document.id,
            payload: {
              name: document.name,
              description: document.description ?? '',
              relative_path: document.relative_path ?? '',
            },
          })
        }
        onArchive={(id) => archiveDocumentMutation.mutateAsync(id)}
        readOnly={!canMutateProject}
      />
      {documentId && <LoadingErrorState state={overviewQuery} />}
      {documentId && (
        <section className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <StatCard
            title={t('admin.sections.versions')}
            value={
              overviewQuery.data
                ? String(overviewQuery.data.version_count)
                : '—'
            }
            description={t('admin.pages.versions.cue')}
          />
          <StatCard
            title={t('admin.fields.versionName')}
            value={latestDocumentVersion?.version_name ?? '—'}
            description={t('admin.pages.versions.next')}
          />
          <StatCard
            title={
              documentsQuery.data?.items.find((item) => item.id === documentId)
                ?.document_type === DOCUMENT_TYPE_MARKDOWN
                ? t('admin.markdownFacts.lineCount', {
                    count: String(overviewQuery.data?.raw_line_count ?? '—'),
                  })
                : t('admin.sections.endpoints')
            }
            value={
              documentsQuery.data?.items.find((item) => item.id === documentId)
                ?.document_type === DOCUMENT_TYPE_MARKDOWN
                ? overviewQuery.data
                  ? `${overviewQuery.data.raw_size_bytes} B`
                  : '—'
                : overviewQuery.data
                  ? String(overviewQuery.data.endpoint_count)
                  : '—'
            }
            description={t('admin.pages.documents.cue')}
          />
          <StatCard
            title={t('admin.sections.branches')}
            value={String(branchesQuery.data?.total ?? 0)}
            description={t('admin.pages.documents.next')}
          />
        </section>
      )}
      {canMutateDocument && (
        <FormCard
          title={t('admin.sections.createBranch')}
          submitLabel={t('admin.common.create')}
          pending={createBranchMutation.isPending}
          onSubmit={(formData) =>
            createBranchMutation.mutateAsync({
              name: fieldValue(formData, 'name'),
              description: fieldValue(formData, 'description'),
            })
          }
        >
          <div className='grid gap-4 md:grid-cols-2'>
            <TextField label={t('admin.fields.name')} name='name' required />
            <TextField
              label={t('admin.fields.description')}
              name='description'
            />
          </div>
        </FormCard>
      )}
      <BranchesTable
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
    </PageChrome>
  )
}

function documentTypeOptions(t: ReturnType<typeof useLanguage>['t']) {
  return [
    { value: String(DOCUMENT_TYPE_OPENAPI), label: t('admin.types.openapi') },
    { value: String(DOCUMENT_TYPE_MARKDOWN), label: t('admin.types.markdown') },
  ]
}

function DocumentsTable({
  documents,
  onUpdate,
  onArchive,
  pending,
  readOnly = false,
}: {
  documents: DocumentDTO[]
  onUpdate: (document: DocumentDTO) => Promise<unknown>
  onArchive: (id: string) => Promise<unknown>
  pending: boolean
  readOnly?: boolean
}) {
  const { t } = useLanguage()
  return (
    <CollectionCard title={t('nav.documents')} count={documents.length}>
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
                <TableCell className='min-w-96'>
                  {readOnly || document.status !== ACTIVE_STATUS ? (
                    <div className='grid gap-1'>
                      <span className='font-medium'>{document.name}</span>
                      <span className='text-xs text-muted-foreground'>
                        {document.relative_path}
                      </span>
                    </div>
                  ) : (
                    <DocumentEditForm
                      document={document}
                      pending={pending}
                      onUpdate={onUpdate}
                    />
                  )}
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
  const [error, setError] = useState<Error>()
  const submitLockedRef = useRef(false)
  return (
    <form
      className='grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_auto]'
      onSubmit={async (event) => {
        event.preventDefault()
        if (submitLockedRef.current) return
        submitLockedRef.current = true
        const formData = new FormData(event.currentTarget)
        setError(undefined)
        try {
          await onUpdate({
            ...document,
            name: fieldValue(formData, 'name'),
            description: fieldValue(formData, 'description'),
            relative_path: fieldValue(formData, 'relative_path'),
          })
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause
              : new Error(t('toasts.somethingWrong'))
          )
        } finally {
          submitLockedRef.current = false
        }
      }}
    >
      <Input
        name='name'
        defaultValue={document.name}
        aria-label={t('admin.fields.name')}
        required
      />
      <Input
        name='relative_path'
        defaultValue={document.relative_path ?? ''}
        aria-label={t('admin.fields.relativePath')}
        required
      />
      <Input
        name='description'
        defaultValue={document.description ?? ''}
        aria-label={t('admin.fields.description')}
      />
      <Button type='submit' variant='outline' size='sm' disabled={pending}>
        {t('admin.common.save')}
      </Button>
      {error && (
        <Alert
          className='md:col-span-2 xl:col-span-4'
          variant='destructive'
          aria-live='polite'
        >
          <AlertCircle />
          <AlertTitle>{t('admin.common.error')}</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
    </form>
  )
}

function BranchesTable({
  branches,
  onUpdate,
  onArchive,
  pending,
  readOnly = false,
}: {
  branches: BranchDTO[]
  onUpdate: (branch: BranchDTO) => Promise<unknown>
  onArchive: (id: string) => Promise<unknown>
  pending: boolean
  readOnly?: boolean
}) {
  const { t } = useLanguage()
  return (
    <CollectionCard
      title={t('admin.sections.branches')}
      count={branches.length}
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
                <TableCell className='min-w-96'>
                  {readOnly || branch.status !== ACTIVE_STATUS ? (
                    <div className='grid gap-1'>
                      <span className='font-medium'>{branch.name}</span>
                      <span className='text-xs text-muted-foreground'>
                        {branch.description || t('admin.common.none')}
                      </span>
                    </div>
                  ) : (
                    <BranchEditForm
                      branch={branch}
                      pending={pending}
                      onUpdate={onUpdate}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge>
                    {resourceStatusLabel(branch.status, t)}
                  </StatusBadge>
                </TableCell>
                {!readOnly && (
                  <TableCell>
                    {branch.status === ACTIVE_STATUS && (
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
  const [error, setError] = useState<Error>()
  const submitLockedRef = useRef(false)
  return (
    <form
      className='grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_1.2fr_auto]'
      onSubmit={async (event) => {
        event.preventDefault()
        if (submitLockedRef.current) return
        submitLockedRef.current = true
        const formData = new FormData(event.currentTarget)
        setError(undefined)
        try {
          await onUpdate({
            ...branch,
            name: fieldValue(formData, 'name'),
            description: fieldValue(formData, 'description'),
            is_default:
              branch.is_default || formData.get('is_default') === 'on',
            is_protected: formData.get('is_protected') === 'on',
          })
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause
              : new Error(t('toasts.somethingWrong'))
          )
        } finally {
          submitLockedRef.current = false
        }
      }}
    >
      <Input
        name='name'
        defaultValue={branch.name}
        aria-label={t('admin.fields.name')}
        required
      />
      <Input
        name='description'
        defaultValue={branch.description ?? ''}
        aria-label={t('admin.fields.description')}
      />
      <div className='flex flex-wrap items-center gap-3 xl:col-span-2'>
        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            name='is_default'
            defaultChecked={branch.is_default}
            disabled={branch.is_default}
          />
          {t('admin.fields.defaultBranch')}
        </label>
        <label className='flex items-center gap-2 text-sm'>
          <input
            type='checkbox'
            name='is_protected'
            defaultChecked={branch.is_protected}
          />
          {t('admin.fields.protectedBranch')}
        </label>
        <Button type='submit' variant='outline' size='sm' disabled={pending}>
          {t('admin.common.save')}
        </Button>
      </div>
      {error && (
        <Alert
          className='md:col-span-2 xl:col-span-3'
          variant='destructive'
          aria-live='polite'
        >
          <AlertCircle />
          <AlertTitle>{t('admin.common.error')}</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
    </form>
  )
}
