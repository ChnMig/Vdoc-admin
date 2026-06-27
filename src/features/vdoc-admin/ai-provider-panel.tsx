import { useLanguage } from '@/context/language-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AITextField, AINativeSelect } from './ai-settings-fields'
import type { ProviderPanelProps } from './ai-settings-types'
import {
  enabledOptions,
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
}: ProviderPanelProps) {
  const { t } = useLanguage()
  const disabled = scope === 'project' && (projectId ?? '').length === 0
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
      <p className='text-sm text-muted-foreground'>
        {providerKeyStatus(provider, t)}
      </p>
      <form
        key={providerFormKey(scope, provider, projectId)}
        className='grid gap-4'
        onSubmit={(event) => {
          event.preventDefault()
          onSave(providerPayload(new FormData(event.currentTarget)))
        }}
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
          <AITextField
            id={`${scope}-ai-provider-api-mode`}
            label={t('admin.ai.apiMode')}
            name='api_mode'
            defaultValue={provider?.api_mode ?? ''}
            disabled={disabled}
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
      {testResult && (
        <p className='rounded-md border bg-[var(--surface-control)] p-3 text-sm text-muted-foreground'>
          {t('admin.ai.providerTestResult')}: {testResult}
        </p>
      )}
    </section>
  )
}
