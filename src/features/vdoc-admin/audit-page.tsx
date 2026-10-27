import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import {
  listAuditLogs,
  listProjectMembers,
  type AuditLogDTO,
} from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
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
import { DateTimePickerField } from '@/components/date-time-picker'
import {
  AUDIT_ACTION_LABELS,
  AUDIT_RESOURCE_LABELS,
  auditActionLabel,
  auditResourceLabel,
} from './audit-enums'
import {
  PageChrome,
  NativeSelect,
  TextField,
  LoadingErrorState,
  CollectionCard,
  EmptyState,
  StatusBadge,
} from './page-shared'
import {
  useProjectsAndSelection,
  activeProjectRole,
  ROLE_ADMIN,
  formatDate,
} from './page-utils'
import { QueryPagination } from './query-pagination'

export function AuditPage() {
  const { t } = useLanguage()
  const authUser = useAuthStore((state) => state.auth.user)
  const sessionVersion = useAuthStore((state) => state.auth.sessionVersion)
  const isSuperAdmin = Boolean(authUser?.is_super_admin)
  const [allProjectsSelection, setAllProjectsSelection] = useState<{
    userId: string | undefined
    sessionVersion: number
  }>()
  const { projectId, setProjectId, projectOptions } = useProjectsAndSelection(
    undefined,
    undefined,
    {
      allowEmptySelection:
        isSuperAdmin &&
        allProjectsSelection?.userId === authUser?.id &&
        allProjectsSelection?.sessionVersion === sessionVersion,
    }
  )
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: ({ signal }) => listProjectMembers(projectId, { signal }),
    enabled: projectId.length > 0 && !isSuperAdmin,
  })
  const isProjectAdmin = Boolean(
    activeProjectRole(membersQuery.data?.items, authUser?.id) === ROLE_ADMIN
  )
  const [action, setAction] = useState('')
  const [resourceType, setResourceType] = useState('')
  const [actor, setActor] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const filters = useDebouncedValue(
    JSON.stringify({ action, resourceType, actor, from, to })
  )
  const queryFilters: {
    action: string
    resourceType: string
    actor: string
    from: string
    to: string
  } = JSON.parse(filters)
  const scope = JSON.stringify([projectId, filters, isSuperAdmin])
  const [navigation, setNavigation] = useState({ scope, cursors: [''] })
  const cursors = navigation.scope === scope ? navigation.cursors : ['']
  const cursor = cursors[cursors.length - 1]
  const auditQuery = useQuery({
    queryKey: ['audit-logs', projectId, queryFilters, isSuperAdmin, cursor],
    queryFn: ({ signal }) =>
      listAuditLogs(
        {
          project_id: projectId || undefined,
          action: queryFilters.action || undefined,
          actor: queryFilters.actor || undefined,
          resource_type: queryFilters.resourceType || undefined,
          from: queryFilters.from
            ? new Date(queryFilters.from).toISOString()
            : undefined,
          to: queryFilters.to
            ? new Date(queryFilters.to).toISOString()
            : undefined,
          cursor: cursor || undefined,
          limit: 50,
        },
        { signal }
      ),
    enabled: isSuperAdmin || (projectId.length > 0 && isProjectAdmin),
  })

  return (
    <PageChrome page='audit'>
      <CollectionCard
        title={t('admin.audit.title')}
        description={t('admin.audit.description')}
        count={auditQuery.data?.total ?? 0}
        actions={
          (action || resourceType || actor || from || to) && (
            <Button
              size='sm'
              variant='outline'
              onClick={() => {
                setAction('')
                setResourceType('')
                setActor('')
                setFrom('')
                setTo('')
              }}
            >
              {t('admin.common.resetFilters')}
            </Button>
          )
        }
      >
        <div className='@container/audit-filters grid min-w-0 gap-4 border-b pb-5'>
          <div className='grid min-w-0 gap-4 @xl/audit-filters:grid-cols-3'>
            <NativeSelect
              label={t('admin.fields.project')}
              value={projectId}
              onChange={(value) => {
                setAllProjectsSelection(
                  value === ''
                    ? { userId: authUser?.id, sessionVersion }
                    : undefined
                )
                setProjectId(value)
              }}
              placeholder={
                isSuperAdmin
                  ? t('admin.audit.allProjects')
                  : t('admin.placeholders.selectProject')
              }
              options={projectOptions}
            />
            <NativeSelect
              id='audit-action'
              label={t('admin.audit.action')}
              name='audit_action'
              placeholder={t('admin.audit.actionPlaceholder')}
              value={action}
              onChange={setAction}
              options={Object.keys(AUDIT_ACTION_LABELS).map((value) => ({
                value,
                label: auditActionLabel(value, t),
              }))}
            />
            <NativeSelect
              id='audit-resource-type'
              label={t('admin.audit.resourceType')}
              name='audit_resource_type'
              placeholder={t('admin.audit.resourceTypePlaceholder')}
              value={resourceType}
              onChange={setResourceType}
              options={Object.keys(AUDIT_RESOURCE_LABELS).map((value) => ({
                value,
                label: auditResourceLabel(value, t),
              }))}
            />
          </div>
          <div className='grid min-w-0 gap-4 @sm/audit-filters:grid-cols-2 @xl/audit-filters:grid-cols-3'>
            <TextField
              id='audit-actor'
              name='audit_actor'
              label={t('admin.audit.actor')}
              placeholder={t('admin.audit.actorPlaceholder')}
              value={actor}
              onChange={setActor}
            />
            <DateTimePickerField
              id='audit-from'
              name='audit_from'
              label={t('admin.pagination.from')}
              value={from}
              onChange={setFrom}
            />
            <DateTimePickerField
              id='audit-to'
              name='audit_to'
              label={t('admin.pagination.to')}
              value={to}
              onChange={setTo}
            />
          </div>
        </div>
        {!isSuperAdmin &&
        projectId &&
        !membersQuery.isLoading &&
        !isProjectAdmin ? (
          <Alert variant='destructive'>
            <ShieldCheck />
            <AlertTitle>{t('errors.forbiddenTitle')}</AlertTitle>
            <AlertDescription>
              {t('admin.audit.projectAdminRequired')}
            </AlertDescription>
          </Alert>
        ) : (
          <LoadingErrorState
            state={{
              isLoading: membersQuery.isLoading || auditQuery.isLoading,
              isError: membersQuery.isError || auditQuery.isError,
              error: (membersQuery.error ?? auditQuery.error) as Error | null,
            }}
          />
        )}
        {auditQuery.data?.items.length ? (
          <AuditLogTable logs={auditQuery.data.items} />
        ) : (
          <EmptyState preset='audit' />
        )}
        <QueryPagination
          offset={(cursors.length - 1) * 50}
          count={auditQuery.data?.items.length ?? 0}
          hasMore={Boolean(auditQuery.data?.nextCursor)}
          busy={auditQuery.isFetching}
          onPrevious={() =>
            setNavigation({ scope, cursors: cursors.slice(0, -1) })
          }
          onNext={() => {
            const next = auditQuery.data?.nextCursor
            if (next) setNavigation({ scope, cursors: [...cursors, next] })
          }}
        />
      </CollectionCard>
    </PageChrome>
  )
}

function AuditLogTable({ logs }: { logs: AuditLogDTO[] }) {
  const { t } = useLanguage()
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.audit.time')}</TableHead>
          <TableHead>{t('admin.audit.action')}</TableHead>
          <TableHead>{t('admin.audit.actor')}</TableHead>
          <TableHead>{t('admin.audit.resource')}</TableHead>
          <TableHead>{t('admin.fields.project')}</TableHead>
          <TableHead>{t('admin.audit.result')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id}>
            <TableCell className='text-xs whitespace-nowrap'>
              {formatDate(log.created_at)}
            </TableCell>
            <TableCell className='text-sm' title={log.action}>
              {auditActionLabel(log.action, t)}
            </TableCell>
            <TableCell
              className='max-w-64 text-sm break-words'
              title={log.actor_user_id ?? log.actor_token_id ?? undefined}
            >
              {log.actor_email ||
                t(
                  log.actor_type === 3
                    ? 'admin.audit.systemActor'
                    : log.actor_type === 4
                      ? 'admin.audit.anonymousActor'
                      : 'admin.audit.unknownActor'
                )}
              {log.actor_type === 2 && (
                <div className='text-xs text-muted-foreground'>
                  {t('admin.audit.mcpActor')}
                </div>
              )}
            </TableCell>
            <TableCell className='max-w-56'>
              <div className='text-sm' title={log.resource_type}>
                {auditResourceLabel(log.resource_type, t)}
              </div>
              <div
                className='truncate font-mono text-xs text-muted-foreground'
                title={log.resource_id ?? log.document_id ?? undefined}
              >
                {log.resource_id ?? log.document_id ?? '-'}
              </div>
            </TableCell>
            <TableCell
              className='max-w-52 text-sm break-words'
              title={log.project_id ?? undefined}
            >
              {log.project_name ||
                t(
                  log.project_id
                    ? 'admin.audit.unknownProject'
                    : 'admin.audit.systemProject'
                )}
            </TableCell>
            <TableCell>
              <StatusBadge muted={log.metadata.result !== 'success'}>
                {log.metadata.result === 'success'
                  ? t('admin.ai.providerTestSuccess')
                  : ['failed', 'failure'].includes(log.metadata.result)
                    ? t('admin.ai.providerTestError')
                    : (log.metadata.result ?? t('admin.common.unknown'))}
              </StatusBadge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
