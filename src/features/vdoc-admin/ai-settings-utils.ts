import type { TFunction } from '@/lib/i18n'
import {
  AI_PROVIDER_API_MODES,
  isAIProviderAPIMode,
  type AIProviderAPIMode,
  type AIProviderDTO,
  type AIProviderPayload,
  type AIPromptTemplateDTO,
  type ProjectDTO,
} from '@/lib/vdoc-api'
import type { ProviderScope, SelectOption } from './ai-settings-types'

export function toProjectOptions(
  projects: readonly ProjectDTO[]
): readonly SelectOption[] {
  return projects.map((project) => ({ value: project.id, label: project.name }))
}

export function providerPayload(formData: FormData): AIProviderPayload {
  const base = {
    name: fieldValue(formData, 'name'),
    base_url: fieldValue(formData, 'base_url'),
    model: fieldValue(formData, 'model'),
    api_mode: providerApiMode(formData),
    enabled: fieldValue(formData, 'enabled') === 'true',
  }
  const apiKey = fieldValue(formData, 'api_key')
  const temperature = optionalNumberField(formData, 'temperature')
  const timeoutMs = optionalNumberField(formData, 'timeout_ms')
  const maxOutputTokens = optionalNumberField(formData, 'max_output_tokens')

  return {
    ...base,
    ...(apiKey.length > 0 ? { api_key: apiKey } : {}),
    ...(temperature === undefined ? {} : { temperature }),
    ...(timeoutMs === undefined ? {} : { timeout_ms: timeoutMs }),
    ...(maxOutputTokens === undefined
      ? {}
      : { max_output_tokens: maxOutputTokens }),
  }
}

export function promptPayload(
  promptKey: string,
  formData: FormData
): AIPromptTemplateDTO {
  return {
    prompt_key: promptKey,
    system_prompt: fieldValue(formData, 'system_prompt'),
    user_prompt_template: fieldValue(formData, 'user_prompt_template'),
    enabled: fieldValue(formData, 'enabled') === 'true',
  }
}

export function enabledOptions(t: TFunction): readonly SelectOption[] {
  return [
    { value: 'true', label: t('admin.statuses.enabled') },
    { value: 'false', label: t('admin.statuses.disabled') },
  ]
}

export function providerApiModeOptions(t: TFunction): readonly SelectOption[] {
  return [
    {
      value: AI_PROVIDER_API_MODES[0],
      label: t('admin.ai.apiModeChatCompletions'),
    },
    { value: AI_PROVIDER_API_MODES[1], label: t('admin.ai.apiModeResponses') },
  ]
}

export function providerKeyStatus(
  provider: AIProviderDTO | undefined,
  t: TFunction
) {
  if (!provider?.api_key_set) return t('admin.ai.keyUnset')
  return t('admin.ai.keyStatus', {
    yes: t('admin.common.yes').toLowerCase(),
    last4: provider.api_key_last4 ?? t('admin.common.unknown'),
  })
}

export function providerConfigurationStatus(
  provider: AIProviderDTO | undefined,
  t: TFunction
) {
  return t('admin.ai.providerConfigurationStatus', {
    status: providerIsConfigured(provider)
      ? t('admin.ai.providerConfigured')
      : t('admin.ai.providerUnconfigured'),
  })
}

export function providerFormKey(
  scope: ProviderScope,
  provider: AIProviderDTO | undefined,
  projectId: string | undefined
) {
  return [
    scope,
    projectId ?? '',
    provider?.name ?? '',
    provider?.base_url ?? '',
    provider?.model ?? '',
    provider?.api_mode ?? '',
    provider?.temperature ?? '',
    provider?.timeout_ms ?? '',
    provider?.max_output_tokens ?? '',
    provider?.enabled ? 'enabled' : 'disabled',
  ].join(':')
}

function fieldValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

function providerIsConfigured(provider: AIProviderDTO | undefined) {
  return (
    provider?.api_key_set === true &&
    textExists(provider.name) &&
    textExists(provider.base_url) &&
    textExists(provider.model)
  )
}

function textExists(value: string | undefined) {
  return value !== undefined && value.trim().length > 0
}

function optionalNumberField(formData: FormData, key: string) {
  const value = fieldValue(formData, key)
  return value.length > 0 ? Number(value) : undefined
}

function providerApiMode(formData: FormData): AIProviderAPIMode {
  const value = fieldValue(formData, 'api_mode')
  return isAIProviderAPIMode(value) ? value : AI_PROVIDER_API_MODES[0]
}
