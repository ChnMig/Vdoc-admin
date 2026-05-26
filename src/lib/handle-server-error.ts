import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { getStoredLanguage, translate } from '@/lib/i18n'
import { VdocApiError } from '@/lib/vdoc-api'

const message = (key: Parameters<typeof translate>[1]) =>
  translate(getStoredLanguage(), key)

export function handleServerError(error: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(error)
  }

  let errMsg = message('toasts.somethingWrong')

  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    Number(error.status) === 204
  ) {
    errMsg = message('toasts.noContent')
  }

  if (error instanceof VdocApiError) {
    errMsg = error.message
  }

  if (error instanceof AxiosError) {
    const title = error.response?.data?.title
    const responseMessage = error.response?.data?.message
    if (typeof responseMessage === 'string' && responseMessage.length > 0) {
      errMsg = responseMessage
    }
    if (typeof title === 'string' && title.length > 0) {
      errMsg = title
    }
  }

  toast.error(errMsg)
}
