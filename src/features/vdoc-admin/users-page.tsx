import { useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { userPasswordError } from '@/lib/user-password'
import {
  createUser,
  listUserMCPTokens,
  listUsers,
  patchUser,
  revokeUserMCPToken,
} from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
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
  AccessDeniedPage,
  PageChrome,
  LoadingErrorState,
  FormDialog,
  TextField,
  NativeSelect,
  CollectionCard,
  StatusBadge,
  ConfirmActionButton,
  EmptyState,
  TokenTable,
} from './page-shared'
import {
  useInvalidateResources,
  fieldValue,
  accountStatusLabel,
  ACTIVE_STATUS,
  ARCHIVED_OR_DISABLED_STATUS,
} from './page-utils'

export function UsersPage() {
  const { t } = useLanguage()
  const isSuperAdmin = Boolean(
    useAuthStore((state) => state.auth.user?.is_super_admin)
  )
  const sessionVersion = useAuthStore((state) => state.auth.sessionVersion)
  const invalidateResources = useInvalidateResources()
  const invalidate = () => invalidateResources({ kind: 'users' })
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: ({ signal }) => listUsers({ signal }),
    enabled: isSuperAdmin,
  })
  const [selectedUserId, setSelectedUserId] = useState('')
  const tokenButtonsRef = useRef(new Map<string, HTMLButtonElement>())
  const selectedUser = usersQuery.data?.items.find(
    (user) => user.id === selectedUserId
  )
  const userTokenQuery = useQuery({
    queryKey: ['user-mcp-tokens', selectedUserId],
    queryFn: ({ signal }) => listUserMCPTokens(selectedUserId, { signal }),
    enabled: isSuperAdmin && selectedUserId.length > 0,
  })
  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: invalidate,
  })
  const patchMutation = useMutation({
    mutationFn: ({
      id,
      status,
      isSuperAdmin,
    }: {
      id: string
      status?: number
      isSuperAdmin?: boolean
    }) => patchUser(id, { status, is_super_admin: isSuperAdmin }),
    onSuccess: invalidate,
  })
  const revokeMutation = useMutation({
    mutationFn: ({ userId, tokenId }: { userId: string; tokenId: string }) =>
      revokeUserMCPToken(userId, tokenId),
    onSuccess: invalidate,
  })

  if (!isSuperAdmin) {
    return <AccessDeniedPage page='users' />
  }

  return (
    <PageChrome page='users'>
      <LoadingErrorState
        state={{
          isLoading: usersQuery.isLoading,
          isError: usersQuery.isError,
          error: usersQuery.error,
        }}
      />
      <CollectionCard
        title={t('nav.users')}
        count={usersQuery.data?.total ?? 0}
        actions={
          <FormDialog
            title={t('admin.sections.createUser')}
            submitLabel={t('admin.common.create')}
            pending={createMutation.isPending}
            submissionScope={String(sessionVersion)}
            onSubmit={(formData) => {
              const password = String(formData.get('password') ?? '')
              if (userPasswordError(password) !== undefined) {
                throw new Error(t('auth.validation.passwordPolicy'))
              }
              return createMutation.mutateAsync({
                email: fieldValue(formData, 'email'),
                name: fieldValue(formData, 'name'),
                password,
                is_super_admin:
                  fieldValue(formData, 'is_super_admin') === 'true',
              })
            }}
          >
            <div className='grid gap-4'>
              <TextField
                label={t('admin.fields.email')}
                name='email'
                type='email'
                required
              />
              <TextField label={t('admin.fields.name')} name='name' required />
            </div>
            <div className='grid gap-4'>
              <TextField
                label={t('admin.fields.password')}
                name='password'
                type='password'
                required
                description={t('auth.validation.passwordPolicy')}
              />
              <NativeSelect
                name='is_super_admin'
                label={t('admin.fields.superAdmin')}
                placeholder={t('admin.common.no')}
                options={[
                  { value: 'false', label: t('admin.common.no') },
                  { value: 'true', label: t('admin.common.yes') },
                ]}
              />
            </div>
          </FormDialog>
        }
      >
        {usersQuery.data?.items.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.fields.email')}</TableHead>
                <TableHead>{t('admin.fields.status')}</TableHead>
                <TableHead>{t('admin.fields.superAdmin')}</TableHead>
                <TableHead>{t('admin.fields.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.data.items.map((user) => (
                <TableRow
                  key={user.id}
                  data-state={
                    selectedUserId === user.id ? 'selected' : undefined
                  }
                >
                  <TableCell>
                    <div className='font-medium'>{user.email}</div>
                    <div className='mt-1 flex items-center justify-center gap-3 text-xs'>
                      <span className='text-muted-foreground'>{user.name}</span>
                      <Button
                        ref={(button) => {
                          if (button)
                            tokenButtonsRef.current.set(user.id, button)
                          else tokenButtonsRef.current.delete(user.id)
                        }}
                        type='button'
                        variant='link'
                        size='sm'
                        className='h-auto min-h-6 p-0 text-xs'
                        aria-pressed={selectedUserId === user.id}
                        onClick={() => setSelectedUserId(user.id)}
                      >
                        {t('admin.actions.viewUserTokens')}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge>
                      {accountStatusLabel(user.status, t)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    {user.is_super_admin
                      ? t('admin.common.yes')
                      : t('admin.common.no')}
                  </TableCell>
                  <TableCell>
                    <div className='flex flex-wrap justify-center gap-2'>
                      {user.status === ACTIVE_STATUS ? (
                        <ConfirmActionButton
                          label={t('admin.actions.disableUser')}
                          title={t('admin.confirm.disableUserTitle', {
                            email: user.email,
                          })}
                          description={t(
                            'admin.confirm.disableUserDescription'
                          )}
                          pending={patchMutation.isPending}
                          onConfirm={() =>
                            patchMutation.mutateAsync({
                              id: user.id,
                              status: ARCHIVED_OR_DISABLED_STATUS,
                            })
                          }
                        />
                      ) : (
                        <ConfirmActionButton
                          label={t('admin.actions.enableUser')}
                          title={t('admin.confirm.enableUserTitle', {
                            email: user.email,
                          })}
                          description={t('admin.confirm.enableUserDescription')}
                          destructive={false}
                          pending={patchMutation.isPending}
                          onConfirm={() =>
                            patchMutation.mutateAsync({
                              id: user.id,
                              status: ACTIVE_STATUS,
                            })
                          }
                        />
                      )}
                      <ConfirmActionButton
                        label={t(
                          user.is_super_admin
                            ? 'admin.actions.revokeSuperAdmin'
                            : 'admin.actions.grantSuperAdmin'
                        )}
                        title={t(
                          user.is_super_admin
                            ? 'admin.confirm.revokeSuperAdminTitle'
                            : 'admin.confirm.grantSuperAdminTitle',
                          { email: user.email }
                        )}
                        description={t(
                          user.is_super_admin
                            ? 'admin.confirm.revokeSuperAdminDescription'
                            : 'admin.confirm.grantSuperAdminDescription'
                        )}
                        destructive={user.is_super_admin}
                        pending={patchMutation.isPending}
                        onConfirm={() =>
                          patchMutation.mutateAsync({
                            id: user.id,
                            isSuperAdmin: !user.is_super_admin,
                          })
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState preset='users' />
        )}
      </CollectionCard>
      {selectedUser && (
        <TokenTable
          title={t('admin.sections.userTokens')}
          description={selectedUser.email}
          actions={
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => {
                setSelectedUserId('')
                tokenButtonsRef.current.get(selectedUserId)?.focus()
              }}
            >
              {t('admin.actions.hideUserTokens')}
            </Button>
          }
          tokens={userTokenQuery.data?.items ?? []}
          emptyPreset='userTokens'
          emptyContent={
            <p role='status' className='text-sm text-muted-foreground'>
              {t('admin.userTokens.noneIssued', { user: selectedUser.email })}
            </p>
          }
          queryState={{
            isLoading: userTokenQuery.isLoading,
            isError: userTokenQuery.isError,
            error: userTokenQuery.error,
          }}
          onRetry={() => void userTokenQuery.refetch()}
          refreshing={userTokenQuery.isFetching}
          onRevoke={(tokenId) =>
            revokeMutation.mutateAsync({ userId: selectedUserId, tokenId })
          }
          pending={revokeMutation.isPending}
        />
      )}
    </PageChrome>
  )
}
