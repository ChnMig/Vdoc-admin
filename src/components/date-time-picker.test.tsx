import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DateTimePickerField } from './date-time-picker'

describe('DateTimePickerField form behavior', () => {
  it('keeps local time when selecting a date, tracks edits, clears, and resets', async () => {
    const user = userEvent.setup()
    const input = vi.fn()
    const submit = vi.fn((event) => event.preventDefault())
    const view = render(
      <form onInputCapture={input} onSubmit={submit}>
        <DateTimePickerField
          label='Expiry'
          name='expires_at'
          defaultValue='2099-01-15T18:30'
        />
        <button type='reset'>Reset</button>
      </form>
    )
    const form = view.container.querySelector('form')!
    const trigger = screen.getByRole('button', { name: 'Expiry' })
    await user.click(trigger)
    const picker = screen.getByRole('dialog', { name: 'Expiry' })
    await user.click(
      await within(picker).findByRole(
        'button',
        { name: /January 16.*, 2099/ },
        { timeout: 5000 }
      )
    )
    expect(new FormData(form).get('expires_at')).toBe('2099-01-16T18:30')
    expect(input).toHaveBeenCalled()
    expect(submit).not.toHaveBeenCalled()
    await user.click(within(picker).getByRole('button', { name: 'Clear' }))
    expect(new FormData(form).get('expires_at')).toBe('')
    expect(trigger).toHaveTextContent('Choose date and time')
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(new FormData(form).get('expires_at')).toBe('2099-01-15T18:30')
    expect(trigger).toHaveTextContent('2099-01-15 18:30')
  })

  it('closes an open picker when disabled and excludes its value from submission', async () => {
    const user = userEvent.setup()
    const renderField = (disabled = false) => (
      <form>
        <DateTimePickerField
          label='Expiry'
          name='expires_at'
          defaultValue='2099-01-15T18:30'
          disabled={disabled}
        />
      </form>
    )
    const view = render(renderField())
    await user.click(screen.getByRole('button', { name: 'Expiry' }))
    expect(screen.getByRole('dialog', { name: 'Expiry' })).toBeVisible()
    view.rerender(renderField(true))
    expect(screen.queryByRole('dialog', { name: 'Expiry' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Expiry' })).toBeDisabled()
    expect(
      new FormData(view.container.querySelector('form')!).has('expires_at')
    ).toBe(false)
  })
})
