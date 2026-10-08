import { useLayoutEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import {
  addProjectMember,
  archiveProject,
  createProject,
  listProjectMembers,
  listProjectMemberCandidates,
  listTeams,
  listUsers,
  patchProjectMemberRole,
  removeProjectMember,
  updateProject,
  type UserDTO,
} from '@/lib/vdoc-api'
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
  FormCard,
  NativeSelect,
  TextField,
  NameDescriptionTable,
  CollectionCard,
  ConfirmActionButton,
  StatusBadge,
  EmptyState,
} from './page-shared'
import {
  useInvalidateResources,
  useProjectsAndSelection,
  activeProjectRole,
  ACTIVE_STATUS,
  ROLE_ADMIN,
  fieldValue,
  numberValue,
  ROLE_READER,
  ROLE_WRITER,
  accountStatusLabel,
} from './page-utils'

export function ProjectsPage() {
  const { t } = useLanguage()
  const authUser = useAuthStore((state) => state.auth.user)
  const isSuperAdmin = Boolean(authUser?.is_super_admin)
  const sessionVersion = useAuthStore((state) => state.auth.sessionVersion)
  const invalidate = useInvalidateResources()
  const { projectsQuery, projectId, setProjectId, projectOptions } =
    useProjectsAndSelection()
  const memberScope = `${sessionVersion}:${projectId}`
  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: ({ signal }) => listTeams({ signal }),
    enabled: isSuperAdmin,
  })
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: ({ signal }) => listUsers({ signal }),
    enabled: isSuperAdmin,
  })
  const selectedProject = projectsQuery.data?.items.find(
    (project) => project.id === projectId
  )
  const membersQuery = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: ({ signal }) => listProjectMembers(projectId, { signal }),
    enabled: projectId.length > 0,
  })
  const selectedRole = activeProjectRole(membersQuery.data?.items, authUser?.id)
  const canManageSelectedProject = Boolean(
    selectedProject?.status === ACTIVE_STATUS &&
    (isSuperAdmin || selectedRole === ROLE_ADMIN)
  )
  const memberCandidatesQuery = useQuery({
    queryKey: ['project-member-candidates', projectId],
    queryFn: ({ signal }) => listProjectMemberCandidates(projectId, { signal }),
    enabled: projectId.length > 0 && canManageSelectedProject,
  })
  const memberCandidatesLoading = isSuperAdmin
    ? usersQuery.isLoading || membersQuery.isLoading
    : memberCandidatesQuery.isLoading
  const memberCandidatesIsError = isSuperAdmin
    ? usersQuery.isError || membersQuery.isError
    : memberCandidatesQuery.isError
  const memberCandidatesError = isSuperAdmin
    ? (usersQuery.error ?? membersQuery.error)
    : memberCandidatesQuery.error
  const createMutation = useMutation({
    mutationFn: createProject,
    onMutate: () => ({ projectId }),
    onSuccess: (result) =>
      invalidate({ kind: 'project', projectId: result.id }),
  })
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      name,
      description,
    }: {
      id: string
      name: string
      description: string
    }) => updateProject(id, { name, description }),
    onMutate: () => ({ projectId }),
    onSuccess: (result) =>
      invalidate({ kind: 'project', projectId: result.id }),
  })
  const archiveMutation = useMutation({
    mutationFn: archiveProject,
    onMutate: () => ({ projectId }),
    onSuccess: (result) =>
      invalidate({ kind: 'project', projectId: result.id }),
  })
  const addMemberMutation = useMutation({
    mutationFn: async (request: MemberChange & { role: number }) => {
      if (!ownsSession(request.sessionVersion)) return
      try {
        const member = await addProjectMember(request.projectId, {
          user_id: request.userId,
          role: request.role,
        })
        if (ownsSession(request.sessionVersion)) return member
      } catch (error) {
        if (ownsSession(request.sessionVersion)) throw error
      }
    },
    onSuccess: (_result, request) => {
      if (ownsSession(request.sessionVersion))
        return invalidate({ kind: 'project', projectId: request.projectId })
    },
  })
  const roleMutation = useMutation({
    mutationFn: async (request: MemberChange & { role: number }) => {
      if (!ownsSession(request.sessionVersion)) return
      try {
        const member = await patchProjectMemberRole(
          request.projectId,
          request.userId,
          { role: request.role }
        )
        if (ownsSession(request.sessionVersion)) return member
      } catch (error) {
        if (ownsSession(request.sessionVersion)) throw error
      }
    },
    onSuccess: (_result, request) => {
      if (ownsSession(request.sessionVersion))
        return invalidate({ kind: 'project', projectId: request.projectId })
    },
  })
  const removeMutation = useMutation({
    mutationFn: async (request: MemberChange) => {
      if (!ownsSession(request.sessionVersion)) return
      try {
        const member = await removeProjectMember(
          request.projectId,
          request.userId
        )
        if (ownsSession(request.sessionVersion)) return member
      } catch (error) {
        if (ownsSession(request.sessionVersion)) throw error
      }
    },
    onSuccess: (_result, request) => {
      if (ownsSession(request.sessionVersion))
        return invalidate({ kind: 'project', projectId: request.projectId })
    },
  })
  const teamOptions =
    teamsQuery.data?.items.map((team) => ({
      value: team.id,
      label: team.name,
    })) ?? []
  const projectAdminOptions =
    usersQuery.data?.items
      .filter((user) => user.status === ACTIVE_STATUS && !user.is_super_admin)
      .map((user) => ({
        value: user.id,
        label: user.name ? `${user.name} · ${user.email}` : user.email,
      })) ?? []
  const memberCandidateOptions = memberCandidatesLoading
    ? []
    : ((isSuperAdmin
        ? usersQuery.data?.items.filter(
            (user) =>
              user.status === ACTIVE_STATUS &&
              !user.is_super_admin &&
              !membersQuery.data?.items.some(
                (member) =>
                  member.user_id === user.id && member.status === ACTIVE_STATUS
              )
          )
        : memberCandidatesQuery.data?.items
      )?.map((user) => ({
        value: user.id,
        label: user.name ? `${user.name} · ${user.email}` : user.email,
      })) ?? [])
  return (
    <PageChrome page='projects'>
      <LoadingErrorState
        state={{
          isLoading: projectsQuery.isLoading,
          isError: projectsQuery.isError,
          error: projectsQuery.error,
        }}
      />
      {isSuperAdmin && (
        <FormCard
          title={t('admin.sections.createProject')}
          submitLabel={t('admin.common.create')}
          pending={createMutation.isPending}
          onSubmit={(formData) =>
            createMutation.mutateAsync({
              team_id: fieldValue(formData, 'team_id'),
              admin_user_id: fieldValue(formData, 'admin_user_id'),
              name: fieldValue(formData, 'name'),
              description: fieldValue(formData, 'description'),
            })
          }
        >
          <div className='grid gap-4 md:grid-cols-2'>
            <NativeSelect
              name='team_id'
              label={t('admin.fields.team')}
              placeholder={t('admin.placeholders.selectTeam')}
              options={teamOptions}
              required
            />
            <NativeSelect
              name='admin_user_id'
              label={t('admin.fields.initialAdmin')}
              placeholder={t('admin.placeholders.useCurrentUser')}
              options={projectAdminOptions}
              hint={t('admin.projects.initialAdminHint')}
            />
            <TextField label={t('admin.fields.name')} name='name' required />
            <TextField
              label={t('admin.fields.description')}
              name='description'
            />
          </div>
        </FormCard>
      )}
      <NameDescriptionTable
        emptyPreset='projects'
        items={projectsQuery.data?.items ?? []}
        canEdit={(id) =>
          projectsQuery.data?.items.find((project) => project.id === id)
            ?.status === ACTIVE_STATUS &&
          (isSuperAdmin || (id === projectId && canManageSelectedProject))
        }
        onUpdate={(id, name, description) =>
          updateMutation.mutateAsync({ id, name, description })
        }
        onArchive={(id) => archiveMutation.mutateAsync(id)}
        pending={updateMutation.isPending || archiveMutation.isPending}
      />
      <CollectionCard
        title={t('admin.sections.members')}
        description={t('admin.pages.projects.next')}
        count={membersQuery.data?.items.length ?? 0}
      >
        <NativeSelect
          label={t('admin.fields.project')}
          value={projectId}
          onChange={setProjectId}
          placeholder={t('admin.placeholders.selectProject')}
          options={projectOptions}
        />
        {canManageSelectedProject && (
          <>
            <LoadingErrorState
              state={{
                isLoading: memberCandidatesLoading,
                isError: memberCandidatesIsError,
                error: memberCandidatesError,
              }}
            />
            {memberCandidateOptions.length ? (
              <MemberAddForm
                key={memberScope}
                options={memberCandidateOptions}
                pending={addMemberMutation.isPending}
                disabled={!projectId || memberCandidatesLoading}
                onSubmit={(formData) =>
                  addMemberMutation.mutateAsync({
                    projectId,
                    sessionVersion,
                    userId: fieldValue(formData, 'user_id'),
                    role: numberValue(formData, 'role', ROLE_READER),
                  })
                }
              />
            ) : (
              !memberCandidatesLoading && (
                <p className='text-sm text-muted-foreground'>
                  {t('admin.emptyStates.memberCandidates.description')}
                </p>
              )
            )}
          </>
        )}
        <MembersTable
          key={memberScope}
          members={membersQuery.data?.items ?? []}
          users={[
            ...(usersQuery.data?.items ?? []),
            ...(memberCandidatesQuery.data?.items ?? []),
          ]}
          onRole={(userId, role) =>
            roleMutation.mutateAsync({
              projectId,
              sessionVersion,
              userId,
              role,
            })
          }
          onRemove={(userId) =>
            removeMutation.mutateAsync({ projectId, sessionVersion, userId })
          }
          pending={roleMutation.isPending || removeMutation.isPending}
          readOnly={!canManageSelectedProject}
        />
      </CollectionCard>
    </PageChrome>
  )
}

type MemberChange = {
  projectId: string
  userId: string
  sessionVersion: number
}

function ownsSession(sessionVersion: number) {
  return useAuthStore.getState().auth.sessionVersion === sessionVersion
}

function MemberAddForm({
  options,
  pending,
  disabled,
  onSubmit,
}: {
  options: Array<{ value: string; label: string }>
  pending: boolean
  disabled: boolean
  onSubmit: (formData: FormData) => Promise<unknown>
}) {
  const { t } = useLanguage()
  const [error, setError] = useState<Error>()
  const mountedRef = useRef(false)
  const editVersionRef = useRef(0)
  const submitLockedRef = useRef(false)
  useLayoutEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  return (
    <form
      className='grid gap-3 md:grid-cols-[1fr_12rem_auto]'
      onInputCapture={() => editVersionRef.current++}
      onChangeCapture={() => editVersionRef.current++}
      onSubmit={async (event) => {
        event.preventDefault()
        if (submitLockedRef.current || pending || disabled) return
        submitLockedRef.current = true
        const form = event.currentTarget
        const values = new FormData(form)
        const submittedEditVersion = editVersionRef.current
        setError(undefined)
        try {
          await onSubmit(values)
          if (
            mountedRef.current &&
            editVersionRef.current === submittedEditVersion &&
            fieldValue(values, 'user_id') ===
              fieldValue(new FormData(form), 'user_id') &&
            fieldValue(values, 'role') ===
              fieldValue(new FormData(form), 'role')
          )
            form.reset()
        } catch (cause) {
          if (mountedRef.current)
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
      <NativeSelect
        name='user_id'
        label={t('admin.fields.user')}
        placeholder={t('admin.placeholders.selectUser')}
        options={options}
        required
      />
      <NativeSelect
        name='role'
        label={t('admin.fields.role')}
        placeholder={t('admin.roles.reader')}
        options={roleOptions(t)}
        defaultValue={String(ROLE_READER)}
      />
      <Button type='submit' className='self-end' disabled={disabled || pending}>
        {t('admin.common.add')}
      </Button>
      {error && (
        <Alert
          className='md:col-span-3'
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

function roleOptions(t: ReturnType<typeof useLanguage>['t']) {
  return [
    { value: String(ROLE_READER), label: t('admin.roles.reader') },
    { value: String(ROLE_WRITER), label: t('admin.roles.writer') },
    { value: String(ROLE_ADMIN), label: t('admin.roles.admin') },
  ]
}

function MemberRoleControl({
  userLabel,
  role,
  pending,
  onRole,
}: {
  userLabel: string
  role: number
  pending: boolean
  onRole: (role: number) => Promise<unknown>
}) {
  const { t } = useLanguage()
  const [nextRole, setNextRole] = useState(role)
  const currentRoleLabel =
    roleOptions(t).find((option) => option.value === String(role))?.label ??
    `${t('admin.common.unknown')} ${role}`
  const nextRoleLabel =
    roleOptions(t).find((option) => option.value === String(nextRole))?.label ??
    `${t('admin.common.unknown')} ${nextRole}`
  const changed = nextRole !== role

  return (
    <div className='flex min-w-56 flex-wrap items-center gap-2'>
      <select
        className='h-9 rounded-md border border-input bg-background px-3 text-sm'
        value={String(nextRole)}
        aria-label={`${t('admin.fields.role')}: ${userLabel}`}
        disabled={pending}
        onChange={(event) => setNextRole(Number(event.currentTarget.value))}
      >
        {roleOptions(t).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {changed && (
        <ConfirmActionButton
          label={t('admin.common.save')}
          title={t('admin.confirm.changeMemberRoleTitle', {
            user: userLabel,
            from: currentRoleLabel,
            to: nextRoleLabel,
          })}
          description={t('admin.confirm.changeMemberRoleDescription')}
          destructive={role === ROLE_ADMIN && nextRole !== ROLE_ADMIN}
          pending={pending}
          onConfirm={() => onRole(nextRole)}
        />
      )}
    </div>
  )
}

function MembersTable({
  members,
  users,
  onRole,
  onRemove,
  pending = false,
  readOnly = false,
}: {
  members: Awaited<ReturnType<typeof listProjectMembers>>['items']
  users: UserDTO[]
  onRole: (userId: string, role: number) => Promise<unknown>
  onRemove: (userId: string) => Promise<unknown>
  pending?: boolean
  readOnly?: boolean
}) {
  const { t } = useLanguage()
  const userEmail = (userId: string) =>
    users.find((user) => user.id === userId)?.email
  return members.length ? (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('admin.fields.user')}</TableHead>
          <TableHead>{t('admin.fields.role')}</TableHead>
          <TableHead>{t('admin.fields.status')}</TableHead>
          {!readOnly && <TableHead>{t('admin.fields.actions')}</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => {
          const memberUserLabel =
            member.user_email ?? userEmail(member.user_id) ?? member.user_id
          const memberReadOnly = readOnly || member.status !== ACTIVE_STATUS
          const protectsLastAdmin =
            member.status === ACTIVE_STATUS &&
            member.role === ROLE_ADMIN &&
            !members.some(
              (other) =>
                other.user_id !== member.user_id &&
                other.status === ACTIVE_STATUS &&
                other.user_status === ACTIVE_STATUS &&
                other.role === ROLE_ADMIN
            )
          return (
            <TableRow key={member.user_id}>
              <TableCell>
                <div className='grid gap-1'>
                  <span className='font-medium'>{memberUserLabel}</span>
                  {member.user_name && (
                    <span className='text-xs text-muted-foreground'>
                      {member.user_name}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {memberReadOnly || protectsLastAdmin ? (
                  <div className='grid gap-1'>
                    <span>
                      {
                        roleOptions(t).find(
                          (option) => option.value === String(member.role)
                        )?.label
                      }
                    </span>
                    {protectsLastAdmin && (
                      <span className='max-w-72 text-xs text-muted-foreground'>
                        {t('admin.projects.lastAdminProtected')}
                      </span>
                    )}
                  </div>
                ) : (
                  <MemberRoleControl
                    key={`${member.user_id}:${member.role}`}
                    userLabel={memberUserLabel}
                    role={member.role}
                    pending={pending}
                    onRole={(role) => onRole(member.user_id, role)}
                  />
                )}
              </TableCell>
              <TableCell>
                <StatusBadge>
                  {member.status === ACTIVE_STATUS
                    ? accountStatusLabel(member.user_status, t)
                    : accountStatusLabel(member.status, t)}
                </StatusBadge>
              </TableCell>
              {!readOnly && (
                <TableCell>
                  {!memberReadOnly && !protectsLastAdmin && (
                    <ConfirmActionButton
                      label={t('admin.actions.removeMember')}
                      title={t('admin.confirm.removeMemberTitle', {
                        user: memberUserLabel,
                      })}
                      description={t('admin.confirm.removeMemberDescription')}
                      pending={pending}
                      onConfirm={() => onRemove(member.user_id)}
                    />
                  )}
                </TableCell>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  ) : (
    <EmptyState preset='members' />
  )
}
