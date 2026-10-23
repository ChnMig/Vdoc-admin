import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

const DateTimePickerContent = lazy(() => import('./date-time-picker-content'))

type DateTimePickerFieldProps = {
  id?: string
  label: string
  name: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  description?: string
  disabled?: boolean
}

// Keep a local date/time string, just like datetime-local. API callers remain
// responsible for converting it to UTC, without shifting the selected day.
export function DateTimePickerField({
  id,
  label,
  name,
  value,
  defaultValue = '',
  onChange,
  description,
  disabled = false,
}: DateTimePickerFieldProps) {
  const { t } = useLanguage()
  const generatedId = useId()
  const controlId = id ?? generatedId
  const [open, setOpen] = useState(false)
  const [internalValue, setInternalValue] = useState(defaultValue)
  const inputRef = useRef<HTMLInputElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const localValue = value ?? internalValue

  useEffect(() => {
    const form = inputRef.current?.form
    const reset = () => setInternalValue(defaultValue)
    form?.addEventListener('reset', reset)
    return () => form?.removeEventListener('reset', reset)
  }, [defaultValue])

  function changeValue(nextValue: string) {
    if (disabled) return
    if (value === undefined) setInternalValue(nextValue)
    onChange?.(nextValue)
    // Shared forms track edits while a submission is pending.
    inputRef.current?.dispatchEvent(new Event('input', { bubbles: true }))
  }

  return (
    <div className='grid min-w-0 content-start gap-2'>
      <Label htmlFor={controlId}>{label}</Label>
      <input
        ref={inputRef}
        type='hidden'
        name={name}
        value={localValue}
        disabled={disabled}
      />
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={controlId}
            type='button'
            variant='outline'
            disabled={disabled}
            aria-describedby={
              description ? `${controlId}-description` : undefined
            }
            data-empty={!localValue}
            className='w-full min-w-0 justify-between bg-background/75 text-start font-normal tabular-nums data-[empty=true]:text-muted-foreground dark:bg-input/25'
          >
            <span className='truncate'>
              {localValue.replace('T', ' ') || t('admin.dateTime.placeholder')}
            </span>
            <CalendarIcon className='size-4 shrink-0 opacity-60' aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          ref={contentRef}
          align='start'
          aria-label={label}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            contentRef.current
              ?.querySelector<HTMLButtonElement>(
                '[data-slot="calendar"] button[tabindex="0"]'
              )
              ?.focus()
          }}
          className='max-h-(--radix-popover-content-available-height) w-[min(20rem,calc(100vw-2rem))] overflow-y-auto p-0'
        >
          {open && !disabled && (
            <Suspense
              fallback={
                <p role='status' className='p-4 text-sm text-muted-foreground'>
                  {t('admin.dateTime.loading')}
                </p>
              }
            >
              <DateTimePickerContent
                controlId={controlId}
                localValue={localValue}
                onChange={changeValue}
                onClose={() => setOpen(false)}
              />
            </Suspense>
          )}
        </PopoverContent>
      </Popover>
      {description && (
        <p
          id={`${controlId}-description`}
          className='text-xs text-muted-foreground'
        >
          {description}
        </p>
      )}
    </div>
  )
}
