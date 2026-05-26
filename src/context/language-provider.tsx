import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { setCookie } from '@/lib/cookies'
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE_MAX_AGE,
  LANGUAGE_COOKIE_NAME,
  type Language,
  type TFunction,
  getStoredLanguage,
  translate,
} from '@/lib/i18n'

const HTML_LANG: Record<Language, string> = {
  en: 'en',
  'zh-CN': 'zh-CN',
}

type LanguageContextType = {
  defaultLanguage: Language
  language: Language
  setLanguage: (language: Language) => void
  t: TFunction
}

const fallbackT: TFunction = (key, values) =>
  translate(DEFAULT_LANGUAGE, key, values)

const fallbackContext: LanguageContextType = {
  defaultLanguage: DEFAULT_LANGUAGE,
  language: DEFAULT_LANGUAGE,
  setLanguage: () => undefined,
  t: fallbackT,
}

const LanguageContext = createContext<LanguageContextType | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() =>
    getStoredLanguage()
  )

  useEffect(() => {
    document.documentElement.setAttribute('lang', HTML_LANG[language])
  }, [language])

  const setLanguage = useCallback((nextLanguage: Language) => {
    setLanguageState(nextLanguage)
    setCookie(LANGUAGE_COOKIE_NAME, nextLanguage, LANGUAGE_COOKIE_MAX_AGE)
  }, [])

  const t = useCallback<TFunction>(
    (key, values) => translate(language, key, values),
    [language]
  )

  const value = useMemo(
    () => ({
      defaultLanguage: DEFAULT_LANGUAGE,
      language,
      setLanguage,
      t,
    }),
    [language, setLanguage, t]
  )

  return <LanguageContext value={value}>{children}</LanguageContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  return useContext(LanguageContext) ?? fallbackContext
}
