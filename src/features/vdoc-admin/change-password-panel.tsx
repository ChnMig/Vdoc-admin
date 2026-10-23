import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { isUnauthenticatedError } from '@/lib/auth-errors'
import type { TFunction } from '@/lib/i18n'
import { userPasswordError } from '@/lib/user-password'
import { changePassword, VdocApiError } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { PasswordInput } from '@/components/password-input'

type PasswordFormValues = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const emptyValues: PasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

function createFormSchema(t: TFunction) {
  return z
    .object({
      currentPassword: z
        .string()
        .min(1, t('auth.changePassword.currentRequired')),
      newPassword: z.string().superRefine((value, context) => {
        if (userPasswordError(value) !== undefined) {
          context.addIssue({
            code: 'custom',
            message: t('auth.validation.passwordPolicy'),
          })
        }
      }),
      confirmPassword: z.string().min(1, t('auth.validation.confirmPassword')),
    })
    .refine((values) => values.newPassword !== values.currentPassword, {
      message: t('auth.changePassword.mustDiffer'),
      path: ['newPassword'],
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      message: t('auth.validation.passwordMismatch'),
      path: ['confirmPassword'],
    })
}

export function ChangePasswordPanel() {
  const sessionVersion = useAuthStore((state) => state.auth.sessionVersion)
  // A new session gets an empty form, even if its token or user happens to match.
  return (
    <ChangePasswordForm key={sessionVersion} sessionVersion={sessionVersion} />
  )
}

function ChangePasswordForm({ sessionVersion }: { sessionVersion: number }) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const formSchema = useMemo(() => createFormSchema(t), [t])
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: emptyValues,
  })
  const [pending, setPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const mounted = useRef(false)
  const activeRequest = useRef<AbortController | null>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      activeRequest.current?.abort()
    }
  }, [])

  async function onSubmit(values: PasswordFormValues) {
    if (!mounted.current || activeRequest.current) return
    const session = useAuthStore.getState().auth
    if (!session.accessToken || session.sessionVersion !== sessionVersion)
      return
    const controller = new AbortController()
    activeRequest.current = controller
    setPending(true)
    setErrorMessage('')
    const ownsSession = () =>
      mounted.current &&
      !controller.signal.aborted &&
      useAuthStore.getState().auth.sessionVersion === sessionVersion

    const signInAgain = (success: boolean) => {
      form.reset(emptyValues)
      useAuthStore.getState().auth.reset()
      void queryClient.cancelQueries()
      queryClient.clear()
      if (success) toast.success(t('auth.changePassword.success'))
      else toast.error(t('toasts.sessionExpired'))
      void navigate({
        to: '/sign-in',
        search: { redirect: '/settings' },
        replace: true,
      })
    }

    try {
      // Keep credentials out of the React Query mutation cache and diagnostics.
      await changePassword(
        {
          current_password: values.currentPassword,
          new_password: values.newPassword,
        },
        { signal: controller.signal }
      )
      if (ownsSession()) signInAgain(true)
    } catch (error) {
      if (!ownsSession()) return
      if (isUnauthenticatedError(error)) {
        signInAgain(false)
        return
      }
      form.resetField('currentPassword')
      if (
        error instanceof VdocApiError &&
        error.status === 'INVALID_ARGUMENT'
      ) {
        setErrorMessage(t('auth.changePassword.invalidCredentials'))
      } else if (
        error instanceof VdocApiError &&
        error.status === 'FAILED_PRECONDITION'
      ) {
        setErrorMessage(t('auth.changePassword.concurrentChange'))
      } else {
        setErrorMessage(t('auth.changePassword.failed'))
      }
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null
        if (mounted.current) setPending(false)
      }
    }
  }

  return (
    <Card className='w-full max-w-md min-w-0'>
      <CardHeader>
        <CardTitle>{t('auth.changePassword.title')}</CardTitle>
        <CardDescription>
          {t('auth.changePassword.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            aria-label={t('auth.changePassword.title')}
            aria-busy={pending}
            className='grid gap-4'
            noValidate
            onSubmit={(event) => {
              void form.handleSubmit(onSubmit)(event)
            }}
          >
            <fieldset disabled={pending} className='grid min-w-0 gap-4'>
              <FormField
                control={form.control}
                name='currentPassword'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.changePassword.current')}</FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete='current-password'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='newPassword'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.changePassword.new')}</FormLabel>
                    <FormControl>
                      <PasswordInput autoComplete='new-password' {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('auth.validation.passwordPolicy')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='confirmPassword'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('auth.changePassword.confirm')}</FormLabel>
                    <FormControl>
                      <PasswordInput autoComplete='new-password' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>
            {errorMessage && (
              <p role='alert' className='text-sm text-destructive'>
                {errorMessage}
              </p>
            )}
            <Button type='submit' className='w-fit' disabled={pending}>
              {pending && <Loader2 aria-hidden className='animate-spin' />}
              {t(
                pending
                  ? 'auth.changePassword.submitting'
                  : 'auth.changePassword.submit'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
