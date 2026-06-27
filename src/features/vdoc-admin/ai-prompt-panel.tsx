import type { AIPromptTemplateDTO } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AINativeSelect, AITextAreaField } from './ai-settings-fields'
import type { PromptPanelProps, ProviderScope } from './ai-settings-types'
import { enabledOptions, promptPayload } from './ai-settings-utils'

export function AIPromptPanel({
  scope,
  prompts,
  projectId,
  pending,
  onSave,
}: PromptPanelProps) {
  const { t } = useLanguage()
  const disabled = scope === 'project' && (projectId ?? '').length === 0
  return (
    <section className='grid content-start gap-4 rounded-md border bg-[var(--surface-control)] p-4'>
      <div className='grid gap-1'>
        <h3 className='font-medium'>
          {scope === 'system'
            ? t('admin.ai.systemPromptsTitle')
            : t('admin.ai.projectPromptsTitle')}
        </h3>
        <p className='text-sm text-muted-foreground'>
          {t('admin.ai.promptSettingsDescription')}
        </p>
      </div>
      {prompts.length ? (
        prompts.map((prompt) => (
          <PromptForm
            key={`${scope}-${prompt.prompt_key}`}
            scope={scope}
            prompt={prompt}
            pending={pending || disabled}
            onSave={onSave}
          />
        ))
      ) : (
        <p className='rounded-md border bg-background p-4 text-sm text-muted-foreground'>
          {t('admin.ai.noPrompts')}
        </p>
      )}
    </section>
  )
}

function PromptForm({
  scope,
  prompt,
  pending,
  onSave,
}: {
  readonly scope: ProviderScope
  readonly prompt: AIPromptTemplateDTO
  readonly pending: boolean
  readonly onSave: (promptKey: string, payload: AIPromptTemplateDTO) => void
}) {
  const { t } = useLanguage()
  return (
    <form
      key={`${prompt.prompt_key}-${prompt.system_prompt}-${prompt.user_prompt_template}`}
      className='grid gap-3 rounded-md border bg-background p-4'
      onSubmit={(event) => {
        event.preventDefault()
        onSave(
          prompt.prompt_key,
          promptPayload(prompt.prompt_key, new FormData(event.currentTarget))
        )
      }}
    >
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <Badge variant='outline'>{prompt.prompt_key}</Badge>
        <Badge variant={prompt.enabled ? 'outline' : 'secondary'}>
          {prompt.enabled
            ? t('admin.statuses.enabled')
            : t('admin.statuses.disabled')}
        </Badge>
      </div>
      <AITextAreaField
        id={`${scope}-${prompt.prompt_key}-system-prompt`}
        label={t('admin.ai.systemPrompt')}
        name='system_prompt'
        defaultValue={prompt.system_prompt}
        disabled={pending}
      />
      <AITextAreaField
        id={`${scope}-${prompt.prompt_key}-user-prompt-template`}
        label={t('admin.ai.userPromptTemplate')}
        name='user_prompt_template'
        defaultValue={prompt.user_prompt_template}
        disabled={pending}
      />
      <AINativeSelect
        id={`${scope}-${prompt.prompt_key}-enabled`}
        label={t('admin.ai.enabled')}
        name='enabled'
        value={prompt.enabled ? 'true' : 'false'}
        disabled={pending}
        placeholder={t('admin.statuses.enabled')}
        options={enabledOptions(t)}
      />
      <Button
        type='submit'
        disabled={pending}
        aria-label={
          scope === 'system'
            ? t('admin.ai.saveSystemPrompt', { prompt: prompt.prompt_key })
            : t('admin.ai.saveProjectPrompt', { prompt: prompt.prompt_key })
        }
      >
        {t('admin.ai.savePrompt')}
      </Button>
    </form>
  )
}
