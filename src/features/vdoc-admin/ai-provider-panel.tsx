import { AI_PROVIDER_API_MODES } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AINumberField,
  AITextField,
  AINativeSelect,
} from './ai-settings-fields'
import {
  AI_PROVIDER_DEFAULT_TUNING,
  type ProviderPanelProps,
} from './ai-settings-types'
import {
  enabledOptions,
  providerApiModeOptions,
  providerConfigurationStatus,
  providerFormKey,
  providerKeyStatus,
  providerPayload,
} from './ai-settings-utils'

export function AIProviderPanel({
  scope,
  provider,
  projectId,
  pending,
  testing,
  testResult,
  onSave,
  onTest,
  onTestPayloadChange,
}: ProviderPanelProps) {
  const { t } = useLanguage()
  const disabled = scope === 'project' && (projectId ?? '').length === 0
  const tuning = {
    temperature:
      provider?.temperature ?? AI_PROVIDER_DEFAULT_TUNING.temperature,
    timeoutMs: provider?.timeout_ms ?? AI_PROVIDER_DEFAULT_TUNING.timeout_ms,
    maxOutputTokens:
      provider?.max_output_tokens ??
      AI_PROVIDER_DEFAULT_TUNING.max_output_tokens,
  }
  return (
    <section className='grid gap-4 rounded-md border bg-background p-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='grid gap-1'>
          <h3 className='font-medium'>
            {scope === 'system'
              ? t('admin.ai.systemProviderTitle')
              : t('admin.ai.projectProviderTitle')}
          </h3>
          <p className='text-sm text-muted-foreground'>
            {scope === 'system'
              ? t('admin.ai.systemProviderDescription')
              : t('admin.ai.projectProviderDescription')}
          </p>
        </div>
        <Badge variant={provider?.enabled ? 'outline' : 'secondary'}>
          {provider?.enabled
            ? t('admin.statuses.enabled')
            : t('admin.statuses.disabled')}
        </Badge>
      </div>
      <div className='grid gap-2 rounded-md border bg-[var(--surface-control)] p-3 text-sm text-muted-foreground'>
        <p>{providerConfigurationStatus(provider, t)}</p>
        <p>{providerKeyStatus(provider, t)}</p>
        <p>
          {t('admin.ai.providerTestStatus', {
            status: providerTestStatusLabel(testResult.status, t),
          })}
        </p>
      </div>
      <form
        key={providerFormKey(scope, provider, projectId)}
        className='grid gap-4'
        onSubmit={(event) => {
          event.preventDefault()
          onSave(providerPayload(new FormData(event.currentTarget)))
        }}
        onChange={onTestPayloadChange}
      >
        <div className='grid gap-4 md:grid-cols-2'>
          <AITextField
            id={`${scope}-ai-provider-name`}
            label={t('admin.ai.providerName')}
            name='name'
            defaultValue={provider?.name ?? ''}
            disabled={disabled}
            required
          />
          <AITextField
            id={`${scope}-ai-provider-base-url`}
            label={t('admin.ai.baseUrl')}
            name='base_url'
            defaultValue={provider?.base_url ?? ''}
            disabled={disabled}
            required
          />
          <AITextField
            id={`${scope}-ai-provider-model`}
            label={t('admin.ai.model')}
            name='model'
            defaultValue={provider?.model ?? ''}
            disabled={disabled}
            required
          />
          <AINativeSelect
            id={`${scope}-ai-provider-api-mode`}
            label={t('admin.ai.apiMode')}
            name='api_mode'
            value={provider?.api_mode ?? AI_PROVIDER_API_MODES[0]}
            disabled={disabled}
            placeholder={t('admin.ai.apiModePlaceholder')}
            options={providerApiModeOptions(t)}
            required
          />
          <AITextField
            id={`${scope}-ai-provider-api-key`}
            label={
              scope === 'system'
                ? t('admin.ai.systemApiKey')
                : t('admin.ai.projectApiKey')
            }
            name='api_key'
            type='password'
            defaultValue=''
            disabled={disabled}
            placeholder={t('admin.ai.apiKeyPlaceholder')}
          />
          <AINativeSelect
            id={`${scope}-ai-provider-enabled`}
            label={t('admin.ai.enabled')}
            name='enabled'
            value={provider?.enabled ? 'true' : 'false'}
            disabled={disabled}
            placeholder={t('admin.statuses.enabled')}
            options={enabledOptions(t)}
          />
          <AINumberField
            id={`${scope}-ai-provider-temperature`}
            label={t('admin.ai.temperature')}
            name='temperature'
            defaultValue={tuning.temperature}
            disabled={disabled}
            min={0}
            max={2}
            step={0.1}
          />
          <AINumberField
            id={`${scope}-ai-provider-timeout-ms`}
            label={t('admin.ai.timeoutMs')}
            name='timeout_ms'
            defaultValue={tuning.timeoutMs}
            disabled={disabled}
            min={1000}
            max={120000}
            step={1000}
          />
          <AINumberField
            id={`${scope}-ai-provider-max-output-tokens`}
            label={t('admin.ai.maxOutputTokens')}
            name='max_output_tokens'
            defaultValue={tuning.maxOutputTokens}
            disabled={disabled}
            min={1}
            max={32000}
            step={1}
          />
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button type='submit' disabled={disabled || pending}>
            {scope === 'system'
              ? t('admin.ai.saveSystemProvider')
              : t('admin.ai.saveProjectProvider')}
          </Button>
          <Button
            type='button'
            variant='outline'
            disabled={disabled || testing}
            onClick={(event) => {
              const form = event.currentTarget.form
              if (form) onTest(providerPayload(new FormData(form)))
            }}
          >
            {scope === 'system'
              ? t('admin.ai.testSystemProvider')
              : t('admin.ai.testProjectProvider')}
          </Button>
        </div>
      </form>
      {testResult.message && (
        <p
          className={
            testResult.status === 'error'
              ? 'rounded-md border border-destructive/30 bg-[var(--surface-control)] p-3 text-sm text-destructive'
              : 'rounded-md border bg-[var(--surface-control)] p-3 text-sm text-muted-foreground'
          }
        >
          {testResult.message}
        </p>
      )}
    </section>
  )
}

function providerTestStatusLabel(
  status: ProviderPanelProps['testResult']['status'],
  t: ReturnType<typeof useLanguage>['t']
) {
  if (status === 'success') return t('admin.ai.providerTestSuccess')
  if (status === 'error') return t('admin.ai.providerTestError')
  return t('admin.ai.providerTestIdle')
}
