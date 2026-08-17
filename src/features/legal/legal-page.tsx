import { Link } from '@tanstack/react-router'
import { ArrowLeft, Scale, ShieldCheck } from 'lucide-react'
import { Logo } from '@/assets/logo'
import { useLanguage } from '@/context/language-provider'
import { LanguageSwitch } from '@/components/language-switch'
import { ThemeSwitch } from '@/components/theme-switch'

type LegalPageProps = {
  kind: 'terms' | 'privacy'
}

export function LegalPage({ kind }: LegalPageProps) {
  const { t } = useLanguage()
  const isTerms = kind === 'terms'
  const sections = isTerms
    ? [
        {
          title: t('legal.terms.sections.scope.title'),
          body: t('legal.terms.sections.scope.body'),
        },
        {
          title: t('legal.terms.sections.accounts.title'),
          body: t('legal.terms.sections.accounts.body'),
        },
        {
          title: t('legal.terms.sections.content.title'),
          body: t('legal.terms.sections.content.body'),
        },
        {
          title: t('legal.terms.sections.operation.title'),
          body: t('legal.terms.sections.operation.body'),
        },
      ]
    : [
        {
          title: t('legal.privacy.sections.roles.title'),
          body: t('legal.privacy.sections.roles.body'),
        },
        {
          title: t('legal.privacy.sections.data.title'),
          body: t('legal.privacy.sections.data.body'),
        },
        {
          title: t('legal.privacy.sections.integrations.title'),
          body: t('legal.privacy.sections.integrations.body'),
        },
        {
          title: t('legal.privacy.sections.choices.title'),
          body: t('legal.privacy.sections.choices.body'),
        },
      ]

  return (
    <div className='min-h-svh bg-background'>
      <header className='border-b bg-card/80 backdrop-blur'>
        <div className='mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6'>
          <Link to='/sign-in' className='flex items-center gap-3'>
            <span className='flex size-9 items-center justify-center rounded-lg border bg-background text-primary shadow-[var(--shadow-card)]'>
              <Logo className='size-5' />
            </span>
            <span className='font-semibold'>{t('auth.brand')}</span>
          </Link>
          <div className='flex items-center gap-2'>
            <LanguageSwitch />
            <ThemeSwitch />
          </div>
        </div>
      </header>

      <main className='mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 sm:py-14'>
        <div className='grid max-w-3xl gap-5'>
          <Link
            to='/sign-in'
            className='flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground'
          >
            <ArrowLeft className='size-4' aria-hidden='true' />
            {t('legal.backToSignIn')}
          </Link>
          <div className='flex size-11 items-center justify-center rounded-lg border bg-[var(--surface-control)] text-primary'>
            {isTerms ? (
              <Scale className='size-5' aria-hidden='true' />
            ) : (
              <ShieldCheck className='size-5' aria-hidden='true' />
            )}
          </div>
          <div className='grid gap-3'>
            <h1 className='text-3xl font-semibold tracking-[-0.03em] sm:text-4xl'>
              {isTerms ? t('legal.terms.title') : t('legal.privacy.title')}
            </h1>
            <p className='text-base leading-7 text-muted-foreground'>
              {isTerms
                ? t('legal.terms.description')
                : t('legal.privacy.description')}
            </p>
            <p className='text-xs font-medium text-muted-foreground'>
              {t('legal.lastUpdated')}
            </p>
          </div>
        </div>

        <aside className='max-w-3xl rounded-lg border bg-[var(--status-ready-surface)] p-4 text-sm leading-6 text-[var(--status-ready)]'>
          {t('legal.instanceNotice')}
        </aside>

        <div className='grid max-w-3xl gap-4'>
          {sections.map((section) => (
            <section
              key={section.title}
              className='grid gap-2 rounded-lg border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6'
            >
              <h2 className='text-lg font-semibold'>{section.title}</h2>
              <p className='text-sm leading-7 text-muted-foreground'>
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
