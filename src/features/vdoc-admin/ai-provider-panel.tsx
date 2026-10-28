import { useRef, useState } from 'react'
import { useLanguage } from '@/context/language-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AIAPIKeyField } from './ai-api-key-field'
import { AIModelField } from './ai-model-field'
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
  providerPayloadIsBlank,
} from './ai-settings-utils'
import { AITemperatureField } from './ai-temperature-field'
import { AITimeoutField } from './ai-timeout-field'

export function AIProviderPanel({
  scope,
  provider,
  projectId,
  readOnly = false,
  pending,
  testing,
  testResult,
  onSave,
  onTest,
  onTestPayloadChange,
}: ProviderPanelProps) {
  const { t } = useLanguage()
  const saveLockedRef = useRef(false)
  const testLockedRef = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [formRevision, setFormRevision] = useState(0)
  const formKey = `${providerFormKey(scope, provider, projectId)}:${formRevision}`
  const disabled =
    readOnly || (scope === 'project' && (projectId ?? '').length === 0)
  const tuning = {
    temperature:
      provider?.temperature ?? AI_PROVIDER_DEFAULT_TUNING.temperature,
    maxOutputTokens:
      provider?.max_output_tokens ??
      AI_PROVIDER_DEFAULT_TUNING.max_output_tokens,
  }
  return (
    <section className='@container/provider-panel grid min-w-0 gap-5 rounded-lg border bg-card p-5'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='grid gap-1'>
          <h3 className='font-medium'>
            {scope === 'system'
              ? t('admin.ai.systemProviderTitle')
              : t('admin.ai.projectProviderTitle')}
          </h3>
          <p className='max-w-3xl text-sm leading-6 text-muted-foreground'>
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
      <div className='grid min-w-0 gap-3 border-y py-4 text-sm text-muted-foreground @2xl/provider-panel:grid-cols-3 @2xl/provider-panel:divide-x'>
        <p className='min-w-0 break-words @2xl/provider-panel:pe-4'>
          {providerConfigurationStatus(provider, t, scope)}
        </p>
        <p className='min-w-0 break-words @2xl/provider-panel:px-4'>
          {providerKeyStatus(provider, t)}
        </p>
        <p className='min-w-0 break-words @2xl/provider-panel:ps-4'>
          {t('admin.ai.providerTestStatus', {
            status: providerTestStatusLabel(testResult.status, t),
          })}
        </p>
      </div>
      <form
        ref={formRef}
        key={formKey}
        className='grid gap-4'
        onSubmit={(event) => {
          event.preventDefault()
          if (saveLockedRef.current) return
          saveLockedRef.current = true
          const submittedForm = event.currentTarget
          void onSave(providerPayload(new FormData(submittedForm)))
            .then(() => {
              if (formRef.current === submittedForm) {
                setFormRevision((revision) => revision + 1)
              }
            })
            .catch(() => undefined)
            .finally(() => {
              saveLockedRef.current = false
            })
        }}
        onChange={onTestPayloadChange}
      >
        <div className='grid min-w-0 items-start gap-4 @xl/provider-panel:grid-cols-2'>
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
          <AIAPIKeyField
            key={`${formKey}:key`}
            id={`${scope}-ai-provider-api-key`}
            scope={scope}
            projectId={projectId}
            saved={provider?.api_key_set ?? false}
            disabled={disabled}
            onChange={onTestPayloadChange}
          />
          <AINativeSelect
            id={`${scope}-ai-provider-api-mode`}
            label={t('admin.ai.apiMode')}
            name='api_mode'
            value={provider?.api_mode ?? 'responses'}
            disabled={disabled}
            placeholder={t('admin.ai.apiModePlaceholder')}
            options={providerApiModeOptions(t)}
            required
          />
          <AIModelField
            key={`${formKey}:model`}
            id={`${scope}-ai-provider-model`}
            scope={scope}
            projectId={projectId}
            formRef={formRef}
            defaultValue={provider?.model ?? ''}
            disabled={disabled}
            onModelChange={onTestPayloadChange}
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
          <AINativeSelect
            id={`${scope}-ai-provider-stream`}
            label={t('admin.ai.responseMode')}
            name='stream'
            value={String(provider?.stream ?? true)}
            disabled={disabled}
            placeholder={t('admin.ai.streaming')}
            options={[
              { value: 'true', label: t('admin.ai.streaming') },
              { value: 'false', label: t('admin.ai.nonStreaming') },
            ]}
          />
          <p className='self-center text-sm leading-6 text-muted-foreground'>
            {t('admin.ai.responseModeDescription')}
          </p>
        </div>
        <fieldset className='grid min-w-0 gap-4 border-t pt-4 @xl/provider-panel:grid-cols-2'>
          <legend className='pe-3 text-sm font-medium'>
            {t('admin.ai.tuningTitle')}
          </legend>
          <AITemperatureField
            key={`${formKey}:temperature`}
            id={`${scope}-ai-provider-temperature`}
            defaultValue={tuning.temperature}
            disabled={disabled}
            onChange={onTestPayloadChange}
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
        </fieldset>
        <fieldset className='grid min-w-0 gap-4 border-t pt-4 @xl/provider-panel:grid-cols-3'>
          <legend className='pe-3 text-sm font-medium'>
            {t('admin.ai.timeoutSettings')}
          </legend>
          <p className='text-sm leading-6 text-muted-foreground @xl/provider-panel:col-span-3'>
            {t('admin.ai.timeoutSettingsHint')}
          </p>
          {(
            [
              ['timeout_ms', 'timeoutMs', 'totalTimeoutHint'],
              [
                'first_response_timeout_ms',
                'firstResponseTimeoutMs',
                'firstResponseTimeoutHint',
              ],
              ['idle_timeout_ms', 'idleTimeoutMs', 'idleTimeoutHint'],
            ] as const
          ).map(([name, label, hint]) => (
            <AITimeoutField
              key={`${formKey}:${name}`}
              id={`${scope}-ai-provider-${name.replace(/_/g, '-')}`}
              name={name}
              label={t(`admin.ai.${label}`)}
              hint={t(`admin.ai.${hint}`)}
              defaultValue={
                provider?.[name] ?? AI_PROVIDER_DEFAULT_TUNING[name]
              }
              fallbackValue={AI_PROVIDER_DEFAULT_TUNING[name]}
              disabled={disabled}
              onChange={onTestPayloadChange}
            />
          ))}
        </fieldset>
        <div className='flex flex-wrap gap-2 border-t pt-4'>
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
              if (testLockedRef.current) return
              const form = event.currentTarget.form
              if (!form) return
              const payload = providerPayload(new FormData(form))
              if (
                scope === 'project' &&
                !provider?.api_key_set &&
                providerPayloadIsBlank(payload)
              ) {
                testLockedRef.current = true
                void onTest()
                  .catch(() => undefined)
                  .finally(() => {
                    testLockedRef.current = false
                  })
                return
              }
              if (!form.reportValidity()) return
              testLockedRef.current = true
              void onTest(payload)
                .catch(() => undefined)
                .finally(() => {
                  testLockedRef.current = false
                })
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
          role={testResult.status === 'error' ? 'alert' : 'status'}
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
