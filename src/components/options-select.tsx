import { useEffect, useId, useRef, useState, type ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/context/language-provider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type SelectOption = {
  readonly value: string
  readonly label: string
  readonly disabled?: boolean
}

type OptionsSelectProps = Pick<
  ComponentProps<typeof SelectTrigger>,
  'id' | 'className' | 'aria-label' | 'aria-describedby' | 'aria-invalid'
> & {
  readonly name?: string
  readonly value?: string
  readonly defaultValue?: string
  readonly options: readonly SelectOption[]
  readonly placeholder?: string
  readonly disabled?: boolean
  readonly required?: boolean
  readonly fallbackToFirstOption?: boolean
  readonly onChange?: (value: string) => void
}

export function OptionsSelect({
  name,
  value,
  defaultValue,
  options,
  placeholder,
  disabled = false,
  required = false,
  fallbackToFirstOption = true,
  onChange,
  className,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  ...triggerProps
}: OptionsSelectProps) {
  const { t } = useLanguage()
  const initialValue = defaultValue ?? options[0]?.value ?? ''
  const [localValue, setLocalValue] = useState(initialValue)
  const [invalidSelection, setInvalidSelection] = useState(false)
  const errorId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const requestedValue = value ?? localValue
  const selectedValue = options.some(
    (option) => option.value === requestedValue
  )
    ? requestedValue
    : fallbackToFirstOption
      ? (options[0]?.value ?? '')
      : ''
  const validationMessage =
    invalidSelection && required && !disabled && selectedValue === ''
      ? t('common.selectRequired')
      : ''

  useEffect(() => {
    const form = triggerRef.current?.closest('form')
    if (!form) return
    const reset = () => {
      if (value === undefined) setLocalValue(initialValue)
      setInvalidSelection(false)
    }
    form.addEventListener('reset', reset)
    return () => form.removeEventListener('reset', reset)
  }, [initialValue, value])

  return (
    <div
      className='contents'
      onInvalid={(event) => {
        const control = event.target as HTMLSelectElement
        event.preventDefault()
        setInvalidSelection(true)
        const firstInvalid = Array.from(control.form?.elements ?? []).find(
          (element) =>
            (element instanceof HTMLInputElement ||
              element instanceof HTMLSelectElement ||
              element instanceof HTMLTextAreaElement) &&
            element.willValidate &&
            !element.validity.valid
        )
        if (!firstInvalid || firstInvalid === control) {
          triggerRef.current?.focus()
        }
      }}
    >
      <Select
        name={name}
        value={selectedValue}
        disabled={disabled}
        required={required}
        onValueChange={(nextValue) => {
          if (value === undefined) setLocalValue(nextValue)
          setInvalidSelection(false)
          onChange?.(nextValue)
        }}
      >
        <SelectTrigger
          ref={triggerRef}
          name={name}
          value={selectedValue}
          aria-invalid={validationMessage ? true : ariaInvalid}
          aria-describedby={
            [describedBy, validationMessage ? errorId : undefined]
              .filter(Boolean)
              .join(' ') || undefined
          }
          className={cn(
            'w-full min-w-0 bg-background/75 text-start shadow-[0_1px_1px_oklch(0_0_0_/_4%)] dark:bg-input/25 [&_[data-slot=select-value]]:block [&_[data-slot=select-value]]:truncate',
            className
          )}
          {...triggerProps}
        >
          <SelectValue
            placeholder={
              options.find((option) => option.value === '')?.label ??
              placeholder
            }
          >
            {options.find((option) => option.value === selectedValue)?.label}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className='w-(--radix-select-trigger-width) max-w-[calc(100vw-2rem)]'>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              data-value={option.value}
              disabled={option.disabled || (required && option.value === '')}
              className='min-w-0 [&>span:last-child]:min-w-0'
            >
              <span className='min-w-0 [overflow-wrap:anywhere] whitespace-normal'>
                {option.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {validationMessage && (
        <p id={errorId} role='alert' className='text-sm text-destructive'>
          {validationMessage}
        </p>
      )}
    </div>
  )
}
