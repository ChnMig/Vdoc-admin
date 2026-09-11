import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { archiveTeam, createTeam, listTeams, updateTeam } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import {
  AccessDeniedPage,
  NameDescriptionTable,
  PageChrome,
  LoadingErrorState,
  FormCard,
  TextField,
} from './page-shared'
import {
  useInvalidateResources,
  fieldValue,
  type PageKey,
  type QueryState,
} from './page-utils'

export function TeamsPage() {
  const { t } = useLanguage()
  const isSuperAdmin = Boolean(
    useAuthStore((state) => state.auth.user?.is_super_admin)
  )
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
    <EntityPage
      page='teams'
      createTitle={t('admin.sections.createTeam')}
      queryState={{
        isLoading: teamsQuery.isLoading,
        isError: teamsQuery.isError,
        error: teamsQuery.error,
      }}
      onCreate={(formData) =>
        createMutation.mutateAsync({
          name: fieldValue(formData, 'name'),
          description: fieldValue(formData, 'description'),
        })
      }
      createPending={createMutation.isPending}
    >
      <NameDescriptionTable
        emptyPreset='teams'
        items={teamsQuery.data?.items ?? []}
        onUpdate={(id, name, description) =>
          updateMutation.mutateAsync({ id, name, description })
        }
        onArchive={(id) => archiveMutation.mutateAsync(id)}
        pending={updateMutation.isPending || archiveMutation.isPending}
      />
    </EntityPage>
  )
}

export function EntityPage({
  page,
  createTitle,
  queryState,
  children,
  onCreate,
  createPending,
}: {
  page: PageKey
  createTitle: string
  queryState: QueryState
  children: React.ReactNode
  onCreate: (formData: FormData) => Promise<unknown>
  createPending: boolean
}) {
  const { t } = useLanguage()
  return (
    <PageChrome page={page}>
      <LoadingErrorState state={queryState} />
      <FormCard
        title={createTitle}
        submitLabel={t('admin.common.create')}
        pending={createPending}
        onSubmit={onCreate}
      >
        <div className='grid gap-4 md:grid-cols-2'>
          <TextField label={t('admin.fields.name')} name='name' required />
          <TextField label={t('admin.fields.description')} name='description' />
        </div>
      </FormCard>
      {children}
    </PageChrome>
  )
}
