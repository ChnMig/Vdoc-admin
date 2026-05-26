import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { VdocApiError } from '@/lib/vdoc-api'

export function handleServerError(error: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(error)
  }

  let errMsg = 'Something went wrong!'

  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    Number(error.status) === 204
  ) {
    errMsg = 'No content.'
  }

  if (error instanceof VdocApiError) {
    errMsg = error.message
  }

  if (error instanceof AxiosError) {
    const title = error.response?.data?.title
    const message = error.response?.data?.message
    if (typeof message === 'string' && message.length > 0) {
      errMsg = message
    }
    if (typeof title === 'string' && title.length > 0) {
      errMsg = title
    }
  }

  toast.error(errMsg)
}
