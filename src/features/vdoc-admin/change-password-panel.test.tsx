import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { clearCookies } from '@/test-utils/cookies'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'
import { VdocApiError } from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import { ChangePasswordPanel } from './change-password-panel'

const mocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  navigate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/lib/vdoc-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/vdoc-api')>()),
  changePassword: mocks.changePassword,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => mocks.navigate,
}))

vi.mock('sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}))

const user: AuthUser = {
  id: 'reader-1',
  email: 'reader@example.test',
  name: 'Reader',
  is_super_admin: false,
  can_access_audit: false,
  status: 1,
}

const currentPassword = 'current-password-1'
const newPassword = 'new-password-2'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ChangePasswordPanel />
      </LanguageProvider>
    </QueryClientProvider>
  )
  return { ...view, queryClient }
}

function fillForm(
  view: ReturnType<typeof renderPanel>,
  values = {
    current: currentPassword,
    next: newPassword,
    confirm: newPassword,
  }
) {
  fireEvent.change(view.getByLabelText('Current password'), {
    target: { value: values.current },
  })
  fireEvent.change(view.getByLabelText('New password'), {
    target: { value: values.next },
  })
  fireEvent.change(view.getByLabelText('Confirm new password'), {
    target: { value: values.confirm },
  })
}

describe('ChangePasswordPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.changePassword.mockReset()
    clearCookies()
    useAuthStore.getState().auth.reset()
    useAuthStore.getState().auth.setSession(user, 'reader.jwt')
  })

  it.each([false, true])(
    'offers a labeled password form when super-admin is %s',
    (isSuperAdmin) => {
      useAuthStore
        .getState()
        .auth.setSession(
          { ...user, is_super_admin: isSuperAdmin },
          'reader.jwt'
        )
      const view = renderPanel()
      expect(view.getByLabelText('Current password')).toHaveAttribute(
        'autocomplete',
        'current-password'
      )
      expect(view.getByLabelText('New password')).toHaveAttribute(
        'autocomplete',
        'new-password'
      )
      expect(view.getByLabelText('Confirm new password')).toHaveAttribute(
        'autocomplete',
        'new-password'
      )
    }
  )

  it('validates required fields without sending a request', async () => {
    const view = renderPanel()
    await userEvent.click(view.getByRole('button', { name: 'Change password' }))
    expect(await view.findByText('Enter your current password.')).toBeVisible()
    expect(await view.findByText('Please confirm your password.')).toBeVisible()
    expect(mocks.changePassword).not.toHaveBeenCalled()
  })

  it.each([
    'short',
    ' leading-password',
    'trailing-password ',
    '界'.repeat(25),
  ])(
    'rejects a new password outside the shared password policy',
    async (password) => {
      const view = renderPanel()
      fillForm(view, {
        current: currentPassword,
        next: password,
        confirm: password,
      })
      await userEvent.click(
        view.getByRole('button', { name: 'Change password' })
      )
      expect(view.getByLabelText('New password')).toHaveAttribute(
        'aria-invalid',
        'true'
      )
      expect(mocks.changePassword).not.toHaveBeenCalled()
    }
  )

  it('rejects a mismatched confirmation and an unchanged password', async () => {
    const view = renderPanel()
    fillForm(view, {
      current: currentPassword,
      next: newPassword,
      confirm: 'different-password',
    })
    await userEvent.click(view.getByRole('button', { name: 'Change password' }))
    expect(await view.findByText("Passwords don't match.")).toBeVisible()

    fillForm(view, {
      current: currentPassword,
      next: currentPassword,
      confirm: currentPassword,
    })
    await userEvent.click(view.getByRole('button', { name: 'Change password' }))
    expect(
      await view.findByText(
        'Choose a password different from your current password.'
      )
    ).toBeVisible()
    expect(mocks.changePassword).not.toHaveBeenCalled()
  })

  it('keeps a wrong-current-password error recoverable and allows retry', async () => {
    mocks.changePassword.mockRejectedValueOnce(
      new VdocApiError({
        code: 400,
        status: 'INVALID_ARGUMENT',
        message: 'current password is incorrect',
        timestamp: 1,
      })
    )
    const pending = deferred<void>()
    mocks.changePassword.mockReturnValueOnce(pending.promise)
    const view = renderPanel()
    fillForm(view)
    await userEvent.click(view.getByRole('button', { name: 'Change password' }))

    expect(await view.findByRole('alert')).toHaveTextContent(
      'Check your current password and the new password requirements, then try again.'
    )
    expect(view.getByLabelText('Current password')).toHaveValue('')
    expect(useAuthStore.getState().auth.accessToken).toBe('reader.jwt')
    expect(mocks.navigate).not.toHaveBeenCalled()
    fireEvent.change(view.getByLabelText('Current password'), {
      target: { value: 'correct-current-password' },
    })
    await userEvent.click(view.getByRole('button', { name: 'Change password' }))
    await waitFor(() => expect(mocks.changePassword).toHaveBeenCalledTimes(2))
    expect(view.queryByRole('alert')).not.toBeInTheDocument()
    await act(async () => pending.resolve())
  })

  it.each([
    {
      error: new VdocApiError({
        code: 412,
        status: 'FAILED_PRECONDITION',
        timestamp: 1,
      }),
      message:
        'Your password changed during this request. Enter your current password and try again.',
    },
    {
      error: new Error(
        'Transport failure containing private request diagnostics'
      ),
      message: 'The password could not be changed. Please try again.',
    },
  ])(
    'keeps failed requests recoverable with a safe message',
    async ({ error, message }) => {
      mocks.changePassword.mockRejectedValue(error)
      const view = renderPanel()
      fillForm(view)
      await userEvent.click(
        view.getByRole('button', { name: 'Change password' })
      )
      expect(await view.findByRole('alert')).toHaveTextContent(message)
      expect(view.getByLabelText('Current password')).toHaveValue('')
      expect(useAuthStore.getState().auth.accessToken).toBe('reader.jwt')
      expect(mocks.navigate).not.toHaveBeenCalled()
    }
  )

  it('clears an expired session and returns to sign-in without a success message', async () => {
    mocks.changePassword.mockRejectedValue(
      new VdocApiError({ code: 401, status: 'UNAUTHENTICATED', timestamp: 1 })
    )
    const view = renderPanel()
    view.queryClient.setQueryData(['private-data'], 'private')
    fillForm(view)
    await userEvent.click(view.getByRole('button', { name: 'Change password' }))
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledOnce())
    expect(useAuthStore.getState().auth.accessToken).toBe('')
    expect(view.queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledOnce()
  })

  it('sends only current/new passwords once, without caching credentials, then signs in again', async () => {
    const pending = deferred<void>()
    mocks.changePassword.mockReturnValue(pending.promise)
    const view = renderPanel()
    view.queryClient.setQueryData(['private-data'], {
      secret: 'old account data',
    })
    fillForm(view)
    const form = view.getByRole('form', { name: 'Change password' })
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(mocks.changePassword).toHaveBeenCalledOnce())

    expect(mocks.changePassword).toHaveBeenCalledWith(
      { current_password: currentPassword, new_password: newPassword },
      { signal: expect.any(AbortSignal) }
    )
    expect(form).toHaveAttribute('aria-busy', 'true')
    expect(view.getByLabelText('Current password')).toBeDisabled()
    expect(
      view.getByRole('button', { name: 'Changing password…' })
    ).toBeDisabled()
    expect(view.queryClient.getMutationCache().getAll()).toHaveLength(0)
    expect(JSON.stringify(window.sessionStorage)).not.toContain(newPassword)

    await act(async () => pending.resolve())

    expect(useAuthStore.getState().auth.accessToken).toBe('')
    expect(useAuthStore.getState().auth.user).toBeNull()
    expect(view.queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(mocks.success).toHaveBeenCalledWith(
      'Password changed. Sign in again with your new password.'
    )
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: '/sign-in',
      search: { redirect: '/settings' },
      replace: true,
    })
    expect(view.getByLabelText('New password')).toHaveValue('')
  })

  it.each(['success', 'failure'] as const)(
    'ignores a late %s after an account switch and clears the old form',
    async (outcome) => {
      const pending = deferred<void>()
      mocks.changePassword.mockReturnValue(pending.promise)
      const view = renderPanel()
      fillForm(view)
      await userEvent.click(
        view.getByRole('button', { name: 'Change password' })
      )
      const signal = mocks.changePassword.mock.calls[0]?.[1]
        .signal as AbortSignal
      await act(async () => {
        useAuthStore
          .getState()
          .auth.setSession({ ...user, id: 'reader-2' }, 'new.jwt')
      })
      view.queryClient.setQueryData(['new-account-data'], { id: 'reader-2' })
      expect(signal.aborted).toBe(true)
      expect(view.getByLabelText('Current password')).toHaveValue('')
      expect(view.getByLabelText('New password')).toHaveValue('')
      await act(async () => {
        if (outcome === 'success') pending.resolve()
        else pending.reject(new Error('old request failed'))
      })
      expect(useAuthStore.getState().auth.accessToken).toBe('new.jwt')
      expect(view.queryClient.getQueryData(['new-account-data'])).toEqual({
        id: 'reader-2',
      })
      expect(mocks.navigate).not.toHaveBeenCalled()
      expect(mocks.success).not.toHaveBeenCalled()
      expect(view.queryByRole('alert')).not.toBeInTheDocument()
    }
  )

  it('treats a new session with the same token as a new form', async () => {
    const pending = deferred<void>()
    mocks.changePassword.mockReturnValue(pending.promise)
    const view = renderPanel()
    fillForm(view)
    await userEvent.click(view.getByRole('button', { name: 'Change password' }))
    await act(async () =>
      useAuthStore.getState().auth.setSession(user, 'reader.jwt')
    )
    await act(async () => pending.resolve())
    expect(useAuthStore.getState().auth.accessToken).toBe('reader.jwt')
    expect(view.getByLabelText('Current password')).toHaveValue('')
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('does not submit old form values if the session changes during asynchronous validation', async () => {
    const view = renderPanel()
    fillForm(view)
    await act(async () => {
      fireEvent.submit(view.getByRole('form', { name: 'Change password' }))
      useAuthStore
        .getState()
        .auth.setSession({ ...user, id: 'reader-2' }, 'new.jwt')
    })
    expect(mocks.changePassword).not.toHaveBeenCalled()
    expect(view.getByLabelText('Current password')).toHaveValue('')
    expect(view.getByLabelText('New password')).toHaveValue('')
  })

  it('aborts on unmount and ignores a transport that resolves anyway', async () => {
    const pending = deferred<void>()
    mocks.changePassword.mockReturnValue(pending.promise)
    const view = renderPanel()
    fillForm(view)
    await userEvent.click(view.getByRole('button', { name: 'Change password' }))
    const signal = mocks.changePassword.mock.calls[0]?.[1].signal as AbortSignal
    view.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => pending.resolve())
    expect(useAuthStore.getState().auth.accessToken).toBe('reader.jwt')
    expect(mocks.navigate).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
  })
})
