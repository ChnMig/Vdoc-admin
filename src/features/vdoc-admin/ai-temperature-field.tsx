import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { AI_PROVIDER_DEFAULT_TUNING } from './ai-settings-types'

export function AITemperatureField({
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
  const [value, setValue] = useState(defaultValue)
  return (
    <div className='grid min-w-0 content-start gap-2'>
      <div className='flex items-center justify-between gap-2'>
        <Label htmlFor={id}>{t('admin.ai.temperature')}</Label>
        <div className='flex items-center gap-2'>
          <output htmlFor={id} className='text-sm tabular-nums'>
            {value}
          </output>
          <Button
            type='button'
            size='icon'
            variant='ghost'
            className='size-6 text-muted-foreground'
            disabled={
              disabled || value === AI_PROVIDER_DEFAULT_TUNING.temperature
            }
            aria-label={t('admin.ai.resetTemperature')}
            onClick={() => {
              setValue(AI_PROVIDER_DEFAULT_TUNING.temperature)
              onChange?.()
            }}
          >
            <RotateCcw className='size-3.5' aria-hidden />
          </Button>
        </div>
      </div>
      <input
        id={id}
        name='temperature'
        type='range'
        min={0}
        max={2}
        step={0.1}
        value={value}
        disabled={disabled}
        aria-describedby={`${id}-help`}
        className='ai-temperature-slider'
        onChange={(event) => setValue(Number(event.target.value))}
      />
      <p id={`${id}-help`} className='text-xs leading-5 text-muted-foreground'>
        {t('admin.ai.temperatureHint')}
      </p>
    </div>
  )
}
