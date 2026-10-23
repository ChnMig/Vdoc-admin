import { useEffect, useRef, type ChangeEvent } from 'react'
import { type DropdownProps } from 'react-day-picker'
import { enUS } from 'react-day-picker/locale/en-US'
import { zhCN } from 'react-day-picker/locale/zh-CN'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const twoDigits = (value: number) => String(value).padStart(2, '0')
const hours = Array.from({ length: 24 }, (_, hour) => twoDigits(hour))
const minutes = Array.from({ length: 60 }, (_, minute) => twoDigits(minute))

function CalendarDropdown({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  disabled,
}: DropdownProps) {
  return (
    <Select
      value={String(value)}
      disabled={disabled}
      onValueChange={(nextValue) =>
        onChange?.({
          target: { value: nextValue },
        } as ChangeEvent<HTMLSelectElement>)
      }
    >
      <SelectTrigger aria-label={ariaLabel} size='sm' className='gap-1 px-2'>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options?.map((option) => (
          <SelectItem
            key={option.value}
            value={String(option.value)}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default function DateTimePickerContent({
  controlId,
  localValue,
  onChange: changeValue,
  onClose,
}: {
  controlId: string
  localValue: string
  onChange: (value: string) => void
  onClose: () => void
}) {
  const { language, t } = useLanguage()
  const contentRef = useRef<HTMLDivElement>(null)
  const dateParts = localValue.slice(0, 10).split('-').map(Number)
  const selected = localValue
    ? new Date(dateParts[0], dateParts[1] - 1, dateParts[2])
    : undefined
  const hour = localValue.slice(11, 13) || '00'
  const minute = localValue.slice(14, 16) || '00'

  useEffect(() => {
    contentRef.current
      ?.querySelector<HTMLButtonElement>(
        '[data-slot="calendar"] button[tabindex="0"]'
      )
      ?.focus()
  }, [])

  return (
    <div ref={contentRef}>
      <Calendar
        mode='single'
        required
        selected={selected}
        defaultMonth={selected}
        onSelect={(date) => {
          if (!date) return
          changeValue(
            `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}T${hour}:${minute}`
          )
        }}
        captionLayout='dropdown'
        startMonth={new Date(1900, 0)}
        endMonth={new Date(new Date().getFullYear() + 100, 11)}
        locale={language === 'zh-CN' ? zhCN : enUS}
        labels={{
          labelMonthDropdown: () => t('admin.dateTime.month'),
          labelYearDropdown: () => t('admin.dateTime.year'),
        }}
        formatters={{
          formatMonthDropdown: (date) =>
            date.toLocaleString(language, { month: 'short' }),
        }}
        autoFocus
        components={{ Dropdown: CalendarDropdown }}
        className='w-full [--cell-size:--spacing(9)] [&_.rdp-nav]:pointer-events-none [&_.rdp-nav>button]:pointer-events-auto'
      />
      <div className='grid gap-3 border-t p-3'>
        <div className='grid grid-cols-2 gap-3'>
          {[
            { key: 'hour', selected: hour, options: hours },
            { key: 'minute', selected: minute, options: minutes },
          ].map((part) => (
            <div key={part.key} className='grid gap-1.5'>
              <Label htmlFor={`${controlId}-${part.key}`}>
                {part.key === 'hour'
                  ? t('admin.dateTime.hour')
                  : t('admin.dateTime.minute')}
              </Label>
              <Select
                value={part.selected}
                disabled={!localValue}
                onValueChange={(nextValue) =>
                  changeValue(
                    `${localValue.slice(0, 10)}T${part.key === 'hour' ? nextValue : hour}:${part.key === 'minute' ? nextValue : minute}`
                  )
                }
              >
                <SelectTrigger
                  id={`${controlId}-${part.key}`}
                  className='w-full tabular-nums'
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {part.options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <div className='flex items-center justify-between gap-2'>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            disabled={!localValue}
            onClick={() => {
              changeValue('')
              onClose()
            }}
          >
            {t('admin.common.clear')}
          </Button>
          <Button type='button' size='sm' onClick={() => onClose()}>
            {t('admin.dateTime.done')}
          </Button>
        </div>
      </div>
    </div>
  )
}
