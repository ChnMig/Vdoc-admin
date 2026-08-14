import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '@/context/language-provider'
import { SignIn } from './sign-in'
import { SignUp } from './sign-up'

const mocks = vi.hoisted(() => ({
  getAuthConfig: vi.fn(),
}))

vi.mock('@/lib/vdoc-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/vdoc-api')>()),
  getAuthConfig: mocks.getAuthConfig,
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useSearch: () => ({}),
    Link: ({ children, to }: { children?: ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  }
})

vi.mock('./sign-in/components/user-auth-form', () => ({
  UserAuthForm: () => <form aria-label='sign-in-form' />,
}))

vi.mock('./sign-up/components/sign-up-form', () => ({
  SignUpForm: () => <form aria-label='sign-up-form' />,
}))

function renderPage(page: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>{page}</LanguageProvider>
    </QueryClientProvider>
  )
}

describe('registration configuration on auth pages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows registration entry points only when registration is enabled', async () => {
    mocks.getAuthConfig.mockResolvedValue({ registration_enabled: true })

    const signIn = renderPage(<SignIn />)
    expect(
      await signIn.findByRole('link', { name: 'Sign Up' })
    ).toHaveAttribute('href', '/sign-up')
    signIn.unmount()

    const signUp = renderPage(<SignUp />)
    expect(await signUp.findByLabelText('sign-up-form')).toBeInTheDocument()
  })

  it('keeps sign-in available and replaces sign-up with recovery guidance when disabled', async () => {
    mocks.getAuthConfig.mockResolvedValue({ registration_enabled: false })

    const signIn = renderPage(<SignIn />)
    expect(await signIn.findByLabelText('sign-in-form')).toBeInTheDocument()
    expect(
      signIn.queryByRole('link', { name: 'Sign Up' })
    ).not.toBeInTheDocument()
    expect(signIn.getByText(/Registration is disabled/i)).toBeInTheDocument()
    signIn.unmount()

    const signUp = renderPage(<SignUp />)
    expect(
      await signUp.findByText('Registration is unavailable')
    ).toBeInTheDocument()
    expect(signUp.queryByLabelText('sign-up-form')).not.toBeInTheDocument()
    expect(
      await signUp.findByText(
        /use an account created by a system administrator/i
      )
    ).toBeInTheDocument()
  })
})
