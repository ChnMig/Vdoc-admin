import { clearCookies } from '@/test-utils/cookies'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ThemeProvider, useTheme } from './theme-provider'

function systemPreference(initial: boolean) {
  const query: MediaQueryList = Object.assign(new EventTarget(), {
    matches: initial,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  })
  const unsubscribe = vi.spyOn(query, 'removeEventListener')
  vi.spyOn(window, 'matchMedia').mockReturnValue(query)
  return {
    unsubscribe,
    change(dark: boolean) {
      act(() => {
        Object.defineProperty(query, 'matches', { value: dark })
        query.dispatchEvent(new Event('change'))
      })
    },
  }
}

function ThemeStatus() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  return (
    <>
      <output data-testid='theme'>
        {theme} / {resolvedTheme}
      </output>
      <button onClick={() => setTheme('system')}>Follow system</button>
    </>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  clearCookies()
  document.documentElement.classList.remove('light', 'dark')
})

it('keeps context and document classes in sync across system theme changes', () => {
  const system = systemPreference(false)
  const view = render(
    <ThemeProvider>
      <ThemeStatus />
    </ThemeProvider>
  )
  expect(screen.getByTestId('theme')).toHaveTextContent('system / light')
  expect(document.documentElement).toHaveClass('light')
  system.change(true)
  expect(screen.getByTestId('theme')).toHaveTextContent('system / dark')
  expect(document.documentElement).toHaveClass('dark')
  expect(document.documentElement).not.toHaveClass('light')
  system.change(false)
  expect(screen.getByTestId('theme')).toHaveTextContent('system / light')
  expect(document.documentElement).toHaveClass('light')
  view.unmount()
  expect(system.unsubscribe).toHaveBeenCalledWith(
    'change',
    expect.any(Function)
  )
})

it('preserves an explicit theme and uses the latest system preference when switching back', () => {
  const system = systemPreference(true)
  render(
    <ThemeProvider defaultTheme='dark'>
      <ThemeStatus />
    </ThemeProvider>
  )
  system.change(false)
  expect(screen.getByTestId('theme')).toHaveTextContent('dark / dark')
  expect(document.documentElement).toHaveClass('dark')
  fireEvent.click(screen.getByRole('button', { name: 'Follow system' }))
  expect(screen.getByTestId('theme')).toHaveTextContent('system / light')
  expect(document.documentElement).toHaveClass('light')
})
