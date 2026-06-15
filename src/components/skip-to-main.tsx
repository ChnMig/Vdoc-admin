import { useLanguage } from '@/context/language-provider'

export function SkipToMain() {
  const { t } = useLanguage()

  return (
    <a
      className={`fixed start-4 top-3 z-(--z-skip-link) -translate-y-20 bg-primary px-4 py-2 text-sm font-medium whitespace-nowrap text-primary-foreground opacity-95 shadow-sm transition-[top,translate,background-color] hover:bg-primary/90 focus:top-20 focus:translate-y-0 focus-visible:ring-1 focus-visible:ring-ring`}
      href='#content'
    >
      {t('app.skipToMain')}
    </a>
  )
}
