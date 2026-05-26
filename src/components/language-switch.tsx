import { Check, Languages } from 'lucide-react'
import { type Language, languages } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const languageLabelKey: Record<
  Language,
  'language.english' | 'language.chinese'
> = {
  en: 'language.english',
  'zh-CN': 'language.chinese',
}

const languageShortLabelKey: Record<
  Language,
  'language.englishShort' | 'language.chineseShort'
> = {
  en: 'language.englishShort',
  'zh-CN': 'language.chineseShort',
}

export function LanguageSwitch() {
  const { language, setLanguage, t } = useLanguage()
  const currentLanguageLabel = t(languageLabelKey[language])

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='sm'
          className='h-8 rounded-full px-3'
          aria-label={t('language.switchLabel', {
            language: currentLanguageLabel,
          })}
        >
          <Languages aria-hidden='true' className='size-4' />
          <span className='text-xs font-semibold tracking-wide'>
            {t(languageShortLabelKey[language])}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuLabel>{t('language.label')}</DropdownMenuLabel>
        {languages.map((availableLanguage) => (
          <DropdownMenuItem
            key={availableLanguage}
            onClick={() => setLanguage(availableLanguage)}
          >
            {t(languageLabelKey[availableLanguage])}
            <Check
              size={14}
              className={cn(
                'ms-auto',
                language !== availableLanguage && 'hidden'
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
