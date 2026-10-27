import { clearCookies } from '@/test-utils/cookies'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCookie, setCookie } from '@/lib/cookies'
import { getStoredLanguage, LANGUAGE_COOKIE_NAME } from '@/lib/i18n'
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
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US'])
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US')
  })

  afterEach(() => {
    clearCookies(LANGUAGE_COOKIE_NAME)
    document.documentElement.removeAttribute('lang')
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('reads the initial language from the language cookie', async () => {
    setCookie(LANGUAGE_COOKIE_NAME, 'zh-CN')

    const { getByRole } = await render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>
    )

    expect(getByRole('button', { name: 'zh-CN:语言' })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('lang', 'zh-CN')
  })

  it.each([
    [['zh-CN'], 'zh-CN', 'zh-CN:语言'],
    [['zh-Hant-TW'], 'zh-Hant-TW', 'zh-CN:语言'],
    [['en-GB', 'zh-CN'], 'en-GB', 'en:Language'],
    [['fr-FR', 'zh-CN', 'en-US'], 'fr-FR', 'zh-CN:语言'],
    [['ja-JP'], 'ja-JP', 'en:Language'],
    [[], 'zh-CN', 'zh-CN:语言'],
  ])(
    'uses browser language preferences %j and fallback %s without a saved choice',
    async (preferredLanguages, browserLanguage, expectedLabel) => {
      vi.spyOn(navigator, 'languages', 'get').mockReturnValue(
        preferredLanguages
      )
      vi.spyOn(navigator, 'language', 'get').mockReturnValue(browserLanguage)

      const { getByRole } = await render(
        <LanguageProvider>
          <LanguageProbe />
        </LanguageProvider>
      )

      expect(getByRole('button', { name: expectedLabel })).toBeInTheDocument()
      expect(document.documentElement).toHaveAttribute(
        'lang',
        expectedLabel.split(':')[0]
      )
      expect(getCookie(LANGUAGE_COOKIE_NAME)).toBeUndefined()
    }
  )

  it('keeps a saved English choice ahead of Chinese browser preferences', async () => {
    setCookie(LANGUAGE_COOKIE_NAME, 'en')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['zh-CN'])
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('zh-CN')

    const { getByRole } = await render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>
    )

    expect(getByRole('button', { name: 'en:Language' })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('lang', 'en')
  })

  it('ignores an unsupported saved value and detects the browser language', async () => {
    setCookie(LANGUAGE_COOKIE_NAME, 'unsupported')
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['zh-CN'])

    const { getByRole } = await render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>
    )

    expect(getByRole('button', { name: 'zh-CN:语言' })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('lang', 'zh-CN')
  })

  it('defaults to English when the browser language APIs are unavailable', () => {
    vi.stubGlobal('navigator', {})
    expect(getStoredLanguage()).toBe('en')
  })

  it('persists language changes to a cookie and updates html lang', async () => {
    const { getByRole, unmount } = await render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>
    )

    expect(getByRole('button', { name: 'en:Language' })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('lang', 'en')

    await userEvent.click(getByRole('button', { name: 'en:Language' }))

    expect(getByRole('button', { name: 'zh-CN:语言' })).toBeInTheDocument()
    expect(getCookie(LANGUAGE_COOKIE_NAME)).toBe('zh-CN')
    expect(document.documentElement).toHaveAttribute('lang', 'zh-CN')

    unmount()
    const nextVisit = await render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>
    )
    expect(
      nextVisit.getByRole('button', { name: 'zh-CN:语言' })
    ).toBeInTheDocument()
  })
})
