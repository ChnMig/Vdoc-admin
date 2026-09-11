import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  Copy,
  KeyRound,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import {
  apiBaseUrl,
  createMCPToken,
  getMCPToken,
  listMCPUsage,
  listMCPTokens,
  revokeMCPToken,
  type AuditLogDTO,
  type MCPTokenDTO,
} from '@/lib/vdoc-api'
import { type VdocPageDeepLinkProps } from '@/lib/vdoc-route-search'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  PageChrome,
  LoadingErrorState,
  DeepLinkAlert,
  FormCard,
  TextField,
  TokenTable,
  CollectionCard,
  EmptyState,
  ContentViewer,
  StatusBadge,
} from './page-shared'
import {
  fieldValue,
  SCOPE_API_READ,
  SCOPE_DOC_READ,
  useInvalidateResources,
  tokenIsActive,
  formatDate,
  stringify,
  vdocMcpSource,
} from './page-utils'

function optionalFieldValue(formData: FormData, key: string) {
  const value = fieldValue(formData, key)
  return value.length > 0 ? value : undefined
}

function tokenHasAnyReadScope(token: MCPTokenDTO) {
  return (
    token.scopes.includes(SCOPE_API_READ) ||
    token.scopes.includes(SCOPE_DOC_READ)
  )
}

export function MCPTokensPage({
  search,
  onSearchChange,
}: VdocPageDeepLinkProps = {}) {
  const { t } = useLanguage()
  const invalidateResources = useInvalidateResources()
  const invalidate = () => invalidateResources({ kind: 'tokens' })
  const tokensQuery = useQuery({
    queryKey: ['mcp-tokens'],
    queryFn: ({ signal }) => listMCPTokens({ signal }),
  })
  const selectedTokenId = search?.token_id ?? ''
  const selectedTokenExists = Boolean(
    selectedTokenId &&
    tokensQuery.data?.items.some((token) => token.id === selectedTokenId)
  )
  const canLoadUsage = Boolean(
    tokensQuery.data && (!selectedTokenId || selectedTokenExists)
  )
  const usageQuery = useQuery({
    queryKey: ['mcp-usage', selectedTokenId || 'all-owned'],
    queryFn: ({ signal }) =>
      listMCPUsage(
        {
          token_id: selectedTokenId || undefined,
          limit: 200,
        },
        { signal }
      ),
    enabled: canLoadUsage,
  })
  const [tokenSelection, setTokenSelection] = useState<{
    routeTokenId: string
    token: MCPTokenDTO | null
    copyStatus?: 'success' | 'failure'
  }>(() => ({ routeTokenId: selectedTokenId, token: null }))
  if (tokenSelection.routeTokenId !== selectedTokenId) {
    setTokenSelection({
      routeTokenId: selectedTokenId,
      token:
        tokenSelection.token?.id === selectedTokenId
          ? tokenSelection.token
          : null,
      copyStatus: undefined,
    })
  }
  const listedSelectedToken = tokensQuery.data?.items.find(
    (item) => item.id === selectedTokenId
  )
  const interactionToken =
    tokenSelection.token &&
    (onSearchChange === undefined ||
      tokenSelection.token.id === selectedTokenId)
      ? tokenSelection.token
      : null
  const selectedToken = interactionToken ?? listedSelectedToken ?? null
  const visibleToken = interactionToken?.token ?? ''
  const copyStatus = tokenSelection.copyStatus
  const latestTokenOperationRequestId = useRef(0)
  const [activeTokenOperationRequestId, setActiveTokenOperationRequestId] =
    useState(0)
  const latestTokenCopyRequestId = useRef(0)
  const activeTokenSelectionRef = useRef(selectedTokenId)
  useEffect(() => {
    activeTokenSelectionRef.current = selectedTokenId
  }, [selectedTokenId])
  const invalidTokenDeepLink = Boolean(
    tokensQuery.data && selectedTokenId && !selectedTokenExists
  )
  const publishedReadEvidence = usageQuery.data?.items.find((usage) => {
    const token = tokensQuery.data?.items.find(
      (item) => item.id === usage.actor_token_id
    )
    return (
      token !== undefined &&
      tokenIsActive(token) &&
      tokenHasAnyReadScope(token) &&
      usage.metadata.evidence_kind === 'published_content_read' &&
      usage.metadata.result === 'success'
    )
  })
  const connectedToken = tokensQuery.data?.items.find(
    (token) => token.id === publishedReadEvidence?.actor_token_id
  )
  function beginTokenOperation() {
    const requestId = latestTokenOperationRequestId.current + 1
    latestTokenOperationRequestId.current = requestId
    setActiveTokenOperationRequestId(requestId)
    return requestId
  }
  function clearTokenInteraction() {
    setTokenSelection((current) => ({
      ...current,
      token: null,
      copyStatus: undefined,
    }))
  }
  const getMutation = useMutation({
    mutationFn: ({ tokenId }: { tokenId: string; requestId: number }) =>
      getMCPToken(tokenId),
    onSuccess: (token, variables) => {
      if (
        variables.requestId !== latestTokenOperationRequestId.current ||
        activeTokenSelectionRef.current !== variables.tokenId
      )
        return
      setTokenSelection((current) => ({
        ...current,
        token,
        copyStatus: undefined,
      }))
      latestTokenCopyRequestId.current += 1
    },
  })
  const revokeMutation = useMutation({
    mutationFn: ({ tokenId }: { tokenId: string; requestId: number }) =>
      revokeMCPToken(tokenId),
    onSuccess: (token, variables) => {
      if (
        variables.requestId === latestTokenOperationRequestId.current &&
        activeTokenSelectionRef.current === variables.tokenId
      ) {
        setTokenSelection((current) => ({
          ...current,
          token,
          copyStatus: undefined,
        }))
      }
      invalidate()
    },
  })
  const createMutation = useMutation({
    mutationFn: ({
      payload,
    }: {
      payload: Parameters<typeof createMCPToken>[0]
      requestId: number
    }) => createMCPToken(payload),
    onMutate: () => {
      latestTokenCopyRequestId.current += 1
      clearTokenInteraction()
      getMutation.reset()
      revokeMutation.reset()
    },
    onSuccess: (token, variables) => {
      if (variables.requestId === latestTokenOperationRequestId.current) {
        activeTokenSelectionRef.current = token.id
        setTokenSelection((current) => ({
          ...current,
          token,
          copyStatus: undefined,
        }))
        onSearchChange?.({ token_id: token.id })
      }
      invalidate()
    },
  })
  async function copyVisibleToken() {
    if (!visibleToken) return
    const requestId = latestTokenCopyRequestId.current + 1
    latestTokenCopyRequestId.current = requestId
    const tokenId = interactionToken?.id ?? ''
    setTokenSelection((current) => ({
      ...current,
      copyStatus: undefined,
    }))
    try {
      await navigator.clipboard.writeText(visibleToken)
      if (
        requestId === latestTokenCopyRequestId.current &&
        activeTokenSelectionRef.current === tokenId
      ) {
        setTokenSelection((current) => ({
          ...current,
          copyStatus: 'success',
        }))
      }
    } catch {
      if (
        requestId === latestTokenCopyRequestId.current &&
        activeTokenSelectionRef.current === tokenId
      ) {
        setTokenSelection((current) => ({
          ...current,
          copyStatus: 'failure',
        }))
      }
    }
  }
  return (
    <PageChrome page='mcpTokens'>
      <LoadingErrorState
        state={{
          isLoading: tokensQuery.isLoading || usageQuery.isLoading,
          isError: tokensQuery.isError || usageQuery.isError,
          error: (tokensQuery.error ?? usageQuery.error) as Error | null,
        }}
      />
      <DeepLinkAlert
        targets={
          invalidTokenDeepLink
            ? [`${t('admin.fields.token')}: ${selectedTokenId}`]
            : []
        }
      />
      <FormCard
        title={t('admin.sections.createToken')}
        submitLabel={t('admin.common.create')}
        pending={createMutation.isPending}
        onSubmit={(formData) => {
          const scopes = formData.getAll('scopes').map(Number)
          if (scopes.length === 0) {
            throw new Error(t('admin.token.scopeRequired'))
          }
          const expiry = optionalFieldValue(formData, 'expires_at')
          if (expiry) {
            const expiresAt = Date.parse(expiry)
            if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
              throw new Error(t('admin.token.futureExpiryRequired'))
            }
          }
          const requestId = beginTokenOperation()
          return createMutation.mutateAsync({
            requestId,
            payload: {
              name: fieldValue(formData, 'name'),
              scopes,
              expires_at: expiry ?? null,
            },
          })
        }}
      >
        <div className='grid gap-4 md:grid-cols-2'>
          <TextField label={t('admin.fields.name')} name='name' required />
          <TextField
            label={t('admin.fields.expiresAt')}
            name='expires_at'
            placeholder={t('admin.placeholders.optionalIsoDate')}
          />
        </div>
        <fieldset className='grid gap-3 rounded-md border p-4 sm:grid-cols-2'>
          <legend className='px-2 text-sm font-medium'>
            {t('admin.token.scopesTitle')}
          </legend>
          {[
            [1, t('admin.token.apiRead')],
            [2, t('admin.token.apiDraft')],
            [3, t('admin.token.docRead')],
            [4, t('admin.token.docDraft')],
          ].map(([scope, label]) => (
            <label
              key={String(scope)}
              className='flex items-start gap-3 rounded-md border bg-[var(--surface-control)] p-3 text-sm'
            >
              <input
                type='checkbox'
                name='scopes'
                value={String(scope)}
                defaultChecked={scope === 1}
                className='mt-0.5 size-4 accent-primary'
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>
      </FormCard>
      {visibleToken && (
        <Alert>
          <KeyRound />
          <AlertTitle>{t('admin.token.secretAvailable')}</AlertTitle>
          <AlertDescription className='grid gap-3'>
            <p>{t('admin.token.secretGuidance')}</p>
            <code className='mt-2 block rounded-md border bg-muted p-3 text-xs'>
              {visibleToken}
            </code>
            <Button
              type='button'
              variant='outline'
              className='w-fit'
              onClick={() => void copyVisibleToken()}
            >
              <Copy className='size-4' />
              {t('admin.token.copy')}
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
                    ? 'admin.token.copyFailed'
                    : 'admin.token.copySuccess'
                )}
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
      {getMutation.isError &&
        getMutation.variables.requestId === activeTokenOperationRequestId &&
        (onSearchChange === undefined ||
          getMutation.variables.tokenId === selectedTokenId) && (
          <Alert variant='destructive' aria-live='polite'>
            <AlertCircle />
            <AlertTitle>{t('admin.token.revealErrorTitle')}</AlertTitle>
            <AlertDescription>{getMutation.error.message}</AlertDescription>
          </Alert>
        )}
      {revokeMutation.isError &&
        revokeMutation.variables.requestId === activeTokenOperationRequestId &&
        (onSearchChange === undefined ||
          revokeMutation.variables.tokenId === selectedTokenId) && (
          <Alert variant='destructive' aria-live='polite'>
            <AlertCircle />
            <AlertTitle>{t('admin.token.revokeErrorTitle')}</AlertTitle>
            <AlertDescription>{revokeMutation.error.message}</AlertDescription>
          </Alert>
        )}
      <TokenTable
        tokens={tokensQuery.data?.items ?? []}
        selected={selectedTokenId}
        pending={revokeMutation.isPending}
        onView={(tokenId) => {
          activeTokenSelectionRef.current = tokenId
          onSearchChange?.({ token_id: tokenId })
          latestTokenCopyRequestId.current += 1
          clearTokenInteraction()
          revokeMutation.reset()
          getMutation.reset()
          const requestId = beginTokenOperation()
          getMutation.mutate({ tokenId, requestId })
        }}
        onRevoke={async (tokenId) => {
          activeTokenSelectionRef.current = tokenId
          onSearchChange?.({ token_id: tokenId })
          const requestId = beginTokenOperation()
          latestTokenCopyRequestId.current += 1
          clearTokenInteraction()
          getMutation.reset()
          revokeMutation.reset()
          await revokeMutation.mutateAsync({ tokenId, requestId })
        }}
      />
      <Alert>
        <ShieldCheck />
        <AlertTitle>
          {t(
            connectedToken
              ? 'admin.token.connectionVerifiedTitle'
              : 'admin.token.connectionPendingTitle'
          )}
        </AlertTitle>
        <AlertDescription className='grid gap-3'>
          <p>
            {connectedToken
              ? t('admin.token.connectionVerifiedDescription', {
                  name: connectedToken.name,
                  time: formatDate(publishedReadEvidence?.created_at),
                  tool:
                    publishedReadEvidence?.metadata.tool_name ??
                    t('admin.common.unknown'),
                  target: mcpUsageTarget(publishedReadEvidence),
                })
              : t('admin.token.connectionPendingDescription')}
          </p>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='w-fit'
            disabled={
              tokensQuery.isFetching || (canLoadUsage && usageQuery.isFetching)
            }
            onClick={() => {
              void tokensQuery.refetch()
              if (canLoadUsage) void usageQuery.refetch()
            }}
          >
            <RefreshCw />
            {t('admin.token.refreshConnectionEvidence')}
          </Button>
        </AlertDescription>
      </Alert>
      <CollectionCard
        title={t('admin.token.activityTitle')}
        description={t('admin.token.activityDescription')}
        count={usageQuery.data?.total ?? 0}
      >
        {usageQuery.data?.items.length ? (
          <MCPUsageTable logs={usageQuery.data.items} />
        ) : (
          <EmptyState />
        )}
      </CollectionCard>
      {selectedToken && (
        <ContentViewer
          title={t('admin.sections.tokenDetails')}
          content={stringify(tokenDetails(selectedToken))}
        />
      )}
      <CollectionCard
        title={t('admin.token.configTitle')}
        description={t('admin.token.configDescription')}
      >
        <pre className='overflow-x-auto rounded-md border bg-[var(--surface-control)] p-4 text-xs leading-relaxed'>
          {stringify({
            mcpServers: {
              vdoc: {
                command: 'npx',
                args: ['--yes', vdocMcpSource],
                env: {
                  VDOC_BASE_URL: apiBaseUrl,
                  VDOC_MCP_TOKEN: visibleToken || '<YOUR_ACTIVE_VDOC_TOKEN>',
                },
              },
            },
          })}
        </pre>
      </CollectionCard>
    </PageChrome>
  )
}

function tokenDetails(token: MCPTokenDTO) {
  return {
    id: token.id,
    user_id: token.user_id,
    name: token.name,
    token: token.token,
    scopes: token.scopes,
    status: token.status,
    created_at: token.created_at,
    updated_at: token.updated_at,
    expires_at: token.expires_at,
    revoked_at: token.revoked_at,
    revoked_by: token.revoked_by,
    last_used_at: token.last_used_at,
  }
}

function mcpUsageTarget(log?: AuditLogDTO) {
  if (!log) return '-'
  const fields = [
    'project_id',
    'document_id',
    'branch_id',
    'draft_id',
    'version_id',
    'endpoint_id',
    'from_version_id',
    'to_version_id',
    'diff_id',
  ] as const
  const values = fields.flatMap((key) => {
    const value =
      key === 'project_id'
        ? (log.project_id ?? log.metadata[key])
        : key === 'document_id'
          ? (log.document_id ?? log.metadata[key])
          : log.metadata[key]
    return value ? [`${key}=${value}`] : []
  })
  return values.join(' · ') || log.resource_id || '-'
}

function MCPUsageTable({ logs }: { logs: AuditLogDTO[] }) {
  const { t } = useLanguage()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.audit.time')}</TableHead>
          <TableHead>{t('admin.fields.token')}</TableHead>
          <TableHead>{t('admin.token.activityTool')}</TableHead>
          <TableHead>{t('admin.token.activityTarget')}</TableHead>
          <TableHead>{t('admin.token.activityAdapter')}</TableHead>
          <TableHead>{t('admin.token.activityEvidence')}</TableHead>
          <TableHead>{t('admin.audit.result')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell className='text-xs whitespace-nowrap'>
              {formatDate(log.created_at)}
            </TableCell>
            <TableCell className='max-w-40 truncate font-mono text-xs'>
              {log.actor_token_id ?? log.metadata.token_id ?? '-'}
            </TableCell>
            <TableCell className='font-mono text-xs'>
              {log.metadata.tool_name ?? '-'}
            </TableCell>
            <TableCell className='max-w-96 font-mono text-xs break-all'>
              {mcpUsageTarget(log)}
            </TableCell>
            <TableCell>
              <StatusBadge muted={log.metadata.adapter !== 'stdio'}>
                {log.metadata.adapter ?? 'direct'}
              </StatusBadge>
            </TableCell>
            <TableCell>
              <StatusBadge
                muted={log.metadata.evidence_kind !== 'published_content_read'}
              >
                {t(
                  log.metadata.evidence_kind === 'published_content_read'
                    ? 'admin.token.evidencePublishedRead'
                    : log.metadata.evidence_kind === 'capability_list'
                      ? 'admin.token.evidenceCapabilityList'
                      : 'admin.token.evidenceToolCall'
                )}
              </StatusBadge>
            </TableCell>
            <TableCell>
              <StatusBadge muted={log.metadata.result !== 'success'}>
                {log.metadata.result ?? t('admin.common.unknown')}
              </StatusBadge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
