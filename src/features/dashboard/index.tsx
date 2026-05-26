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

export function Dashboard() {
  const { t } = useLanguage()
  const overviewCards = [
    {
      title: t('dashboard.overview.projects.title'),
      value: t('dashboard.overview.projects.value'),
      description: t('dashboard.overview.projects.description'),
    },
    {
      title: t('dashboard.overview.documents.title'),
      value: t('dashboard.overview.documents.value'),
      description: t('dashboard.overview.documents.description'),
    },
    {
      title: t('dashboard.overview.drafts.title'),
      value: t('dashboard.overview.drafts.value'),
      description: t('dashboard.overview.drafts.description'),
    },
    {
      title: t('dashboard.overview.mcpTokens.title'),
      value: t('dashboard.overview.mcpTokens.value'),
      description: t('dashboard.overview.mcpTokens.description'),
    },
  ]
  const workflowCards = [
    {
      title: t('dashboard.workflow.organize.title'),
      body: t('dashboard.workflow.organize.body'),
    },
    {
      title: t('dashboard.workflow.review.title'),
      body: t('dashboard.workflow.review.body'),
    },
    {
      title: t('dashboard.workflow.publish.title'),
      body: t('dashboard.workflow.publish.body'),
    },
  ]

  return (
    <>
      <Header>
        <Search />
        <LanguageSwitch />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main>
        <section className='mb-6 grid gap-3'>
          <p className='text-sm font-medium text-muted-foreground'>
            {t('dashboard.eyebrow')}
          </p>
          <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
            <div className='space-y-2'>
              <h1 className='text-2xl font-bold tracking-tight'>
                {t('dashboard.title')}
              </h1>
              <p className='max-w-3xl text-muted-foreground'>
                {t('dashboard.description')}
              </p>
            </div>
          </div>
        </section>

        <section className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {overviewCards.map((card) => (
            <Card key={card.title}>
              <CardHeader>
                <CardTitle className='text-sm font-medium'>
                  {card.title}
                </CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{card.value}</div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className='mt-4 grid gap-4 lg:grid-cols-3'>
          {workflowCards.map((card) => (
            <Card key={card.title}>
              <CardHeader>
                <CardTitle>{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className='text-sm text-muted-foreground'>{card.body}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      </Main>
    </>
  )
}
