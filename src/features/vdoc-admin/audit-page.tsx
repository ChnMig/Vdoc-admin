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
  SelectorGrid,
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
  const isSuperAdmin = Boolean(authUser?.is_super_admin)
  const { projectId, setProjectId, projectOptions } = useProjectsAndSelection()
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
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const filters = useDebouncedValue(
    JSON.stringify({ action, resourceType, from, to })
  )
  const queryFilters: {
    action: string
    resourceType: string
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
      <SelectorGrid>
        <NativeSelect
          label={t('admin.fields.project')}
          value={projectId}
          onChange={setProjectId}
          placeholder={
            isSuperAdmin
              ? t('admin.audit.allProjects')
              : t('admin.placeholders.selectProject')
          }
          options={projectOptions}
        />
        <TextField
          id='audit-action'
          label={t('admin.audit.action')}
          name='audit_action'
          placeholder={t('admin.audit.actionPlaceholder')}
          value={action}
          onChange={setAction}
        />
        <TextField
          id='audit-resource-type'
          label={t('admin.audit.resourceType')}
          name='audit_resource_type'
          placeholder={t('admin.audit.resourceTypePlaceholder')}
          value={resourceType}
          onChange={setResourceType}
        />
        <TextField
          id='audit-from'
          name='audit_from'
          type='datetime-local'
          label={t('admin.pagination.from')}
          value={from}
          onChange={setFrom}
        />
        <TextField
          id='audit-to'
          name='audit_to'
          type='datetime-local'
          label={t('admin.pagination.to')}
          value={to}
          onChange={setTo}
        />
      </SelectorGrid>
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
      <CollectionCard
        title={t('admin.audit.title')}
        description={t('admin.audit.description')}
        count={auditQuery.data?.total ?? 0}
      >
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
            <TableCell className='font-mono text-xs'>{log.action}</TableCell>
            <TableCell className='max-w-44 truncate font-mono text-xs'>
              {log.actor_user_id ?? log.actor_token_id ?? '-'}
            </TableCell>
            <TableCell className='max-w-56'>
              <div className='font-mono text-xs'>{log.resource_type}</div>
              <div className='truncate font-mono text-xs text-muted-foreground'>
                {log.resource_id ?? log.document_id ?? '-'}
              </div>
            </TableCell>
            <TableCell className='max-w-40 truncate font-mono text-xs'>
              {log.project_id ?? '-'}
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
