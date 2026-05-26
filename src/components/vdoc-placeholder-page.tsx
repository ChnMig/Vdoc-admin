import { type TranslationKey } from '@/lib/i18n'
import { useLanguage } from '@/context/language-provider'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { LanguageSwitch } from '@/components/language-switch'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

type VdocPlaceholderPageProps = {
  titleKey: TranslationKey
  descriptionKey: TranslationKey
  endpoint: string
}

export function VdocPlaceholderPage({
  titleKey,
  descriptionKey,
  endpoint,
}: VdocPlaceholderPageProps) {
  const { t } = useLanguage()

  return (
    <>
      <Header>
        <Search />
        <LanguageSwitch />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        <div className='mb-6 space-y-2'>
          <p className='text-sm font-medium text-muted-foreground'>
            {t('app.consoleLabel')}
          </p>
          <h1 className='text-2xl font-bold tracking-tight'>{t(titleKey)}</h1>
          <p className='max-w-3xl text-muted-foreground'>{t(descriptionKey)}</p>
        </div>
        <Card className='max-w-3xl'>
          <CardHeader>
            <CardTitle>{t('placeholder.apiTitle')}</CardTitle>
            <CardDescription>{t('placeholder.apiDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className='rounded-lg border bg-muted/40 p-4 font-mono text-sm text-muted-foreground'>
              {endpoint}
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
