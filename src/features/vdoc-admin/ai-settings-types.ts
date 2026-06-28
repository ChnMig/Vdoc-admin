import type {
  AIProviderDTO,
  AIProviderPayload,
  AIPromptTemplateDTO,
} from '@/lib/vdoc-api'

export type ProviderScope = 'system' | 'project'

type ProviderTuningDefaults = Required<
  Pick<AIProviderPayload, 'temperature' | 'timeout_ms' | 'max_output_tokens'>
>

export const AI_PROVIDER_DEFAULT_TUNING = {
  temperature: 0.2,
  timeout_ms: 30000,
  max_output_tokens: 1000,
} as const satisfies ProviderTuningDefaults

export type SelectOption = {
  readonly value: string
  readonly label: string
}

export type ProviderTestState = {
  readonly status: 'idle' | 'success' | 'error'
  readonly message?: string
}

export type ProviderPanelProps = {
  readonly scope: ProviderScope
  readonly provider?: AIProviderDTO
  readonly projectId?: string
  readonly pending: boolean
  readonly testing: boolean
  readonly testResult: ProviderTestState
  readonly onSave: (payload: AIProviderPayload) => void
  readonly onTest: (payload: AIProviderPayload) => void
  readonly onTestPayloadChange?: () => void
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
