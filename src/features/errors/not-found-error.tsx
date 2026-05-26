import { useNavigate, useRouter } from '@tanstack/react-router'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'

export function NotFoundError() {
  const navigate = useNavigate()
  const { history } = useRouter()
  const { t } = useLanguage()

  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        <h1 className='text-[7rem] leading-tight font-bold'>404</h1>
        <span className='font-medium'>{t('errors.notFoundTitle')}</span>
        <p className='text-center text-muted-foreground'>
          {t('errors.notFoundDescription')}
        </p>
        <div className='mt-6 flex gap-4'>
          <Button variant='outline' onClick={() => history.go(-1)}>
            {t('errors.goBack')}
          </Button>
          <Button onClick={() => navigate({ to: '/' })}>
            {t('errors.backHome')}
          </Button>
        </div>
      </div>
    </div>
  )
}
