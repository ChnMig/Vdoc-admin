import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Eye, TriangleAlert } from 'lucide-react'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'
import {
  getProjectAIProvider,
  getSystemAIProvider,
  listProjectAIPrompts,
  listProjectMembers,
  listProjects,
  listSystemAIPrompts,
  testProjectAIProvider,
  testSystemAIProvider,
  updateProjectAIProvider,
  updateProjectAIPrompt,
  updateSystemAIProvider,
  updateSystemAIPrompt,
  type AIProviderPayload,
} from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AIPromptPanel } from './ai-prompt-panel'
import { AIProviderPanel } from './ai-provider-panel'
import {
  useProviderTestState,
  type ProjectProviderTestRequest,
  type ProviderTestRequest,
} from './ai-provider-test-state'
import { AINativeSelect } from './ai-settings-fields'
import type { PromptSaveRequest } from './ai-settings-types'
import { providerFormKey, toProjectOptions } from './ai-settings-utils'

const ACTIVE_PROJECT_STATUS = 1

export function AISettingsPanel({ user }: { readonly user?: AuthUser }) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [projectId, setProjectId] = useState('')
  const storedAuthUser = useAuthStore((state) => state.auth.user)
  const authUser = user ?? storedAuthUser
  const isSuperAdmin = Boolean(authUser?.is_super_admin)
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  })
  const projects = projectsQuery.data?.items ?? []
  const projectOptions = toProjectOptions(projects, t)
  const selectedProjectId = projectOptions.some(
    (project) => project.value === projectId
  )
    ? projectId
    : (projectOptions[0]?.value ?? '')
  const selectedProject = projects.find(
    (project) => project.id === selectedProjectId
  )
  const projectIsActive = selectedProject?.status === ACTIVE_PROJECT_STATUS
  const projectMembersQuery = useQuery({
    queryKey: ['project-members', selectedProjectId],
    queryFn: () => listProjectMembers(selectedProjectId),
    enabled: selectedProjectId.length > 0 && !isSuperAdmin,
  })
  const canManageProject = Boolean(
    isSuperAdmin ||
    projectMembersQuery.data?.items.some(
      (member) => member.user_id === authUser?.id && member.role === 3
    )
  )
  const projectPermissionResolved =
    isSuperAdmin || projectMembersQuery.isSuccess || projectMembersQuery.isError
  const canChangeProjectAI = Boolean(projectIsActive && canManageProject)

  const systemProviderQuery = useQuery({
    queryKey: ['ai-provider', 'system'],
    queryFn: getSystemAIProvider,
    enabled: isSuperAdmin,
  })
  const projectProviderQuery = useQuery({
    queryKey: ['ai-provider', 'project', selectedProjectId],
    queryFn: () => getProjectAIProvider(selectedProjectId),
    enabled: selectedProjectId.length > 0 && canManageProject,
  })
  const systemPromptsQuery = useQuery({
    queryKey: ['ai-prompts', 'system'],
    queryFn: listSystemAIPrompts,
    enabled: isSuperAdmin,
  })
  const projectPromptsQuery = useQuery({
    queryKey: ['ai-prompts', 'project', selectedProjectId],
    queryFn: () => listProjectAIPrompts(selectedProjectId),
    enabled: selectedProjectId.length > 0 && canManageProject,
  })
  const systemProviderFormIdentity = providerFormKey(
    'system',
    systemProviderQuery.data,
    undefined
  )
  const projectProviderFormIdentity = providerFormKey(
    'project',
    projectProviderQuery.data,
    selectedProjectId
  )
  const systemProviderTest = useProviderTestState(systemProviderFormIdentity)
  const projectProviderTest = useProviderTestState(projectProviderFormIdentity)

  const updateSystemProviderMutation = useMutation({
    mutationFn: (payload: AIProviderPayload) => updateSystemAIProvider(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['ai-provider', 'system'] }),
  })
  const updateProjectProviderMutation = useMutation({
    mutationFn: (request: { projectId: string; payload: AIProviderPayload }) =>
      updateProjectAIProvider(request.projectId, request.payload),
    onSuccess: (_provider, request) =>
      queryClient.invalidateQueries({
        queryKey: ['ai-provider', 'project', request.projectId],
      }),
  })
  const testSystemProviderMutation = useMutation({
    mutationFn: (request: ProviderTestRequest) =>
      testSystemAIProvider(request.payload),
    onSuccess: (result, request) =>
      systemProviderTest.acceptResult(request, result),
    onError: (error: Error, request) =>
      systemProviderTest.acceptError(
        request,
        providerTestErrorMessage(error, t)
      ),
  })
  const testProjectProviderMutation = useMutation({
    mutationFn: (request: ProjectProviderTestRequest) =>
      testProjectAIProvider(request.projectId, request.payload),
    onSuccess: (result, request) =>
      projectProviderTest.acceptResult(request, result),
    onError: (error: Error, request) =>
      projectProviderTest.acceptError(
        request,
        providerTestErrorMessage(error, t)
      ),
  })
  const updateSystemPromptMutation = useMutation({
    mutationFn: (request: PromptSaveRequest) =>
      updateSystemAIPrompt(request.promptKey, request.payload),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['ai-prompts', 'system'] }),
  })
  const updateProjectPromptMutation = useMutation({
    mutationFn: (
      request: PromptSaveRequest & {
        projectId: string
      }
    ) =>
      updateProjectAIPrompt(
        request.projectId,
        request.promptKey,
        request.payload
      ),
    onSuccess: (_prompt, request) =>
      queryClient.invalidateQueries({
        queryKey: ['ai-prompts', 'project', request.projectId],
      }),
  })
  const projectProviderSavePending = Boolean(
    updateProjectProviderMutation.isPending &&
    updateProjectProviderMutation.variables?.projectId === selectedProjectId
  )
  const projectProviderTestPending = Boolean(
    testProjectProviderMutation.isPending &&
    testProjectProviderMutation.variables?.projectId === selectedProjectId
  )
  const projectPromptSavePending = Boolean(
    updateProjectPromptMutation.isPending &&
    updateProjectPromptMutation.variables?.projectId === selectedProjectId
  )
  const projectProviderSaveIsCurrent =
    updateProjectProviderMutation.variables?.projectId === selectedProjectId
  const projectProviderSaveError =
    updateProjectProviderMutation.isError && projectProviderSaveIsCurrent
      ? updateProjectProviderMutation.error
      : undefined
  const projectPromptSaveError =
    updateProjectPromptMutation.isError &&
    updateProjectPromptMutation.variables?.projectId === selectedProjectId
      ? updateProjectPromptMutation.error
      : undefined

  return (
    <Card className='overflow-hidden'>
      <CardHeader className='border-b pb-5'>
        <div className='grid gap-2'>
          <Badge className='w-fit' variant='secondary'>
            {t('admin.ai.badge')}
          </Badge>
          <CardTitle>{t('admin.ai.settingsTitle')}</CardTitle>
          <CardDescription>{t('admin.ai.settingsDescription')}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className='grid gap-5 p-5'>
        {isSuperAdmin && systemProviderQuery.isLoading && (
          <p role='status' className='text-sm text-muted-foreground'>
            {t('admin.ai.loadingSystemProvider')}
          </p>
        )}
        {isSuperAdmin && systemProviderQuery.isError && (
          <SettingsErrorAlert
            title={t('admin.ai.systemProviderLoadErrorTitle')}
            description={t('admin.ai.systemProviderLoadErrorDescription')}
          />
        )}
        {isSuperAdmin && systemProviderQuery.data && (
          <>
            <AIProviderPanel
              scope='system'
              provider={systemProviderQuery.data}
              pending={updateSystemProviderMutation.isPending}
              testing={testSystemProviderMutation.isPending}
              testResult={systemProviderTest.state}
              onSave={(payload) =>
                updateSystemProviderMutation.mutateAsync(payload)
              }
              onTest={(payload) => {
                return testSystemProviderMutation.mutateAsync(
                  systemProviderTest.begin('system', '', payload)
                )
              }}
              onTestPayloadChange={systemProviderTest.reset}
            />
            {updateSystemProviderMutation.isError && (
              <MutationErrorAlert error={updateSystemProviderMutation.error} />
            )}
          </>
        )}
        <section className='grid gap-4 rounded-md border bg-[var(--surface-control)] p-4'>
          <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end'>
            <AINativeSelect
              id='ai-project-scope'
              label={t('admin.ai.projectScope')}
              value={selectedProjectId}
              options={projectOptions}
              placeholder={t('admin.placeholders.selectProject')}
              onChange={(nextProjectId) => {
                projectProviderTest.reset()
                setProjectId(nextProjectId)
              }}
            />
            {selectedProject && (
              <Badge
                className='mb-1 w-fit'
                variant={projectIsActive ? 'outline' : 'secondary'}
              >
                {projectIsActive
                  ? t('admin.statuses.active')
                  : t('admin.statuses.archived')}
              </Badge>
            )}
          </div>
          {!projectsQuery.isLoading && projectOptions.length === 0 && (
            <p className='rounded-md border bg-background p-4 text-sm text-muted-foreground'>
              {t('admin.ai.noReadableProjects')}
            </p>
          )}
          {projectsQuery.isLoading && (
            <p role='status' className='text-sm text-muted-foreground'>
              {t('admin.ai.loadingProjects')}
            </p>
          )}
          {projectsQuery.isError && (
            <SettingsErrorAlert
              title={t('admin.ai.projectsLoadErrorTitle')}
              description={t('admin.ai.projectsLoadErrorDescription')}
            />
          )}
          {selectedProject && !projectPermissionResolved && (
            <p role='status' className='text-sm text-muted-foreground'>
              {t('admin.ai.checkingProjectPermission')}
            </p>
          )}
          {selectedProject && !projectIsActive && canManageProject && (
            <Alert>
              <Archive />
              <AlertTitle>{t('admin.ai.archivedSettingsTitle')}</AlertTitle>
              <AlertDescription>
                {t('admin.ai.archivedSettingsDescription')}
              </AlertDescription>
            </Alert>
          )}
          {selectedProject &&
            projectPermissionResolved &&
            !projectMembersQuery.isError &&
            !canManageProject && (
              <Alert>
                <Eye />
                <AlertTitle>{t('admin.ai.readOnlySettingsTitle')}</AlertTitle>
                <AlertDescription>
                  {t('admin.ai.readOnlySettingsDescription')}
                </AlertDescription>
              </Alert>
            )}
          {selectedProject && projectMembersQuery.isError && !isSuperAdmin && (
            <Alert variant='destructive'>
              <TriangleAlert />
              <AlertTitle>
                {t('admin.ai.permissionCheckFailedTitle')}
              </AlertTitle>
              <AlertDescription>
                {t('admin.ai.permissionCheckFailedDescription')}
              </AlertDescription>
            </Alert>
          )}
          {selectedProjectId && projectProviderQuery.isLoading && (
            <p role='status' className='text-sm text-muted-foreground'>
              {t('admin.ai.loadingProjectSettings')}
            </p>
          )}
          {selectedProjectId && projectProviderQuery.isError && (
            <Alert variant='destructive'>
              <TriangleAlert />
              <AlertTitle>{t('admin.ai.projectSettingsErrorTitle')}</AlertTitle>
              <AlertDescription>
                {t('admin.ai.projectSettingsErrorDescription')}
              </AlertDescription>
            </Alert>
          )}
          {selectedProjectId && projectProviderQuery.data && (
            <>
              <AIProviderPanel
                key={projectProviderFormIdentity}
                scope='project'
                provider={projectProviderQuery.data}
                projectId={selectedProjectId}
                readOnly={!canChangeProjectAI}
                pending={projectProviderSavePending}
                testing={projectProviderTestPending}
                testResult={projectProviderTest.state}
                onSave={(payload) => {
                  if (!canChangeProjectAI) return Promise.resolve()
                  return updateProjectProviderMutation.mutateAsync({
                    projectId: selectedProjectId,
                    payload,
                  })
                }}
                onTest={(payload) => {
                  if (!canChangeProjectAI) return Promise.resolve()
                  const request = projectProviderTest.begin(
                    'project',
                    selectedProjectId,
                    payload
                  )
                  return testProjectProviderMutation.mutateAsync({
                    ...request,
                    projectId: selectedProjectId,
                  })
                }}
                onTestPayloadChange={projectProviderTest.reset}
              />
              {projectProviderSaveError && (
                <MutationErrorAlert error={projectProviderSaveError} />
              )}
            </>
          )}
        </section>
        <div className='grid gap-4 lg:grid-cols-2'>
          {isSuperAdmin && (
            <AIPromptPanel
              scope='system'
              prompts={systemPromptsQuery.data?.items ?? []}
              loading={systemPromptsQuery.isLoading}
              error={systemPromptsQuery.error}
              pending={updateSystemPromptMutation.isPending}
              onSave={(promptKey, payload) =>
                updateSystemPromptMutation.mutateAsync({ promptKey, payload })
              }
            />
          )}
          {isSuperAdmin && updateSystemPromptMutation.isError && (
            <MutationErrorAlert error={updateSystemPromptMutation.error} />
          )}
          {selectedProjectId && canManageProject && (
            <AIPromptPanel
              key={`project-prompts-${selectedProjectId}`}
              scope='project'
              prompts={projectPromptsQuery.data?.items ?? []}
              projectId={selectedProjectId}
              readOnly={!canChangeProjectAI}
              loading={projectPromptsQuery.isLoading}
              error={projectPromptsQuery.error}
              pending={projectPromptSavePending}
              onSave={(promptKey, payload) => {
                if (!canChangeProjectAI) return Promise.resolve()
                return updateProjectPromptMutation.mutateAsync({
                  projectId: selectedProjectId,
                  promptKey,
                  payload,
                })
              }}
            />
          )}
          {projectPromptSaveError && (
            <MutationErrorAlert error={projectPromptSaveError} />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function MutationErrorAlert({ error }: { readonly error: Error }) {
  const { t } = useLanguage()
  return (
    <SettingsErrorAlert
      title={t('admin.ai.settingsMutationErrorTitle')}
      description={`${error.message} ${t('admin.ai.settingsMutationErrorRecovery')}`}
    />
  )
}

function SettingsErrorAlert({
  title,
  description,
}: {
  readonly title: string
  readonly description: string
}) {
  return (
    <Alert variant='destructive' aria-live='polite'>
      <TriangleAlert />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  )
}

function providerTestErrorMessage(
  error: Error,
  t: ReturnType<typeof useLanguage>['t']
) {
  return error.message.length > 0
    ? error.message
    : t('admin.ai.providerTestUnknownError')
}
