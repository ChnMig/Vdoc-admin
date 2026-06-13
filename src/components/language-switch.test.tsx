import { clearCookies } from '@/test-utils/cookies'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LANGUAGE_COOKIE_NAME } from '@/lib/i18n'
import { LanguageProvider } from '@/context/language-provider'
import { LanguageSwitch } from './language-switch'

describe('LanguageSwitch', () => {
  beforeEach(() => {
    clearCookies(LANGUAGE_COOKIE_NAME)
    document.documentElement.removeAttribute('lang')
  })

  afterEach(() => {
    clearCookies(LANGUAGE_COOKIE_NAME)
    document.documentElement.removeAttribute('lang')
  })

  it('switches the visible language to Chinese from the dropdown', async () => {
    const { getByRole } = await render(
      <LanguageProvider>
        <LanguageSwitch />
      </LanguageProvider>
    )

    await userEvent.click(getByRole('button', { name: 'Language: English' }))
    await userEvent.click(getByRole('menuitem', { name: /Chinese/i }))

    expect(getByRole('button', { name: '语言：中文' })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('lang', 'zh-CN')
  })
})
