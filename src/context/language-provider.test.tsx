import { clearCookies } from '@/test-utils/cookies'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { getCookie, setCookie } from '@/lib/cookies'
import { LANGUAGE_COOKIE_NAME } from '@/lib/i18n'
import { LanguageProvider, useLanguage } from './language-provider'

function LanguageProbe() {
  const { language, setLanguage, t } = useLanguage()

  return (
    <button type='button' onClick={() => setLanguage('zh-CN')}>
      {language}:{t('language.label')}
    </button>
  )
}

describe('LanguageProvider', () => {
  beforeEach(() => {
    clearCookies(LANGUAGE_COOKIE_NAME)
    document.documentElement.removeAttribute('lang')
  })

  afterEach(() => {
    clearCookies(LANGUAGE_COOKIE_NAME)
    document.documentElement.removeAttribute('lang')
  })

  it('reads the initial language from the language cookie', async () => {
    setCookie(LANGUAGE_COOKIE_NAME, 'zh-CN')

    const { getByRole } = await render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>
    )

    await expect
      .element(getByRole('button', { name: 'zh-CN:语言' }))
      .toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('lang', 'zh-CN')
  })

  it('persists language changes to a cookie and updates html lang', async () => {
    const { getByRole } = await render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>
    )

    await expect
      .element(getByRole('button', { name: 'en:Language' }))
      .toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('lang', 'en')

    await userEvent.click(getByRole('button', { name: 'en:Language' }))

    await expect
      .element(getByRole('button', { name: 'zh-CN:语言' }))
      .toBeInTheDocument()
    expect(getCookie(LANGUAGE_COOKIE_NAME)).toBe('zh-CN')
    expect(document.documentElement).toHaveAttribute('lang', 'zh-CN')
  })
})
