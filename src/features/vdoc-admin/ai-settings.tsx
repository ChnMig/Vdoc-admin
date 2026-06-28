import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getProjectAIProvider,
  getSystemAIProvider,
  listProjectAIPrompts,
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

export function AISettingsPanel() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [projectId, setProjectId] = useState('')
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: listProjects,
  })
  const projectOptions = toProjectOptions(projectsQuery.data?.items ?? [])
  const selectedProjectId = projectOptions.some(
    (project) => project.value === projectId
  )
    ? projectId
    : (projectOptions[0]?.value ?? '')

  const systemProviderQuery = useQuery({
    queryKey: ['ai-provider', 'system'],
    queryFn: getSystemAIProvider,
  })
  const projectProviderQuery = useQuery({
    queryKey: ['ai-provider', 'project', selectedProjectId],
    queryFn: () => getProjectAIProvider(selectedProjectId),
    enabled: selectedProjectId.length > 0,
  })
  const systemPromptsQuery = useQuery({
    queryKey: ['ai-prompts', 'system'],
    queryFn: listSystemAIPrompts,
  })
  const projectPromptsQuery = useQuery({
    queryKey: ['ai-prompts', 'project', selectedProjectId],
    queryFn: () => listProjectAIPrompts(selectedProjectId),
    enabled: selectedProjectId.length > 0,
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
    mutationFn: (payload: AIProviderPayload) =>
      updateProjectAIProvider(selectedProjectId, payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['ai-provider', 'project', selectedProjectId],
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
    mutationFn: (request: PromptSaveRequest) =>
      updateProjectAIPrompt(
        selectedProjectId,
        request.promptKey,
        request.payload
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['ai-prompts', 'project', selectedProjectId],
      }),
  })

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
        <AIProviderPanel
          scope='system'
          provider={systemProviderQuery.data}
          pending={updateSystemProviderMutation.isPending}
          testing={testSystemProviderMutation.isPending}
          testResult={systemProviderTest.state}
          onSave={(payload) => updateSystemProviderMutation.mutate(payload)}
          onTest={(payload) => {
            testSystemProviderMutation.mutate(
              systemProviderTest.begin('system', '', payload)
            )
          }}
          onTestPayloadChange={systemProviderTest.reset}
        />
        <section className='grid gap-4 rounded-md border bg-[var(--surface-control)] p-4'>
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
          <AIProviderPanel
            scope='project'
            provider={projectProviderQuery.data}
            projectId={selectedProjectId}
            pending={updateProjectProviderMutation.isPending}
            testing={testProjectProviderMutation.isPending}
            testResult={projectProviderTest.state}
            onSave={(payload) => updateProjectProviderMutation.mutate(payload)}
            onTest={(payload) => {
              const request = projectProviderTest.begin(
                'project',
                selectedProjectId,
                payload
              )
              testProjectProviderMutation.mutate({
                ...request,
                projectId: selectedProjectId,
              })
            }}
            onTestPayloadChange={projectProviderTest.reset}
          />
        </section>
        <div className='grid gap-4 lg:grid-cols-2'>
          <AIPromptPanel
            scope='system'
            prompts={systemPromptsQuery.data?.items ?? []}
            pending={updateSystemPromptMutation.isPending}
            onSave={(promptKey, payload) =>
              updateSystemPromptMutation.mutate({ promptKey, payload })
            }
          />
          <AIPromptPanel
            scope='project'
            prompts={projectPromptsQuery.data?.items ?? []}
            projectId={selectedProjectId}
            pending={updateProjectPromptMutation.isPending}
            onSave={(promptKey, payload) =>
              updateProjectPromptMutation.mutate({ promptKey, payload })
            }
          />
        </div>
      </CardContent>
    </Card>
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
