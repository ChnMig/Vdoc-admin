import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  isRedirect,
} from '@tanstack/react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'
import { requireAuthenticatedUser } from './auth-route'
import { getIdentity, VdocApiError } from './vdoc-api'

vi.mock('./vdoc-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./vdoc-api')>()),
  getIdentity: vi.fn(),
}))

const alice: AuthUser = {
  id: 'alice',
  email: 'alice@example.test',
  name: 'Alice',
  status: 1,
  is_super_admin: true,
  can_access_audit: true,
}
const bob: AuthUser = {
  ...alice,
  id: 'bob',
  email: 'bob@example.test',
  name: 'Bob',
  is_super_admin: false,
  can_access_audit: false,
}
const unauthorized = () =>
  new VdocApiError({ code: 401, status: 'UNAUTHENTICATED', timestamp: 1 })

function signIn(user: AuthUser, token = `${user.id}-token`) {
  const auth = useAuthStore.getState().auth
  auth.reset()
  auth.setUser(user)
  auth.setAccessToken(token)
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function testRouter() {
  const root = createRootRoute()
  const home = createRoute({ getParentRoute: () => root, path: '/' })
  const authenticated = createRoute({
    getParentRoute: () => root,
    id: '_authenticated',
    beforeLoad: ({ location, abortController }) =>
      requireAuthenticatedUser(location.href, abortController.signal),
  })
  const projects = createRoute({
    getParentRoute: () => authenticated,
    path: '/projects',
  })
  const login = createRoute({ getParentRoute: () => root, path: '/sign-in' })
  return createRouter({
    routeTree: root.addChildren([
      home,
      authenticated.addChildren([projects]),
      login,
    ]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  signIn(alice)
})
afterEach(() => useAuthStore.getState().auth.reset())

for (const result of ['success', '401'] as const) {
  it.each([
    ['another account', bob, 'bob-token'],
    [
      'a new session with the same JWT',
      { ...alice, name: 'New Alice' },
      'alice-token',
    ],
  ] as const)(
    `ignores an old preload ${result} after signing in to %s`,
    async (_label, user, token) => {
      const pending = deferred<AuthUser>()
      vi.mocked(getIdentity).mockReturnValue(pending.promise)
      const router = testRouter()
      await router.load()
      const preload = router.preloadRoute({ to: '/projects' })
      await vi.waitFor(() => expect(getIdentity).toHaveBeenCalledOnce())
      await router.navigate({ to: '/sign-in' })
      signIn(user, token)
      await router.navigate({ to: '/' })
      if (result === 'success') pending.resolve(alice)
      else pending.reject(unauthorized())
      await preload
      expect(useAuthStore.getState().auth.user).toEqual(user)
      expect(useAuthStore.getState().auth.accessToken).toBe(token)
      expect(router.state.location.pathname).toBe('/')
    }
  )

  it(`ignores a cancelled route's late ${result} even if transport ignores abort`, async () => {
    const controller = new AbortController()
    const pending = deferred<AuthUser>()
    vi.mocked(getIdentity).mockReturnValue(pending.promise)
    const load = requireAuthenticatedUser('/projects', controller.signal)
    expect(getIdentity).toHaveBeenCalledWith({ signal: controller.signal })
    controller.abort()
    if (result === 'success') pending.resolve({ ...alice, name: 'Stale' })
    else pending.reject(unauthorized())
    await load
    expect(useAuthStore.getState().auth.user).toEqual(alice)
    expect(useAuthStore.getState().auth.accessToken).toBe('alice-token')
  })
}

it('does not restore an identity after signing out without signing back in', async () => {
  const pending = deferred<AuthUser>()
  vi.mocked(getIdentity).mockReturnValue(pending.promise)
  const load = requireAuthenticatedUser(
    '/projects',
    new AbortController().signal
  )
  useAuthStore.getState().auth.reset()
  pending.resolve(alice)
  await load
  expect(useAuthStore.getState().auth.user).toBeNull()
  expect(useAuthStore.getState().auth.accessToken).toBe('')
})

it('updates the current session identity', async () => {
  vi.mocked(getIdentity).mockResolvedValue({ ...alice, name: 'Updated Alice' })
  await requireAuthenticatedUser('/projects', new AbortController().signal)
  expect(useAuthStore.getState().auth.user?.name).toBe('Updated Alice')
  expect(useAuthStore.getState().auth.accessToken).toBe('alice-token')
})

it.each(['missing token', '401'] as const)(
  'redirects the current session on %s',
  async (reason) => {
    if (reason === 'missing token') useAuthStore.getState().auth.reset()
    else vi.mocked(getIdentity).mockRejectedValue(unauthorized())
    const error = await requireAuthenticatedUser(
      '/projects',
      new AbortController().signal
    ).catch((error: unknown) => error)
    expect(isRedirect(error)).toBe(true)
    if (!isRedirect(error)) throw new Error('Expected login redirect')
    expect(error.options).toMatchObject({
      to: '/sign-in',
      search: { redirect: '/projects' },
    })
    expect(useAuthStore.getState().auth.accessToken).toBe('')
    if (reason === 'missing token') expect(getIdentity).not.toHaveBeenCalled()
  }
)

it('keeps the session and surfaces a current network failure', async () => {
  const error = new Error('Network unavailable')
  vi.mocked(getIdentity).mockRejectedValue(error)
  await expect(
    requireAuthenticatedUser('/projects', new AbortController().signal)
  ).rejects.toBe(error)
  expect(useAuthStore.getState().auth.accessToken).toBe('alice-token')
})
