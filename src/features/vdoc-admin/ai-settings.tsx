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
import { AINativeSelect } from './ai-settings-fields'
import type { PromptSaveRequest } from './ai-settings-types'
import { toProjectOptions } from './ai-settings-utils'

export function AISettingsPanel() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [projectId, setProjectId] = useState('')
  const [systemTestResult, setSystemTestResult] = useState('')
  const [projectTestResult, setProjectTestResult] = useState('')
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
    mutationFn: (payload: AIProviderPayload) => testSystemAIProvider(payload),
    onSuccess: (result) => setSystemTestResult(result.content),
  })
  const testProjectProviderMutation = useMutation({
    mutationFn: (payload: AIProviderPayload) =>
      testProjectAIProvider(selectedProjectId, payload),
    onSuccess: (result) => setProjectTestResult(result.content),
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
          testResult={systemTestResult}
          onSave={(payload) => updateSystemProviderMutation.mutate(payload)}
          onTest={(payload) => testSystemProviderMutation.mutate(payload)}
        />
        <section className='grid gap-4 rounded-md border bg-[var(--surface-control)] p-4'>
          <AINativeSelect
            id='ai-project-scope'
            label={t('admin.ai.projectScope')}
            value={selectedProjectId}
            options={projectOptions}
            placeholder={t('admin.placeholders.selectProject')}
            onChange={setProjectId}
          />
          <AIProviderPanel
            scope='project'
            provider={projectProviderQuery.data}
            projectId={selectedProjectId}
            pending={updateProjectProviderMutation.isPending}
            testing={testProjectProviderMutation.isPending}
            testResult={projectTestResult}
            onSave={(payload) => updateProjectProviderMutation.mutate(payload)}
            onTest={(payload) => testProjectProviderMutation.mutate(payload)}
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
