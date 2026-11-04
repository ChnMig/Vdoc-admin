import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { LanguageProvider } from '@/context/language-provider'
import { AIOutputTokensField } from './ai-output-tokens-field'

it('submits zero without losing the custom value when toggling no limit', async () => {
  const user = userEvent.setup()
  const screen = render(
    <LanguageProvider>
      <form>
        <AIOutputTokensField id='output' defaultValue={1000} disabled={false} />
      </form>
    </LanguageProvider>
  )
  const form = screen.container.querySelector('form')!
  const input = screen.getByRole('spinbutton', { name: 'Max output tokens' })
  const unlimited = screen.getByRole('switch', {
    name: 'Max output tokens · No limit',
  })
  await user.clear(input)
  await user.type(input, '8192')
  await user.click(unlimited)
  expect(input).toBeDisabled()
  expect(new FormData(form).get('max_output_tokens')).toBe('0')
  await user.click(unlimited)
  expect(input).toBeEnabled()
  expect(input).toHaveValue(8192)
  expect(new FormData(form).get('max_output_tokens')).toBe('8192')
})

it('restores a saved no-limit setting and respects read-only access', () => {
  const screen = render(
    <LanguageProvider>
      <form>
        <AIOutputTokensField id='output' defaultValue={0} disabled />
      </form>
    </LanguageProvider>
  )
  expect(screen.getByRole('switch')).toBeChecked()
  expect(screen.getByRole('switch')).toBeDisabled()
  expect(screen.getByRole('spinbutton')).toBeDisabled()
  expect(
    new FormData(screen.container.querySelector('form')!).get(
      'max_output_tokens'
    )
  ).toBe('0')
})
