import { fireEvent, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { LanguageProvider } from '@/context/language-provider'
import { AITimeoutField } from './ai-timeout-field'

describe('AI timeout controls', () => {
  it('submits zero for unlimited and restores the custom finite duration', async () => {
    const user = userEvent.setup()
    const screen = render(
      <LanguageProvider>
        <form aria-label='Provider'>
          <AITimeoutField
            id='total'
            name='timeout_ms'
            label='Total time'
            hint='Request time limit'
            defaultValue={900000}
            fallbackValue={600000}
            disabled={false}
          />
        </form>
      </LanguageProvider>
    )
    const form = screen.getByRole('form', {
      name: 'Provider',
    }) as HTMLFormElement
    const input = screen.getByLabelText('Total time')
    fireEvent.change(input, { target: { value: '1200000' } })
    expect(new FormData(form).get('timeout_ms')).toBe('1200000')
    await user.click(screen.getByRole('switch'))
    expect(input).toBeDisabled()
    expect(new FormData(form).get('timeout_ms')).toBe('0')
    await user.click(screen.getByRole('switch'))
    expect(input).toBeEnabled()
    expect(input).toHaveValue(1200000)
    expect(new FormData(form).getAll('timeout_ms')).toEqual(['1200000'])
  })

  it('loads an unlimited value without replacing it with a finite default', () => {
    const screen = render(
      <LanguageProvider>
        <form aria-label='Provider'>
          <AITimeoutField
            id='idle'
            name='idle_timeout_ms'
            label='Idle time'
            hint='Response gap'
            defaultValue={0}
            fallbackValue={120000}
            disabled={false}
          />
        </form>
      </LanguageProvider>
    )
    expect(screen.getByRole('switch')).toBeChecked()
    expect(
      new FormData(screen.getByRole('form') as HTMLFormElement).get(
        'idle_timeout_ms'
      )
    ).toBe('0')
  })
})
