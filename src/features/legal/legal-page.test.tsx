import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '@/context/language-provider'
import { LegalPage } from './legal-page'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...props
  }: React.ComponentProps<'a'> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/components/language-switch', () => ({
  LanguageSwitch: () => <button type='button'>Language</button>,
}))

vi.mock('@/components/theme-switch', () => ({
  ThemeSwitch: () => <button type='button'>Theme</button>,
}))

describe('LegalPage', () => {
  it.each([
    ['terms', 'Terms of Service', 'Accounts and access'],
    ['privacy', 'Privacy Policy', 'Data the software processes'],
  ] as const)('renders the public %s route content', (kind, title, section) => {
    const screen = render(
      <LanguageProvider>
        <LegalPage kind={kind} />
      </LanguageProvider>
    )

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: section })).toBeInTheDocument()
    expect(screen.getByText(/Vdoc is self-hosted software/)).toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: /Vdoc Admin|Back to sign in/ })
    ).toHaveLength(2)
  })
})
