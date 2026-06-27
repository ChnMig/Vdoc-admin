import type {
  AIProviderDTO,
  AIProviderPayload,
  AIPromptTemplateDTO,
} from '@/lib/vdoc-api'

export type ProviderScope = 'system' | 'project'

export type SelectOption = {
  readonly value: string
  readonly label: string
}

export type ProviderPanelProps = {
  readonly scope: ProviderScope
  readonly provider?: AIProviderDTO
  readonly projectId?: string
  readonly pending: boolean
  readonly testing: boolean
  readonly testResult?: string
  readonly onSave: (payload: AIProviderPayload) => void
  readonly onTest: (payload: AIProviderPayload) => void
}

export type PromptPanelProps = {
  readonly scope: ProviderScope
  readonly prompts: readonly AIPromptTemplateDTO[]
  readonly projectId?: string
  readonly pending: boolean
  readonly onSave: (promptKey: string, payload: AIPromptTemplateDTO) => void
}

export type PromptSaveRequest = {
  readonly promptKey: string
  readonly payload: AIPromptTemplateDTO
}
