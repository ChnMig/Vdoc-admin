import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
    <div className='grid gap-2'>
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
}: {
  readonly id?: string
  readonly label: string
  readonly name: string
  readonly defaultValue: string
  readonly disabled: boolean
}) {
  return (
    <div className='grid gap-2'>
      <Label htmlFor={id ?? name}>{label}</Label>
      <Textarea
        id={id ?? name}
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        className='min-h-28'
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
}: {
  readonly id?: string
  readonly label: string
  readonly value?: string
  readonly options: readonly SelectOption[]
  readonly placeholder: string
  readonly onChange?: (value: string) => void
  readonly name?: string
  readonly disabled?: boolean
}) {
  const controlId = id ?? name ?? label
  return (
    <div className='grid gap-2'>
      <Label htmlFor={controlId}>{label}</Label>
      <select
        id={controlId}
        name={name}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange?.(event.currentTarget.value)}
        className='h-9 rounded-md border border-input bg-background/75 px-3 text-sm shadow-[0_1px_1px_oklch(0_0_0_/_4%)] transition-[background-color,border-color,color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/25'
      >
        <option value=''>{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
