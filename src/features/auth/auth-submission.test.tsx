import { act, fireEvent, render, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import type { VdocSession } from '@/lib/vdoc-api'
import { UserAuthForm } from './sign-in/components/user-auth-form'
import { SignUpForm } from './sign-up/components/sign-up-form'

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  navigate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))
vi.mock('@/lib/vdoc-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/vdoc-api')>()),
  login: mocks.login,
  register: mocks.register,
}))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useNavigate: () => mocks.navigate,
}))
vi.mock('sonner', () => ({ toast: { success: mocks.success } }))
vi.mock('@/lib/handle-server-error', () => ({ handleServerError: mocks.error }))

const alice: VdocSession = {
  token: 'alice-token',
  user: {
    id: 'alice',
    name: 'Alice',
    email: 'alice@example.test',
    status: 1,
    is_super_admin: false,
    can_access_audit: false,
  },
}
const bob: VdocSession = {
  token: 'bob-token',
  user: { ...alice.user, id: 'bob', name: 'Bob', email: 'bob@example.test' },
}

function deferred() {
  let resolve!: (value: VdocSession) => void
  let reject!: (error: Error) => void
  const promise = new Promise<VdocSession>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

async function submitForm(
  kind: 'login' | 'register',
  email = alice.user.email
) {
  const view = render(kind === 'login' ? <UserAuthForm /> : <SignUpForm />)
  const fields = within(view.container)
  fireEvent.change(fields.getByLabelText(/^Email$/i), {
    target: { value: email },
  })
  fireEvent.change(fields.getByLabelText(/^Password$/i), {
    target: { value: 'valid-password' },
  })
  if (kind === 'register') {
    fireEvent.change(fields.getByLabelText(/^Confirm Password$/i), {
      target: { value: 'valid-password' },
    })
  }
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() => expect(mocks[kind]).toHaveBeenCalled())
  return {
    ...view,
    button: fields.getByRole('button', {
      name: /sign in to Vdoc|create Vdoc account/i,
    }),
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  useAuthStore.getState().auth.reset()
})
afterEach(() => {
  act(() => useAuthStore.getState().auth.reset())
})

it.each(['login', 'register'] as const)(
  'cancels an unmounted %s and ignores its late success and failure',
  async (kind) => {
    for (const outcome of ['success', 'failure']) {
      const pending = deferred()
      mocks[kind].mockReturnValueOnce(pending.promise)
      const first = await submitForm(kind)
      const signal = mocks[kind].mock.lastCall![1].signal as AbortSignal
      first.unmount()
      expect(signal.aborted).toBe(true)

      mocks.login.mockResolvedValueOnce(bob)
      const second = await submitForm('login', bob.user.email)
      await waitFor(() =>
        expect(useAuthStore.getState().auth.user).toEqual(bob.user)
      )
      const navigations = mocks.navigate.mock.calls.length
      const notifications = mocks.success.mock.calls.length
      await act(async () => {
        if (outcome === 'success') pending.resolve(alice)
        else pending.reject(new Error('Old credentials rejected'))
      })
      expect(useAuthStore.getState().auth.accessToken).toBe(bob.token)
      expect(useAuthStore.getState().auth.user).toEqual(bob.user)
      expect(mocks.navigate).toHaveBeenCalledTimes(navigations)
      expect(mocks.success).toHaveBeenCalledTimes(notifications)
      expect(mocks.error).not.toHaveBeenCalled()
      second.unmount()
    }
  }
)

it('keeps a newer login intent even while it is still pending', async () => {
  const old = deferred(),
    current = deferred()
  mocks.register.mockReturnValueOnce(old.promise)
  mocks.login.mockReturnValueOnce(current.promise)
  const first = await submitForm('register')
  const second = await submitForm('login', bob.user.email)
  expect(mocks.register.mock.lastCall![1].signal.aborted).toBe(true)
  await act(async () => {
    old.resolve(alice)
  })
  expect(useAuthStore.getState().auth.user).toBeNull()
  expect(mocks.navigate).not.toHaveBeenCalled()
  expect(first.button).toBeEnabled()
  expect(second.button).toBeDisabled()
  await act(async () => {
    current.resolve(bob)
  })
  expect(useAuthStore.getState().auth.user).toEqual(bob.user)
  expect(mocks.navigate).toHaveBeenCalledOnce()
  expect(second.button).toBeEnabled()
})

it.each(['reset', 'resetAccessToken', 'same-token session'] as const)(
  'discards a pending login after %s',
  async (action) => {
    useAuthStore.getState().auth.setSession(alice.user, alice.token)
    const pending = deferred()
    mocks.login.mockReturnValueOnce(pending.promise)
    const view = await submitForm('login')
    act(() => {
      if (action === 'same-token session')
        useAuthStore.getState().auth.setSession(bob.user, alice.token)
      else useAuthStore.getState().auth[action]()
    })
    const expected = useAuthStore.getState().auth
    await act(async () => {
      pending.resolve(alice)
    })
    expect(useAuthStore.getState().auth).toBe(expected)
    expect(mocks.navigate).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(view.button).toBeEnabled()
  }
)

it('reports a current registration error and allows retry', async () => {
  const failure = new Error('Registration closed')
  mocks.register.mockRejectedValueOnce(failure)
  const view = await submitForm('register')
  await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(failure))
  expect(view.button).toBeEnabled()
  expect(useAuthStore.getState().auth.user).toBeNull()
  mocks.register.mockResolvedValueOnce(alice)
  fireEvent.submit(view.container.querySelector('form')!)
  await waitFor(() =>
    expect(useAuthStore.getState().auth.user).toEqual(alice.user)
  )
  expect(mocks.navigate).toHaveBeenCalledOnce()
})

it('does not report an old navigation failure after switching sessions', async () => {
  let rejectNavigation!: (error: Error) => void
  mocks.navigate.mockReturnValueOnce(
    new Promise<void>((_, reject) => {
      rejectNavigation = reject
    })
  )
  mocks.login.mockResolvedValueOnce(alice)
  await submitForm('login')
  await waitFor(() => expect(mocks.navigate).toHaveBeenCalledOnce())
  act(() => useAuthStore.getState().auth.setSession(bob.user, bob.token))
  await act(async () => {
    rejectNavigation(new Error('Old navigation failed'))
  })
  expect(mocks.error).not.toHaveBeenCalled()
  expect(useAuthStore.getState().auth.user).toEqual(bob.user)
})
