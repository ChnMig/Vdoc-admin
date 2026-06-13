import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { getStoredLanguage, translate } from '@/lib/i18n'
import { VdocApiError } from '@/lib/vdoc-api'

const message = (key: Parameters<typeof translate>[1]) =>
  translate(getStoredLanguage(), key)

export function handleServerError(error: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('Vdoc request failed', sanitizeErrorForConsole(error))
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

export function sanitizeErrorForConsole(error: unknown) {
  if (error instanceof VdocApiError) {
    return {
      name: error.name,
      code: error.code,
      status: error.status,
      message: error.message,
    }
  }

  if (error instanceof AxiosError) {
    return {
      name: error.name,
      code: error.code,
      message: error.message,
      method: error.config?.method,
      url: error.config?.url,
      responseStatus: error.response?.status,
      responseCode: safeResponseField(error.response?.data, 'code'),
      responseSemanticStatus: safeResponseField(error.response?.data, 'status'),
      responseMessage: safeResponseField(error.response?.data, 'message'),
    }
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    }
  }

  if (error && typeof error === 'object' && 'status' in error) {
    return { status: Number(error.status) }
  }

  return { message: 'Unknown client error' }
}

function safeResponseField(data: unknown, field: string) {
  if (!data || typeof data !== 'object' || !(field in data)) return undefined
  const value = data[field as keyof typeof data]
  if (typeof value === 'string' || typeof value === 'number') return value
  return undefined
}
