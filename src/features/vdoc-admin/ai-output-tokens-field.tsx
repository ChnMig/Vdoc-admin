import { useState } from 'react'
import { useLanguage } from '@/context/language-provider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { AI_PROVIDER_DEFAULT_TUNING } from './ai-settings-types'

export function AIOutputTokensField({
  id,
  defaultValue,
  disabled,
  onChange,
}: {
  id: string
  defaultValue: number
  disabled: boolean
  onChange?: () => void
}) {
  const { t } = useLanguage()
  const [unlimited, setUnlimited] = useState(defaultValue === 0)
  const [value, setValue] = useState(
    String(
      defaultValue === 0
        ? AI_PROVIDER_DEFAULT_TUNING.max_output_tokens
        : defaultValue
    )
  )
  return (
    <div className='grid min-w-0 content-start gap-2'>
      <Label htmlFor={id} className='min-h-6'>
        {t('admin.ai.maxOutputTokens')}
      </Label>
      <Input
        id={id}
        name={unlimited ? undefined : 'max_output_tokens'}
        type='number'
        value={unlimited ? '' : value}
        placeholder={
          unlimited ? t('admin.ai.unlimitedOutputTokens') : undefined
        }
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled || unlimited}
        required={!unlimited}
        min={1}
        max={32000}
        step={1}
        aria-describedby={`${id}-help`}
      />
      {unlimited && <input type='hidden' name='max_output_tokens' value='0' />}
      <div className='flex min-h-8 items-center gap-2'>
        <Switch
          id={`${id}-unlimited`}
          checked={unlimited}
          disabled={disabled}
          aria-label={`${t('admin.ai.maxOutputTokens')} · ${t('admin.ai.unlimitedOutputTokens')}`}
          aria-describedby={`${id}-help`}
          onCheckedChange={(checked) => {
            setUnlimited(checked)
            onChange?.()
          }}
        />
        <Label htmlFor={`${id}-unlimited`}>
          {t('admin.ai.unlimitedOutputTokens')}
        </Label>
      </div>
      <p id={`${id}-help`} className='text-xs leading-5 text-muted-foreground'>
        {t('admin.ai.maxOutputTokensHint')}
      </p>
    </div>
  )
}
