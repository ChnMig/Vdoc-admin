import { IconGithub } from '@/assets/brand-icons/icon-github'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'

export function RepositoryLink() {
  const { t } = useLanguage()
  return (
    <Button variant='ghost' size='icon' className='size-8 shrink-0' asChild>
      <a
        href='https://github.com/ChnMig/Vdoc'
        target='_blank'
        rel='noopener noreferrer'
        referrerPolicy='no-referrer'
        aria-label={t('app.openSourceRepository')}
        title={t('app.openSourceRepository')}
      >
        <IconGithub className='size-4' aria-hidden />
      </a>
    </Button>
  )
}
