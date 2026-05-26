import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'

export function MaintenanceError() {
  const { t } = useLanguage()

  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        <h1 className='text-[7rem] leading-tight font-bold'>503</h1>
        <span className='font-medium'>{t('errors.maintenanceTitle')}</span>
        <p className='text-center text-muted-foreground'>
          {t('errors.maintenanceDescription')}
        </p>
        <div className='mt-6 flex gap-4'>
          <Button variant='outline'>{t('errors.learnMore')}</Button>
        </div>
      </div>
    </div>
  )
}
