import { type ErrorComponentProps, useRouter } from '@tanstack/react-router'
import { isServiceUnavailableError } from '@/lib/auth-errors'
import { GeneralError } from './general-error'
import { MaintenanceError } from './maintenance-error'

export function AuthenticatedRouteError({ error }: ErrorComponentProps) {
  const router = useRouter()
  if (!isServiceUnavailableError(error)) return <GeneralError />

  return <MaintenanceError onRetry={() => void router.invalidate()} />
}
