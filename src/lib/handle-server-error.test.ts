import { AxiosError } from 'axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleServerError } from './handle-server-error'

const toastError = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  toast: {
    error: toastError,
  },
}))

beforeEach(() => {
  vi.mocked(toastError).mockClear()
})

describe('handleServerError', () => {
  it('shows a generic message when the error is not recognised', () => {
    handleServerError(new Error('network'))

    expect(toastError).toHaveBeenCalledWith('Something went wrong!')
  })

  it('maps a plain object with status 204 to the no-content message', () => {
    handleServerError({ status: 204 })

    expect(toastError).toHaveBeenCalledWith('No content.')
  })

  it('prefers the API title when the error is an Axios error with response data', () => {
    const error = new AxiosError('Bad request')
    error.response = {
      status: 422,
      data: { title: 'Validation failed' },
    } as AxiosError['response']

    handleServerError(error)

    expect(toastError).toHaveBeenCalledWith('Validation failed')
  })

  it('falls back to the generic message when Axios response has no data.title', () => {
    const error = new AxiosError('Request failed')
    error.response = {
      status: 500,
      data: {},
    } as AxiosError['response']

    handleServerError(error)

    expect(toastError).toHaveBeenCalledWith('Something went wrong!')
  })

  it('falls back to the generic message when Axios data.title is an empty string', () => {
    const error = new AxiosError('Bad request')
    error.response = {
      status: 400,
      data: { title: '' },
    } as AxiosError['response']

    handleServerError(error)

    expect(toastError).toHaveBeenCalledWith('Something went wrong!')
  })

  it('logs only a sanitized error summary to the console in development', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const err = new AxiosError('logged')
    err.config = {
      headers: { Authorization: 'raw.jwt.token' },
      method: 'get',
      url: '/api/v1/private/identity/me',
    } as AxiosError['config']

    handleServerError(err)

    expect(log).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith('Vdoc request failed', {
      name: 'AxiosError',
      code: undefined,
      message: 'logged',
      method: 'get',
      url: '/api/v1/private/identity/me',
      responseStatus: undefined,
      responseCode: undefined,
      responseSemanticStatus: undefined,
      responseMessage: undefined,
    })
    expect(JSON.stringify(log.mock.calls)).not.toContain('raw.jwt.token')

    log.mockRestore()
  })

  it('does not log the error to the console in production', () => {
    vi.stubEnv('DEV', false)

    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const err = new Error('not logged')

    handleServerError(err)

    expect(log).not.toHaveBeenCalled()

    log.mockRestore()
  })
})
