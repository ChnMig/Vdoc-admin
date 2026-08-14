import { useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Eye, Link2, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react'
import {
  createDocumentShare,
  DOCUMENT_SHARE_EXPIRY_PRESETS,
  listDocumentShares,
  revealDocumentShare,
  revokeDocumentShare,
  type DocumentShareExpiryPreset,
} from '@/lib/document-share-api'
import { documentSharePasswordError } from '@/lib/document-share-password'
import {
  buildDocumentShareUrl,
  parseDocumentShareId,
  parseDocumentShareSecret,
} from '@/lib/document-share-url'
import { resolvePublicShareBaseUrl } from '@/lib/public-share-config'
import type { BranchDTO, VersionDTO } from '@/lib/vdoc-api'
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

export function DocumentSharePanel({
  projectId,
  documentId,
  branches,
  versions,
  canManage,
  interactive,
}: {
  readonly projectId: string
  readonly documentId: string
  readonly branches: readonly BranchDTO[]
  readonly versions: readonly VersionDTO[]
  readonly canManage: boolean
  readonly interactive: boolean
}) {
  const stateKey = `${projectId}:${documentId}:${interactive ? 'active' : 'readonly'}`

  return (
    <DocumentSharePanelContent
      key={stateKey}
      projectId={projectId}
      documentId={documentId}
      branches={branches}
      versions={versions}
      canManage={canManage}
      interactive={interactive}
    />
  )
}

function DocumentSharePanelContent({
  projectId,
  documentId,
  branches,
  versions,
  canManage,
  interactive,
}: {
  readonly projectId: string
  readonly documentId: string
  readonly branches: readonly BranchDTO[]
  readonly versions: readonly VersionDTO[]
  readonly canManage: boolean
  readonly interactive: boolean
}) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [activeLink, setActiveLink] = useState('')
  const [sharePassword, setSharePassword] = useState('')
  const [pendingRevokeShareId, setPendingRevokeShareId] = useState<string>()
  const [copyStatus, setCopyStatus] = useState<'success' | 'failure'>()
  const latestRevealRequestId = useRef(0)
  const latestCopyRequestId = useRef(0)
  const publishedBranchIds = new Set(
    versions
      .filter((version) => version.status === 1)
      .map((version) => version.branch_id)
  )
  const shareableBranches = branches.filter(
    (branch) => branch.status === 1 && publishedBranchIds.has(branch.id)
  )
  const passwordValidationError = documentSharePasswordError(sharePassword, {
    optional: true,
  })
  const sharesQuery = useQuery({
    queryKey: ['document-shares', projectId, documentId],
    queryFn: () => listDocumentShares(projectId, documentId),
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
      setPendingRevokeShareId(undefined)
      setActiveLink('')
      void invalidate(variables.targetProjectId, variables.targetDocumentId)
    },
    onError: (_error, variables) => {
      if (
        variables.targetProjectId === projectId &&
        variables.targetDocumentId === documentId
      ) {
        setPendingRevokeShareId(undefined)
      }
    },
  })

  const mutationFailed =
    createMutation.isError || revealMutation.isError || revokeMutation.isError

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
    <Card className='overflow-hidden'>
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
      <CardContent className='grid gap-5 p-5'>
        {interactive ? (
          <form
            className='grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] lg:items-end'
            onSubmit={(event) => {
              event.preventDefault()
              if (passwordValidationError !== undefined) return
              const form = new FormData(event.currentTarget)
              createMutation.mutate({
                targetProjectId: projectId,
                targetDocumentId: documentId,
                payload: {
                  branch_id: String(form.get('branch_id') ?? ''),
                  version_scope:
                    Number(form.get('version_scope')) === 2 ? 2 : 1,
                  expiry_preset: String(
                    form.get('expiry_preset') ?? '3_months'
                  ) as DocumentShareExpiryPreset,
                  password: sharePassword,
                },
              })
            }}
          >
            <ShareField label={t('publicShare.branch')} htmlFor='share-branch'>
              <select
                id='share-branch'
                name='branch_id'
                required
                className='h-10 rounded-md border border-input bg-background px-3 text-sm'
              >
                <option value=''>—</option>
                {shareableBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </ShareField>
            <ShareField label={t('publicShare.scope')} htmlFor='share-scope'>
              <select
                id='share-scope'
                name='version_scope'
                className='h-10 rounded-md border border-input bg-background px-3 text-sm'
              >
                <option value='1'>{t('publicShare.latest')}</option>
                <option value='2'>{t('publicShare.allVersions')}</option>
              </select>
            </ShareField>
            <ShareField label={t('publicShare.expiry')} htmlFor='share-expiry'>
              <select
                id='share-expiry'
                name='expiry_preset'
                className='h-10 rounded-md border border-input bg-background px-3 text-sm'
                defaultValue='3_months'
              >
                {DOCUMENT_SHARE_EXPIRY_PRESETS.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
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
            <Button
              disabled={
                createMutation.isPending ||
                shareableBranches.length === 0 ||
                passwordValidationError !== undefined
              }
              type='submit'
            >
              {t('publicShare.create')}
            </Button>
          </form>
        ) : (
          <Alert>
            <ShieldOff />
            <AlertTitle>{t('publicShare.readOnlyTitle')}</AlertTitle>
            <AlertDescription>
              {t('publicShare.readOnlyDescription')}
            </AlertDescription>
          </Alert>
        )}

        {mutationFailed && (
          <Alert variant='destructive'>
            <AlertTitle>{t('publicShare.managementError')}</AlertTitle>
          </Alert>
        )}

        {activeLink && (
          <Alert>
            <Link2 />
            <AlertTitle>{t('publicShare.linkReady')}</AlertTitle>
            <AlertDescription className='grid gap-3'>
              <code className='overflow-x-auto rounded-md border bg-muted p-3 text-xs'>
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

        {sharesQuery.data?.items.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('publicShare.scope')}</TableHead>
                <TableHead>{t('publicShare.password')}</TableHead>
                <TableHead>{t('publicShare.expiry')}</TableHead>
                <TableHead>{t('publicShare.reveal')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sharesQuery.data.items.map((share) => (
                <TableRow key={share.id}>
                  <TableCell>
                    <div className='flex flex-wrap items-center gap-2'>
                      <Badge variant='outline'>
                        {share.version_scope === 2
                          ? t('publicShare.allVersions')
                          : t('publicShare.latest')}
                      </Badge>
                      <Badge
                        variant={share.status === 1 ? 'secondary' : 'outline'}
                      >
                        {share.status === 1
                          ? t('publicShare.active')
                          : share.status === 3
                            ? t('publicShare.expired')
                            : t('publicShare.revoked')}
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
                      ? new Date(share.expires_at).toLocaleDateString()
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div className='flex flex-wrap gap-2'>
                      <Button
                        size='sm'
                        variant='outline'
                        disabled={
                          !interactive ||
                          share.status !== 1 ||
                          revealMutation.isPending
                        }
                        onClick={() => {
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
                        disabled={share.status !== 1}
                        onClick={() => setPendingRevokeShareId(share.id)}
                      >
                        <Trash2 className='size-4' />
                        {t('publicShare.revoke')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className='rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground'>
            {t('publicShare.noShares')}
          </p>
        )}

        <ConfirmDialog
          open={pendingRevokeShareId !== undefined}
          onOpenChange={(open) => {
            if (!open && !revokeMutation.isPending) {
              setPendingRevokeShareId(undefined)
            }
          }}
          title={t('publicShare.revokeConfirmTitle')}
          desc={t('publicShare.revokeConfirmDescription')}
          confirmText={t('publicShare.revoke')}
          destructive
          isLoading={revokeMutation.isPending}
          handleConfirm={() => {
            if (!pendingRevokeShareId) return
            latestRevealRequestId.current += 1
            revokeMutation.mutate({
              targetProjectId: projectId,
              targetDocumentId: documentId,
              shareId: pendingRevokeShareId,
            })
          }}
        />
      </CardContent>
    </Card>
  )
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
    <div className='grid gap-2'>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}
