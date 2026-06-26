import { Logo } from '@/assets/logo'
import { useLanguage } from '@/context/language-provider'
import { LanguageSwitch } from '@/components/language-switch'
import { ThemeSwitch } from '@/components/theme-switch'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t } = useLanguage()

  return (
    <div className='relative grid min-h-svh max-w-none overflow-hidden bg-background px-4 py-6 sm:px-6'>
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,var(--workspace-glow),transparent_28rem),linear-gradient(135deg,var(--surface-control),transparent_42%)]' />
      <div className='absolute top-4 right-4 z-10 flex items-center gap-2'>
        <LanguageSwitch />
        <ThemeSwitch />
      </div>
      <div className='relative mx-auto grid w-full max-w-5xl items-center gap-8 self-center lg:grid-cols-[1fr_25rem]'>
        <div className='hidden max-w-xl gap-5 lg:grid'>
          <div className='flex items-center gap-3'>
            <span className='flex size-10 items-center justify-center rounded-lg border bg-card text-primary shadow-[var(--shadow-card)]'>
              <Logo className='size-5' />
            </span>
            <div>
              <p className='text-sm font-semibold'>{t('auth.brand')}</p>
              <p className='text-xs font-medium text-muted-foreground'>
                {t('auth.controlPlane.label')}
              </p>
            </div>
          </div>
          <div className='grid gap-3'>
            <p className='text-3xl font-semibold tracking-[-0.03em] text-balance text-foreground'>
              {t('auth.controlPlane.title')}
            </p>
            <p className='max-w-lg text-sm leading-6 text-muted-foreground'>
              {t('auth.controlPlane.description')}
            </p>
          </div>
          <div className='grid gap-2 rounded-lg border bg-card p-4 text-sm shadow-[var(--shadow-card)]'>
            <div className='flex items-center justify-between gap-3'>
              <span className='font-medium'>
                {t('auth.controlPlane.sourceTitle')}
              </span>
              <span className='rounded-sm border bg-[var(--status-ready-surface)] px-2 py-0.5 text-xs font-medium text-[var(--status-ready)]'>
                {t('auth.controlPlane.ready')}
              </span>
            </div>
            <p className='text-muted-foreground'>
              {t('auth.controlPlane.sourceDescription')}
            </p>
          </div>
        </div>
        <div className='mx-auto grid w-full max-w-md gap-4'>
          <div className='mb-1 flex items-center justify-center lg:hidden'>
            <Logo className='me-2' />
            <h1 className='text-xl font-medium'>{t('auth.brand')}</h1>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
