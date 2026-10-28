import { lazy, Suspense, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { type Language } from '@/lib/i18n'
import { apiBaseUrl, getHealth, getIdentity } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { useTheme } from '@/context/theme-provider'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LanguageSwitch } from '@/components/language-switch'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { OptionsSelect } from '@/components/options-select'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

const ChangePasswordPanel = lazy(() =>
  import('./change-password-panel').then(({ ChangePasswordPanel }) => ({
    default: ChangePasswordPanel,
  }))
)

const AISettingsPanel = lazy(() =>
  import('./ai-settings').then(({ AISettingsPanel }) => ({
    default: AISettingsPanel,
  }))
)

const ReleaseStatusPanel = lazy(() =>
  import('./release-status-panel').then(({ ReleaseStatusPanel }) => ({
    default: ReleaseStatusPanel,
  }))
)

const categories = ['account', 'appearance', 'ai', 'version'] as const
type SettingsCategory = (typeof categories)[number]

export function SettingsPage() {
  const { t } = useLanguage()
  const [category, setCategory] = useState<SettingsCategory>('account')
  const [visited, setVisited] = useState<SettingsCategory[]>(['account'])
  const authUser = useAuthStore((state) => state.auth.user)
  const identityQuery = useQuery({
    queryKey: ['identity'],
    queryFn: ({ signal }) => getIdentity({ signal }),
  })
  const identity = identityQuery.data ?? authUser

  return (
    <>
      <Header className='[&>div]:gap-2 sm:[&>div]:gap-4'>
        <Search className='me-auto' />
        <LanguageSwitch />
        <ThemeSwitch />
      </Header>
      <Main>
        <div className='mb-6 space-y-2'>
          <h1 className='text-2xl font-semibold tracking-tight'>
            {t('nav.settings')}
          </h1>
          <p className='text-sm text-muted-foreground'>
            {t('admin.settings.description')}
          </p>
        </div>
        <Tabs
          value={category}
          onValueChange={(value) => {
            const next = value as SettingsCategory
            setCategory(next)
            setVisited((previous) =>
              previous.includes(next) ? previous : [...previous, next]
            )
          }}
          className='min-w-0 gap-6'
        >
          <TabsList
            aria-label={t('admin.settings.navigation')}
            className='grid h-auto w-full grid-cols-4 justify-start gap-1 rounded-none border-b bg-transparent p-0 sm:flex sm:gap-4'
          >
            {categories.map((item) => (
              <TabsTrigger
                key={item}
                value={item}
                className='min-h-11 flex-none rounded-none border-0 border-b-2 border-transparent px-2 py-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none sm:px-4 dark:data-[state=active]:border-primary dark:data-[state=active]:bg-transparent'
              >
                {t(`admin.settings.tabs.${item}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          {categories.map((item) => (
            <TabsContent
              key={item}
              value={item}
              hidden={category !== item}
              forceMount
              className='min-w-0 data-[state=inactive]:hidden'
            >
              {visited.includes(item) && (
                <>
                  {item === 'account' && (
                    <div className='divide-y rounded-lg border bg-card px-5 text-card-foreground sm:px-6'>
                      <SettingsSection
                        title={t('admin.settings.accountTitle')}
                        description={t('admin.settings.accountDescription')}
                      >
                        <dl className='grid min-w-0 gap-5 text-sm sm:grid-cols-2'>
                          <Detail label={t('admin.fields.name')}>
                            {identity?.name ?? '—'}
                          </Detail>
                          <Detail label={t('admin.fields.email')}>
                            {identity?.email ?? '—'}
                          </Detail>
                          <Detail label={t('admin.settings.role')}>
                            <Badge variant='secondary'>
                              {identity?.is_super_admin
                                ? t('admin.fields.superAdmin')
                                : t('admin.settings.member')}
                            </Badge>
                          </Detail>
                        </dl>
                      </SettingsSection>
                      <div className='py-6'>
                        {identity && (
                          <Suspense
                            fallback={
                              <p
                                role='status'
                                className='text-sm text-muted-foreground'
                              >
                                {t('admin.common.loading')}
                              </p>
                            }
                          >
                            <ChangePasswordPanel embedded />
                          </Suspense>
                        )}
                      </div>
                    </div>
                  )}
                  {item === 'appearance' && <AppearanceSettings />}
                  {item === 'ai' && identity && (
                    <Suspense
                      fallback={
                        <p
                          role='status'
                          className='py-6 text-sm text-muted-foreground'
                        >
                          {t('admin.common.loading')}
                        </p>
                      }
                    >
                      <AISettingsPanel user={identity} />
                    </Suspense>
                  )}
                  {item === 'version' && (
                    <div className='grid min-w-0 gap-6'>
                      {identity && (
                        <Suspense
                          fallback={
                            <p
                              role='status'
                              className='py-6 text-sm text-muted-foreground'
                            >
                              {t('admin.common.loading')}
                            </p>
                          }
                        >
                          <ReleaseStatusPanel />
                        </Suspense>
                      )}
                      <RuntimeSettings />
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </Main>
    </>
  )
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className='grid min-w-0 items-start gap-5 py-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8'>
      <div className='space-y-2'>
        <h2 className='font-semibold'>{title}</h2>
        <p className='text-sm leading-6 text-muted-foreground'>{description}</p>
      </div>
      <div className='min-w-0'>{children}</div>
    </section>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className='min-w-0 space-y-2'>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='font-medium break-words'>{children}</dd>
    </div>
  )
}

function AppearanceSettings() {
  const { t, language, setLanguage } = useLanguage()
  const { theme, setTheme } = useTheme()
  const themes = [
    { value: 'light', Icon: Sun },
    { value: 'dark', Icon: Moon },
    { value: 'system', Icon: Monitor },
  ] as const

  return (
    <div className='divide-y rounded-lg border bg-card px-5 text-card-foreground sm:px-6'>
      <SettingsSection
        title={t('admin.settings.appearanceTitle')}
        description={t('admin.settings.appearanceDescription')}
      >
        <fieldset>
          <legend className='sr-only'>{t('admin.fields.theme')}</legend>
          <div className='grid max-w-lg grid-cols-3 gap-3'>
            {themes.map(({ value, Icon }) => (
              <label key={value} className='relative cursor-pointer'>
                <input
                  type='radio'
                  name='settings-theme'
                  value={value}
                  checked={theme === value}
                  onChange={() => setTheme(value)}
                  className='peer sr-only'
                />
                <span className='flex min-h-24 flex-col items-center justify-center gap-3 rounded-md border bg-background px-2 py-4 text-sm text-muted-foreground transition-colors peer-checked:border-primary peer-checked:bg-primary/5 peer-checked:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 hover:bg-muted/50'>
                  <Icon aria-hidden className='size-5' />
                  <span>{t(`theme.${value}`)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </SettingsSection>
      <SettingsSection
        title={t('language.label')}
        description={t('admin.settings.languageDescription')}
      >
        <div className='grid max-w-xs gap-2'>
          <Label htmlFor='settings-language' className='sr-only'>
            {t('language.label')}
          </Label>
          <OptionsSelect
            id='settings-language'
            value={language}
            onChange={(value) => setLanguage(value as Language)}
            options={[
              { value: 'zh-CN', label: '简体中文' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>
      </SettingsSection>
    </div>
  )
}

function RuntimeSettings() {
  const { t } = useLanguage()
  const authUser = useAuthStore((state) => state.auth.user)
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => getHealth({ signal }),
  })

  return (
    <div className='rounded-lg border bg-card px-5 text-card-foreground sm:px-6'>
      <SettingsSection
        title={t('admin.settings.serviceTitle')}
        description={t('admin.settings.serviceDescription')}
      >
        <dl className='grid min-w-0 gap-5 text-sm sm:grid-cols-2'>
          <div className='sm:col-span-2'>
            <Detail label={t('admin.fields.apiBaseUrl')}>{apiBaseUrl}</Detail>
          </div>
          <Detail label={t('admin.fields.health')}>
            {healthQuery.isError
              ? t('admin.settings.healthFailed')
              : (healthQuery.data?.status ?? t('admin.common.loading'))}
          </Detail>
          <Detail label={t('admin.fields.session')}>
            {authUser ? t('admin.statuses.active') : t('admin.common.none')}
          </Detail>
        </dl>
      </SettingsSection>
    </div>
  )
}
