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
    <div className='container grid h-svh max-w-none items-center justify-center bg-[radial-gradient(circle_at_top,var(--accent),transparent_35%)]'>
      <div className='absolute top-4 right-4 flex items-center gap-2'>
        <LanguageSwitch />
        <ThemeSwitch />
      </div>
      <div className='mx-auto flex w-full flex-col justify-center space-y-2 py-8 sm:p-8'>
        <div className='mb-4 flex items-center justify-center'>
          <Logo className='me-2' />
          <h1 className='text-xl font-medium'>{t('auth.brand')}</h1>
        </div>
        {children}
      </div>
    </div>
  )
}
