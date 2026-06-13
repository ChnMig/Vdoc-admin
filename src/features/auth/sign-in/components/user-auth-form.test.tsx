import type { ReactNode } from 'react'
import { render, type RenderResult, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserAuthForm } from './user-auth-form'

const FORM_MESSAGES = {
  emailEmpty: 'Please enter your email.',
  passwordEmpty: 'Please enter your password.',
  passwordShort: 'Password must be at least 7 characters long.',
} as const

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setUser: vi.fn(),
  setAccessToken: vi.fn(),
  login: vi.fn(),
}))

vi.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    auth: {
      setUser: mocks.setUser,
      setAccessToken: mocks.setAccessToken,
    },
  }),
}))

vi.mock('@/lib/vdoc-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/vdoc-api')>()),
  login: mocks.login,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    Link: ({
      children,
      to,
      className,
      ...rest
    }: {
      children?: ReactNode
      to: string
      className?: string
    }) => (
      <a href={to} className={className} {...rest}>
        {children}
      </a>
    ),
  }
})

describe('UserAuthForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.login.mockResolvedValue({
      token: 'vdoc-session-token',
      user: {
        id: 'user-1',
        email: 'a@b.com',
        name: 'Vdoc User',
        is_super_admin: true,
        status: 1,
      },
    })
  })

  describe('Rendering without redirectTo', () => {
    let screen: RenderResult
    let emailInput: HTMLElement
    let passwordInput: HTMLElement
    let signInButton: HTMLElement

    beforeEach(async () => {
      screen = await render(<UserAuthForm />)
      emailInput = screen.getByRole('textbox', { name: /^Email$/i })
      passwordInput = screen.getByLabelText(/^Password$/i)
      signInButton = screen.getByRole('button', { name: /Sign in/i })
    })

    it('renders fields and submit button', async () => {
      expect(emailInput).toBeInTheDocument()
      expect(passwordInput).toBeInTheDocument()
      expect(signInButton).toBeInTheDocument()
    })

    it('shows validation messages when submitting empty form', async () => {
      await userEvent.click(signInButton)

      expect(
        await screen.findByText(FORM_MESSAGES.emailEmpty)
      ).toBeInTheDocument()
      expect(
        await screen.findByText(FORM_MESSAGES.passwordEmpty)
      ).toBeInTheDocument()
    })

    it('authenticates through Vdoc and navigates to default route on success', async () => {
      await userEvent.type(emailInput, 'a@b.com')
      await userEvent.type(passwordInput, '1234567')

      await userEvent.click(signInButton)

      await waitFor(() => expect(mocks.login).toHaveBeenCalledOnce())
      expect(mocks.login).toHaveBeenCalledWith({
        email: 'a@b.com',
        password: '1234567',
      })
      expect(mocks.setUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'a@b.com' })
      )
      expect(mocks.setAccessToken).toHaveBeenCalledWith('vdoc-session-token')

      await waitFor(() =>
        expect(mocks.navigate).toHaveBeenCalledWith({ to: '/', replace: true })
      )
    })
  })

  it('navigates to redirectTo when provided', async () => {
    const { getByRole, getByLabelText } = await render(
      <UserAuthForm redirectTo='/settings' />
    )

    await userEvent.type(getByRole('textbox', { name: /Email/i }), 'a@b.com')
    await userEvent.type(getByLabelText('Password'), '1234567')

    await userEvent.click(getByRole('button', { name: /Sign in/i }))

    await waitFor(() => expect(mocks.setUser).toHaveBeenCalledOnce())
    expect(mocks.setAccessToken).toHaveBeenCalledOnce()

    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: '/settings',
        replace: true,
      })
    )
  })
})
