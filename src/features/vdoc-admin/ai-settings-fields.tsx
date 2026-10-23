import { withNativeSelectPlaceholder } from '@/lib/native-select-options'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { OptionsSelect } from '@/components/options-select'
import type { SelectOption } from './ai-settings-types'

export function AITextField({
  id,
  label,
  name,
  type = 'text',
  defaultValue,
  disabled = false,
  required = false,
  placeholder,
}: {
  readonly id?: string
  readonly label: string
  readonly name: string
  readonly type?: string
  readonly defaultValue: string
  readonly disabled?: boolean
  readonly required?: boolean
  readonly placeholder?: string
}) {
  return (
    <div className='grid min-w-0 gap-2'>
      <Label htmlFor={id ?? name}>{label}</Label>
      <Input
        id={id ?? name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
      />
    </div>
  )
}

export function AITextAreaField({
  id,
  label,
  name,
  defaultValue,
  disabled,
  required = false,
  rows = 8,
}: {
  readonly id?: string
  readonly label: string
  readonly name: string
  readonly defaultValue: string
  readonly disabled: boolean
  readonly required?: boolean
  readonly rows?: number
}) {
  return (
    <div className='grid min-w-0 gap-2'>
      <Label htmlFor={id ?? name}>{label}</Label>
      <Textarea
        id={id ?? name}
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        required={required}
        rows={rows}
        className='field-sizing-fixed min-h-28 resize-y'
      />
    </div>
  )
}

export function AINumberField({
  id,
  label,
  name,
  defaultValue,
  disabled = false,
  min,
  max,
  step,
}: {
  readonly id?: string
  readonly label: string
  readonly name: string
  readonly defaultValue: number
  readonly disabled?: boolean
  readonly min: number
  readonly max: number
  readonly step: number
}) {
  return (
    <div className='grid min-w-0 gap-2'>
      <Label htmlFor={id ?? name}>{label}</Label>
      <Input
        id={id ?? name}
        name={name}
        type='number'
        defaultValue={defaultValue}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
      />
    </div>
  )
}

export function AINativeSelect({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
  name,
  disabled = false,
  required = false,
}: {
  readonly id?: string
  readonly label: string
  readonly value?: string
  readonly options: readonly SelectOption[]
  readonly placeholder: string
  readonly onChange?: (value: string) => void
  readonly name?: string
  readonly disabled?: boolean
  readonly required?: boolean
}) {
  const controlId = id ?? name ?? label
  const selectOptions = withNativeSelectPlaceholder(options, placeholder)
  const selectionProps = onChange
    ? { value, onChange }
    : { defaultValue: value }
  return (
    <div className='grid min-w-0 gap-2'>
      <Label htmlFor={controlId}>{label}</Label>
      <OptionsSelect
        id={controlId}
        name={name}
        disabled={disabled}
        required={required}
        options={selectOptions}
        placeholder={placeholder}
        {...selectionProps}
      />
    </div>
  )
}
