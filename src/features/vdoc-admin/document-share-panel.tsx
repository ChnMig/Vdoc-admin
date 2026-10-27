import { useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Copy,
  Eye,
  Link2,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from 'lucide-react'
import {
  createDocumentShare,
  DOCUMENT_SHARE_EXPIRY_PRESETS,
  listDocumentShares,
  revealDocumentShare,
  revokeDocumentShare,
  type DocumentShareExpiryPreset,
  type CreateDocumentSharePayload,
} from '@/lib/document-share-api'
import { documentSharePasswordError } from '@/lib/document-share-password'
import {
  buildDocumentShareUrl,
  parseDocumentShareId,
  parseDocumentShareSecret,
} from '@/lib/document-share-url'
import { resolvePublicShareBaseUrl } from '@/lib/public-share-config'
import type { BranchDTO } from '@/lib/vdoc-api'
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
import { ConfirmDialog } from '@/components/confirm-dialog'
import { OptionsSelect } from '@/components/options-select'

export function DocumentSharePanel({
  projectId,
  documentId,
  documentName,
  branches,
  publishedBranchIds,
  canManage,
  interactive,
  selectedBranchId,
  selectedVersionId,
  selectedVersionName,
  embedded = false,
}: {
  readonly projectId: string
  readonly documentId: string
  readonly documentName: string
  readonly branches: readonly BranchDTO[]
  readonly publishedBranchIds: readonly string[]
  readonly canManage: boolean
  readonly interactive: boolean
  readonly selectedBranchId?: string
  readonly selectedVersionId?: string | null
  readonly selectedVersionName?: string
  readonly embedded?: boolean
}) {
  const selectionKey =
    selectedVersionId === undefined
      ? 'uncontrolled'
      : selectedVersionId === null
        ? 'draft'
        : `${selectedBranchId}:${selectedVersionId}`
  const stateKey = `${projectId}:${documentId}:${canManage ? 'manager' : 'viewer'}:${interactive ? 'active' : 'readonly'}:${selectionKey}`

  return (
    <DocumentSharePanelContent
      key={stateKey}
      projectId={projectId}
      documentId={documentId}
      documentName={documentName}
      branches={branches}
      publishedBranchIds={publishedBranchIds}
      canManage={canManage}
      interactive={interactive}
      selectedBranchId={selectedBranchId}
      selectedVersionId={selectedVersionId}
      selectedVersionName={selectedVersionName}
      embedded={embedded}
    />
  )
}

function DocumentSharePanelContent({
  projectId,
  documentId,
  documentName,
  branches,
  publishedBranchIds,
  canManage,
  interactive,
  selectedBranchId,
  selectedVersionId,
  selectedVersionName,
  embedded,
}: {
  readonly projectId: string
  readonly documentId: string
  readonly documentName: string
  readonly branches: readonly BranchDTO[]
  readonly publishedBranchIds: readonly string[]
  readonly canManage: boolean
  readonly interactive: boolean
  readonly selectedBranchId?: string
  readonly selectedVersionId?: string | null
  readonly selectedVersionName?: string
  readonly embedded: boolean
}) {
  const { t, language } = useLanguage()
  const queryClient = useQueryClient()
  const [activeLink, setActiveLink] = useState('')
  const [sharePassword, setSharePassword] = useState('')
  const [pendingRevokeShare, setPendingRevokeShare] = useState<{
    readonly targetProjectId: string
    readonly targetDocumentId: string
    readonly shareId: string
    readonly branchName: string
  }>()
  const [copyStatus, setCopyStatus] = useState<'success' | 'failure'>()
  const createLockedRef = useRef(false)
  const revealLockedRef = useRef(false)
  const revokeLockedRef = useRef(false)
  const latestRevealRequestId = useRef(0)
  const latestCopyRequestId = useRef(0)
  const shareableBranches = branches.filter(
    (branch) => branch.status === 1 && publishedBranchIds.includes(branch.id)
  )
  const controlledSelection = selectedVersionId !== undefined
  const selectedBranch = shareableBranches.find(
    (branch) => branch.id === selectedBranchId
  )
  const selectionCanShare =
    !controlledSelection || Boolean(selectedVersionId && selectedBranch)
  const expiryLabelKeys = {
    '1_month': 'publicShare.expiryPresets.oneMonth',
    '3_months': 'publicShare.expiryPresets.threeMonths',
    '6_months': 'publicShare.expiryPresets.sixMonths',
    '1_year': 'publicShare.expiryPresets.oneYear',
    permanent: 'publicShare.expiryPresets.permanent',
  } as const
  const passwordValidationError = documentSharePasswordError(sharePassword, {
    optional: true,
  })
  const sharesQuery = useQuery({
    queryKey: ['document-shares', projectId, documentId],
    queryFn: ({ signal }) =>
      listDocumentShares(projectId, documentId, { signal }),
    enabled: canManage && projectId.length > 0 && documentId.length > 0,
  })
  const invalidate = (
    targetProjectId = projectId,
    targetDocumentId = documentId
  ) =>
    queryClient.invalidateQueries({
      queryKey: ['document-shares', targetProjectId, targetDocumentId],
    })
  const createMutation = useMutation({
    mutationFn: ({
      targetProjectId,
      targetDocumentId,
      payload,
    }: {
      targetProjectId: string
      targetDocumentId: string
      payload: Parameters<typeof createDocumentShare>[2]
    }) => createDocumentShare(targetProjectId, targetDocumentId, payload),
    onSuccess: (result, variables) => {
      if (
        !interactive ||
        variables.targetProjectId !== projectId ||
        variables.targetDocumentId !== documentId
      ) {
        return
      }
      latestRevealRequestId.current += 1
      latestCopyRequestId.current += 1
      setCopyStatus(undefined)
      setActiveLink(
        buildDocumentShareUrl({
          baseUrl: resolvePublicShareBaseUrl(),
          shareId: parseDocumentShareId(result.share.id),
          secret: parseDocumentShareSecret(result.secret),
        })
      )
      setSharePassword('')
      void invalidate(variables.targetProjectId, variables.targetDocumentId)
    },
    onSettled: () => {
      createLockedRef.current = false
    },
  })
  const revealMutation = useMutation({
    mutationFn: ({
      targetProjectId,
      targetDocumentId,
      shareId,
    }: {
      targetProjectId: string
      targetDocumentId: string
      shareId: string
      requestId: number
    }) => revealDocumentShare(targetProjectId, targetDocumentId, shareId),
    onSuccess: (result, variables) => {
      if (
        !interactive ||
        variables.requestId !== latestRevealRequestId.current ||
        variables.targetProjectId !== projectId ||
        variables.targetDocumentId !== documentId
      ) {
        return
      }
      latestCopyRequestId.current += 1
      setCopyStatus(undefined)
      setActiveLink(
        buildDocumentShareUrl({
          baseUrl: resolvePublicShareBaseUrl(),
          shareId: parseDocumentShareId(result.share.id),
          secret: parseDocumentShareSecret(result.secret),
        })
      )
    },
    onSettled: () => {
      revealLockedRef.current = false
    },
  })
  const revokeMutation = useMutation({
    mutationFn: ({
      targetProjectId,
      targetDocumentId,
      shareId,
    }: {
      targetProjectId: string
      targetDocumentId: string
      shareId: string
    }) => revokeDocumentShare(targetProjectId, targetDocumentId, shareId),
    onSuccess: (_result, variables) => {
      if (
        variables.targetProjectId !== projectId ||
        variables.targetDocumentId !== documentId
      ) {
        return
      }
      latestRevealRequestId.current += 1
      latestCopyRequestId.current += 1
      setCopyStatus(undefined)
      setPendingRevokeShare(undefined)
      setActiveLink('')
      void invalidate(variables.targetProjectId, variables.targetDocumentId)
    },
    onSettled: () => {
      revokeLockedRef.current = false
    },
  })

  const mutationError = createMutation.error ?? revealMutation.error
  const ShareContainer = embedded ? 'div' : Card

  async function copyActiveLink() {
    if (!activeLink) return
    const requestId = latestCopyRequestId.current + 1
    latestCopyRequestId.current = requestId
    setCopyStatus(undefined)
    try {
      await navigator.clipboard.writeText(activeLink)
      if (requestId === latestCopyRequestId.current) setCopyStatus('success')
    } catch {
      if (requestId === latestCopyRequestId.current) setCopyStatus('failure')
    }
  }

  if (!canManage || !documentId) return null

  return (
    <ShareContainer className='@container/share min-w-0 overflow-hidden'>
      {!embedded && (
        <CardHeader className='border-b'>
          <div className='flex items-start gap-3'>
            <span className='flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary'>
              <Link2 className='size-4' />
            </span>
            <div className='grid gap-1'>
              <CardTitle>{t('publicShare.managementTitle')}</CardTitle>
              <CardDescription>
                {t('publicShare.managementDescription')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent
        className={
          embedded
            ? 'grid min-w-0 gap-5 p-0'
            : 'grid min-w-0 gap-5 p-4 @min-[32rem]/share:p-5'
        }
      >
        {interactive && selectionCanShare ? (
          <form
            className='grid min-w-0 gap-4'
            onSubmit={(event) => {
              event.preventDefault()
              if (
                createLockedRef.current ||
                !interactive ||
                !selectionCanShare ||
                passwordValidationError !== undefined
              )
                return
              const form = new FormData(event.currentTarget)
              const branchId = controlledSelection
                ? selectedBranchId
                : String(form.get('branch_id') ?? '')
              if (
                !branchId ||
                !shareableBranches.some((branch) => branch.id === branchId)
              )
                return
              const payload: CreateDocumentSharePayload = {
                branch_id: branchId,
                expiry_preset: String(
                  form.get('expiry_preset') ?? '3_months'
                ) as DocumentShareExpiryPreset,
                password: sharePassword,
                ...(controlledSelection && selectedVersionId
                  ? { version_scope: 3, version_id: selectedVersionId }
                  : {
                      version_scope:
                        Number(form.get('version_scope')) === 2 ? 2 : 1,
                    }),
              }
              createLockedRef.current = true
              createMutation.mutate({
                targetProjectId: projectId,
                targetDocumentId: documentId,
                payload,
              })
            }}
          >
            {controlledSelection && (
              <div className='grid min-w-0 gap-3 border-b pb-4'>
                <h3 className='text-sm font-medium'>
                  {t('publicShare.contextTitle')}
                </h3>
                <dl className='grid min-w-0 gap-3 @min-[32rem]/share:grid-cols-2'>
                  <div className='grid min-w-0 gap-1'>
                    <dt className='text-xs text-muted-foreground'>
                      {t('publicShare.branch')}
                    </dt>
                    <dd className='text-sm font-medium [overflow-wrap:anywhere]'>
                      {selectedBranch?.name}
                    </dd>
                  </div>
                  <div className='grid min-w-0 gap-1'>
                    <dt className='text-xs text-muted-foreground'>
                      {t('publicShare.version')}
                    </dt>
                    <dd className='text-sm font-medium [overflow-wrap:anywhere]'>
                      {selectedVersionName ||
                        compactIdentifier(selectedVersionId ?? '')}
                    </dd>
                  </div>
                </dl>
                <p className='text-xs text-muted-foreground'>
                  {t('publicShare.fixedVersion')}
                </p>
              </div>
            )}
            <div
              data-share-fields
              className={`grid min-w-0 items-start gap-4 @min-[32rem]/share:grid-cols-2 ${controlledSelection ? '' : '@min-[64rem]/share:grid-cols-4'}`}
            >
              {!controlledSelection && (
                <>
                  <ShareField
                    label={t('publicShare.branch')}
                    htmlFor='share-branch'
                  >
                    <OptionsSelect
                      id='share-branch'
                      name='branch_id'
                      required
                      options={[
                        { value: '', label: '—' },
                        ...shareableBranches.map((branch) => ({
                          value: branch.id,
                          label: branch.name,
                        })),
                      ]}
                    />
                  </ShareField>
                  <ShareField
                    label={t('publicShare.scope')}
                    htmlFor='share-scope'
                  >
                    <OptionsSelect
                      id='share-scope'
                      name='version_scope'
                      options={[
                        { value: '1', label: t('publicShare.latest') },
                        { value: '2', label: t('publicShare.allVersions') },
                      ]}
                    />
                  </ShareField>
                </>
              )}
              <ShareField
                label={t('publicShare.expiry')}
                htmlFor='share-expiry'
              >
                <OptionsSelect
                  id='share-expiry'
                  name='expiry_preset'
                  defaultValue='3_months'
                  options={DOCUMENT_SHARE_EXPIRY_PRESETS.map((preset) => ({
                    value: preset,
                    label: t(expiryLabelKeys[preset]),
                  }))}
                />
              </ShareField>
              <ShareField
                label={t('publicShare.passwordOptional')}
                htmlFor='share-password-admin'
              >
                <Input
                  id='share-password-admin'
                  name='password'
                  type='password'
                  autoComplete='new-password'
                  value={sharePassword}
                  aria-invalid={
                    sharePassword.length > 0 &&
                    passwordValidationError !== undefined
                  }
                  aria-describedby='share-password-admin-hint'
                  onChange={(event) =>
                    setSharePassword(event.currentTarget.value)
                  }
                />
                <p
                  id='share-password-admin-hint'
                  className={
                    sharePassword.length > 0 &&
                    passwordValidationError !== undefined
                      ? 'text-xs text-destructive'
                      : 'text-xs text-muted-foreground'
                  }
                >
                  {sharePassword.length > 0 &&
                  passwordValidationError !== undefined
                    ? t('publicShare.passwordInvalid')
                    : t('publicShare.passwordHint')}
                </p>
              </ShareField>
            </div>
            <div className='flex min-w-0 flex-wrap items-center gap-3 border-t pt-4'>
              <Button
                disabled={
                  createMutation.isPending ||
                  !selectionCanShare ||
                  shareableBranches.length === 0 ||
                  passwordValidationError !== undefined
                }
                type='submit'
              >
                {t('publicShare.create')}
              </Button>
            </div>
          </form>
        ) : !interactive ? (
          <Alert>
            <ShieldOff />
            <AlertTitle>{t('publicShare.readOnlyTitle')}</AlertTitle>
            <AlertDescription>
              {t('publicShare.readOnlyDescription')}
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <ShieldOff />
            <AlertTitle>
              {t(
                selectedVersionId === null
                  ? 'publicShare.draftUnavailableTitle'
                  : 'publicShare.contextUnavailableTitle'
              )}
            </AlertTitle>
            <AlertDescription>
              {selectedVersionId === null
                ? t('publicShare.draftUnavailableDescription')
                : t('publicShare.contextUnavailable')}
            </AlertDescription>
          </Alert>
        )}

        {mutationError && (
          <Alert variant='destructive' aria-live='polite'>
            <AlertCircle />
            <AlertTitle>{t('admin.common.error')}</AlertTitle>
            <AlertDescription className='grid gap-1'>
              <p>{mutationError.message}</p>
              <p>{t('publicShare.managementError')}</p>
            </AlertDescription>
          </Alert>
        )}

        {activeLink && (
          <Alert>
            <Link2 />
            <AlertTitle>{t('publicShare.linkReady')}</AlertTitle>
            <AlertDescription className='min-w-0 gap-3'>
              <code className='block w-full min-w-0 rounded-md border bg-muted p-3 text-xs break-all whitespace-pre-wrap'>
                {activeLink}
              </code>
              <Button
                type='button'
                variant='outline'
                className='w-fit'
                onClick={() => void copyActiveLink()}
              >
                <Copy className='size-4' />
                {t('publicShare.copy')}
              </Button>
              {copyStatus && (
                <p
                  role='status'
                  className={
                    copyStatus === 'failure'
                      ? 'text-sm text-destructive'
                      : 'text-sm text-muted-foreground'
                  }
                >
                  {t(
                    copyStatus === 'failure'
                      ? 'publicShare.copyFailed'
                      : 'publicShare.copySuccess'
                  )}
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {sharesQuery.isLoading && (
          <p role='status' className='text-sm text-muted-foreground'>
            {t('publicShare.listLoading')}
          </p>
        )}
        {sharesQuery.isError && (
          <Alert variant='destructive' aria-live='polite'>
            <AlertCircle />
            <AlertTitle>{t('publicShare.listError')}</AlertTitle>
            <AlertDescription>
              <Button
                type='button'
                variant='outline'
                size='sm'
                disabled={sharesQuery.isFetching}
                onClick={() => void sharesQuery.refetch()}
              >
                {t('publicShare.retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {sharesQuery.data?.items.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('publicShare.object')}</TableHead>
                <TableHead>{t('publicShare.scope')}</TableHead>
                <TableHead>{t('publicShare.password')}</TableHead>
                <TableHead>{t('publicShare.expiry')}</TableHead>
                <TableHead>{t('publicShare.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sharesQuery.data.items.map((share) => {
                const branch = branches.find(
                  (candidate) => candidate.id === share.branch_id
                )
                const branchName = branch
                  ? branch.status === 1
                    ? branch.name
                    : `${branch.name} — ${t('admin.statuses.archived')}`
                  : t('publicShare.unknownBranch')
                return (
                  <TableRow key={share.id}>
                    <TableCell>
                      <div className='grid min-w-44 gap-1'>
                        <span className='font-medium'>
                          {documentName || compactIdentifier(documentId)}
                        </span>
                        <span className='text-sm text-muted-foreground'>
                          {t('publicShare.branchLabel', { branch: branchName })}
                        </span>
                        {share.version_scope === 3 && share.version_id && (
                          <span
                            className='text-sm text-muted-foreground'
                            title={share.version_id}
                          >
                            {t('publicShare.contextVersion', {
                              version:
                                share.version_id === selectedVersionId &&
                                selectedVersionName
                                  ? selectedVersionName
                                  : compactIdentifier(share.version_id),
                            })}
                          </span>
                        )}
                        <code
                          className='text-xs text-muted-foreground'
                          title={share.id}
                        >
                          {compactIdentifier(share.id)}
                        </code>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='flex flex-wrap items-center justify-center gap-2'>
                        <Badge variant='outline'>
                          {share.version_scope === 3
                            ? t('publicShare.fixedVersion')
                            : share.version_scope === 2
                              ? t('publicShare.allVersions')
                              : t('publicShare.latest')}
                        </Badge>
                        <Badge
                          variant={share.status === 1 ? 'secondary' : 'outline'}
                        >
                          {documentShareStatusLabel(share.status, t)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className='inline-flex items-center gap-2 text-sm'>
                        {share.password_protected ? (
                          <ShieldCheck className='size-4 text-primary' />
                        ) : (
                          <ShieldOff className='size-4 text-muted-foreground' />
                        )}
                        {share.password_protected
                          ? t('publicShare.protected')
                          : t('publicShare.unprotected')}
                      </span>
                    </TableCell>
                    <TableCell>
                      {share.expires_at
                        ? new Date(share.expires_at).toLocaleDateString(
                            language
                          )
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <div className='flex flex-wrap justify-center gap-2'>
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={
                            !interactive ||
                            share.status !== 1 ||
                            revealMutation.isPending
                          }
                          onClick={() => {
                            if (revealLockedRef.current) return
                            revealLockedRef.current = true
                            const requestId = latestRevealRequestId.current + 1
                            latestRevealRequestId.current = requestId
                            revealMutation.mutate({
                              targetProjectId: projectId,
                              targetDocumentId: documentId,
                              shareId: share.id,
                              requestId,
                            })
                          }}
                        >
                          <Eye className='size-4' />
                          {t('publicShare.reveal')}
                        </Button>
                        <Button
                          size='sm'
                          variant='outline'
                          disabled={
                            share.status !== 1 || revokeMutation.isPending
                          }
                          onClick={() => {
                            revokeMutation.reset()
                            setPendingRevokeShare({
                              targetProjectId: projectId,
                              targetDocumentId: documentId,
                              shareId: share.id,
                              branchName,
                            })
                          }}
                        >
                          <Trash2 className='size-4' />
                          {t('publicShare.revoke')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : sharesQuery.isSuccess ? (
          <p className='rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground'>
            {t('publicShare.noShares')}
          </p>
        ) : null}

        <ConfirmDialog
          open={pendingRevokeShare !== undefined}
          onOpenChange={(open) => {
            if (!open && !revokeMutation.isPending) {
              setPendingRevokeShare(undefined)
              revokeMutation.reset()
            }
          }}
          title={t('publicShare.revokeConfirmTitle', {
            document: documentName || compactIdentifier(documentId),
            branch: pendingRevokeShare?.branchName ?? '',
          })}
          desc={t('publicShare.revokeConfirmDescription', {
            id: compactIdentifier(pendingRevokeShare?.shareId ?? ''),
          })}
          confirmText={t('publicShare.revoke')}
          destructive
          isLoading={revokeMutation.isPending}
          handleConfirm={() => {
            if (!pendingRevokeShare || revokeLockedRef.current) return
            revokeLockedRef.current = true
            latestRevealRequestId.current += 1
            revokeMutation.mutate(pendingRevokeShare)
          }}
        >
          {revokeMutation.isError && (
            <Alert variant='destructive' aria-live='polite'>
              <AlertCircle />
              <AlertTitle>{t('admin.common.error')}</AlertTitle>
              <AlertDescription className='grid gap-1'>
                <p>{revokeMutation.error.message}</p>
                <p>{t('publicShare.managementError')}</p>
              </AlertDescription>
            </Alert>
          )}
        </ConfirmDialog>
      </CardContent>
    </ShareContainer>
  )
}

function documentShareStatusLabel(
  status: number,
  t: ReturnType<typeof useLanguage>['t']
) {
  if (status === 1) return t('publicShare.active')
  if (status === 2) return t('publicShare.revoked')
  if (status === 3) return t('publicShare.expired')
  return `${t('admin.common.unknown')} ${status}`
}

function compactIdentifier(value: string) {
  if (value.length <= 16) return value
  return `${value.slice(0, 8)}…${value.slice(-4)}`
}

function ShareField({
  label,
  htmlFor,
  children,
}: {
  readonly label: string
  readonly htmlFor: string
  readonly children: ReactNode
}) {
  return (
    <div className='grid min-w-0 content-start gap-2'>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
