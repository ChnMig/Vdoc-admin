import { useState } from 'react'
import { useLanguage } from '@/context/language-provider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export function AITimeoutField({
  id,
  name,
  label,
  hint,
  defaultValue,
  fallbackValue,
  disabled,
  onChange,
}: {
  id: string
  name: string
  label: string
  hint: string
  defaultValue: number
  fallbackValue: number
  disabled: boolean
  onChange?: () => void
}) {
  const { t } = useLanguage()
  const [unlimited, setUnlimited] = useState(defaultValue === 0)
  const [value, setValue] = useState(
    String(defaultValue === 0 ? fallbackValue : defaultValue)
  )

  return (
    <div className='grid min-w-0 content-start gap-2'>
      <Label htmlFor={id} className='min-h-6'>
        {label}
      </Label>
      <Input
        id={id}
        name={unlimited ? undefined : name}
        type='number'
        value={unlimited ? '' : value}
        placeholder={unlimited ? t('admin.ai.unlimitedTimeout') : undefined}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled || unlimited}
        required={!unlimited}
        min={1000}
        max={2147483647}
        step={1}
        aria-describedby={`${id}-help`}
      />
      {unlimited && <input type='hidden' name={name} value='0' />}
      <div className='flex min-h-8 items-center gap-2'>
        <Switch
          id={`${id}-unlimited`}
          checked={unlimited}
          disabled={disabled}
          onCheckedChange={(checked) => {
            setUnlimited(checked)
            onChange?.()
          }}
          aria-describedby={`${id}-help`}
        />
        <Label htmlFor={`${id}-unlimited`}>
          {t('admin.ai.unlimitedTimeout')}
        </Label>
      </div>
      <p id={`${id}-help`} className='text-xs leading-5 text-muted-foreground'>
        {hint}
      </p>
    </div>
  )
}
