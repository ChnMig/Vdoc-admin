import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { getAuthConfig } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { SignUpForm } from './components/sign-up-form'

export function SignUp() {
  const { t } = useLanguage()
  const authConfigQuery = useQuery({
    queryKey: ['auth-config'],
    queryFn: getAuthConfig,
    staleTime: 60_000,
  })
  const registrationEnabled =
    authConfigQuery.data?.registration_enabled === true

  return (
    <AuthLayout>
      <Card className='max-w-sm gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            {authConfigQuery.isLoading
              ? t('auth.registrationCheckingTitle')
              : authConfigQuery.isError
                ? t('auth.registrationUnavailableTitle')
                : registrationEnabled
                  ? t('auth.signUp.title')
                  : t('auth.registrationDisabledTitle')}
          </CardTitle>
          <CardDescription>
            {authConfigQuery.isLoading
              ? t('auth.registrationChecking')
              : authConfigQuery.isError
                ? t('auth.registrationUnavailableDescription')
                : registrationEnabled
                  ? t('auth.signUp.description')
                  : t('auth.registrationDisabledDescription')}{' '}
            <br />
            {t('auth.signUp.haveAccount')}{' '}
            <Link
              to='/sign-in'
              className='underline underline-offset-4 hover:text-primary'
            >
              {t('auth.signUp.link')}
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {authConfigQuery.isLoading ? (
            <p className='text-sm text-muted-foreground'>
              {t('auth.registrationChecking')}
            </p>
          ) : authConfigQuery.isError ? (
            <Alert variant='destructive' aria-live='polite'>
              <AlertTitle>{t('auth.registrationUnavailableTitle')}</AlertTitle>
              <AlertDescription className='grid gap-3'>
                <p>{t('auth.registrationUnavailableRecovery')}</p>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  className='w-fit'
                  onClick={() => void authConfigQuery.refetch()}
                >
                  {t('auth.retryRegistrationCheck')}
                </Button>
              </AlertDescription>
            </Alert>
          ) : registrationEnabled ? (
            <SignUpForm />
          ) : (
            <p className='rounded-md border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground'>
              {t('auth.registrationDisabledRecovery')}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <p className='px-8 text-center text-sm text-muted-foreground'>
            {t('auth.signUp.footerPrefix')}{' '}
            <a
              href='/terms'
              className='underline underline-offset-4 hover:text-primary'
            >
              {t('auth.terms')}
            </a>{' '}
            {t('auth.signIn.footerConnector')}{' '}
            <a
              href='/privacy'
              className='underline underline-offset-4 hover:text-primary'
            >
              {t('auth.privacy')}
            </a>
            .
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
