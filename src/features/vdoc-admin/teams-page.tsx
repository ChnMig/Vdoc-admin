import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { archiveTeam, createTeam, listTeams, updateTeam } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import {
  AccessDeniedPage,
  NameDescriptionTable,
  PageChrome,
  LoadingErrorState,
  FormDialog,
  TextField,
} from './page-shared'
import { useInvalidateResources, fieldValue } from './page-utils'

export function TeamsPage() {
  const { t } = useLanguage()
  const isSuperAdmin = Boolean(
    useAuthStore((state) => state.auth.user?.is_super_admin)
  )
  const sessionVersion = useAuthStore((state) => state.auth.sessionVersion)
  const invalidateResources = useInvalidateResources()
  const invalidate = () => invalidateResources({ kind: 'teams' })
  const teamsQuery = useQuery({
    queryKey: ['teams'],
    queryFn: ({ signal }) => listTeams({ signal }),
    enabled: isSuperAdmin,
  })
  const createMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: invalidate,
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
    }) => updateTeam(id, { name, description }),
    onSuccess: invalidate,
  })
  const archiveMutation = useMutation({
    mutationFn: archiveTeam,
    onSuccess: invalidate,
  })
  if (!isSuperAdmin) {
    return <AccessDeniedPage page='teams' />
  }

  return (
    <PageChrome page='teams'>
      <LoadingErrorState
        state={{
          isLoading: teamsQuery.isLoading,
          isError: teamsQuery.isError,
          error: teamsQuery.error,
        }}
      />
      <NameDescriptionTable
        emptyPreset='teams'
        actions={
          <FormDialog
            title={t('admin.sections.createTeam')}
            submitLabel={t('admin.common.create')}
            pending={createMutation.isPending}
            submissionScope={String(sessionVersion)}
            onSubmit={(formData) =>
              createMutation.mutateAsync({
                name: fieldValue(formData, 'name'),
                description: fieldValue(formData, 'description'),
              })
            }
          >
            <TextField label={t('admin.fields.name')} name='name' required />
            <TextField
              label={t('admin.fields.description')}
              name='description'
            />
          </FormDialog>
        }
        items={teamsQuery.data?.items ?? []}
        onUpdate={(id, name, description) =>
          updateMutation.mutateAsync({ id, name, description })
        }
        onArchive={(id) => archiveMutation.mutateAsync(id)}
        pending={updateMutation.isPending || archiveMutation.isPending}
      />
    </PageChrome>
  )
}
