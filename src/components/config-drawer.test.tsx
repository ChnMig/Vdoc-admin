import { clearCookies } from '@/test-utils/cookies'
import {
  render,
  type RenderResult,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCookie, setCookie } from '@/lib/cookies'
import { DirectionProvider } from '@/context/direction-provider'
import { LayoutProvider } from '@/context/layout-provider'
import { ThemeProvider } from '@/context/theme-provider'
import { SidebarProvider } from '@/components/ui/sidebar'
import { ConfigDrawer } from './config-drawer'

async function renderConfigDrawer({
  sidebarDefaultOpen = true,
}: {
  sidebarDefaultOpen?: boolean
} = {}) {
  return await render(
    <DirectionProvider>
      <ThemeProvider>
        <LayoutProvider>
          <SidebarProvider defaultOpen={sidebarDefaultOpen}>
            <ConfigDrawer />
          </SidebarProvider>
        </LayoutProvider>
      </ThemeProvider>
    </DirectionProvider>
  )
}

async function openDrawer(screen: RenderResult) {
  await userEvent.click(
    screen.getByRole('button', { name: /^Open theme settings$/i })
  )
  expect(screen.getByText(/^Theme Settings$/i)).toBeInTheDocument()
}

describe('ConfigDrawer (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    clearCookies()

    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.removeAttribute('dir')
  })

  it('opens the drawer and renders the sections', async () => {
    const screen = await renderConfigDrawer()

    await openDrawer(screen)

    const drawer = screen.getByRole('dialog', { name: /theme settings/i })

    expect(drawer).toBeInTheDocument()

    expect(within(drawer).getByText(/^Theme$/i)).toBeInTheDocument()
    expect(within(drawer).getByText(/^Layout$/i)).toBeInTheDocument()
    expect(within(drawer).getAllByText(/^Sidebar$/i).length).toBeGreaterThan(0)
    expect(within(drawer).getByText(/^Direction$/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /reset all settings to default values/i,
      })
    ).toBeInTheDocument()
  })

  describe('theme preference', () => {
    it('applies light theme to <html> and cookie', async () => {
      const screen = await renderConfigDrawer()
      await openDrawer(screen)
      await userEvent.click(
        screen.getByRole('radio', { name: /select light/i })
      )
      await waitFor(() =>
        expect(document.documentElement.classList.contains('light')).toBe(true)
      )
      expect(getCookie('vite-ui-theme')).toBe('light')
    })

    it('applies dark theme to <html> and cookie', async () => {
      const screen = await renderConfigDrawer()
      await openDrawer(screen)
      await userEvent.click(screen.getByRole('radio', { name: /select dark/i }))
      await waitFor(() =>
        expect(document.documentElement.classList.contains('dark')).toBe(true)
      )
      expect(getCookie('vite-ui-theme')).toBe('dark')
    })

    it('applies system theme: stores cookie and applies a resolved light or dark class', async () => {
      // Pre-seed light so mounted theme is not system; re-selecting System alone would not fire setTheme.
      setCookie('vite-ui-theme', 'light')

      const screen = await renderConfigDrawer()
      await openDrawer(screen)

      await userEvent.click(
        screen.getByRole('radio', { name: /select system/i })
      )
      await waitFor(() => expect(getCookie('vite-ui-theme')).toBe('system'))
      await waitFor(() => {
        const root = document.documentElement
        const hasLight = root.classList.contains('light')
        const hasDark = root.classList.contains('dark')
        expect(hasLight !== hasDark).toBe(true)
      })
    })
  })

  describe('sidebar variant', () => {
    it('selecting floating updates layout_variant cookie', async () => {
      const screen = await renderConfigDrawer()
      await openDrawer(screen)

      await userEvent.click(
        screen.getByRole('radio', { name: /select floating/i })
      )
      await waitFor(() => expect(getCookie('layout_variant')).toBe('floating'))
    })

    it('selecting sidebar updates layout_variant cookie', async () => {
      const screen = await renderConfigDrawer()
      await openDrawer(screen)

      await userEvent.click(
        screen.getByRole('radio', { name: /^select sidebar$/i })
      )
      await waitFor(() => expect(getCookie('layout_variant')).toBe('sidebar'))
    })

    it('selecting inset updates layout_variant cookie after another variant', async () => {
      const screen = await renderConfigDrawer()
      await openDrawer(screen)

      await userEvent.click(
        screen.getByRole('radio', { name: /select floating/i })
      )
      await waitFor(() => expect(getCookie('layout_variant')).toBe('floating'))

      await userEvent.click(
        screen.getByRole('radio', { name: /select inset/i })
      )
      await waitFor(() => expect(getCookie('layout_variant')).toBe('inset'))
    })
  })

  it('selecting full layout sets collapsible to offcanvas and closes sidebar', async () => {
    const screen = await renderConfigDrawer({ sidebarDefaultOpen: true })
    await openDrawer(screen)

    await userEvent.click(
      screen.getByRole('radio', { name: /select full layout/i })
    )
    await waitFor(() =>
      expect(getCookie('layout_collapsible')).toBe('offcanvas')
    )
    await waitFor(() => expect(getCookie('sidebar_state')).toBe('false'))
  })

  describe('section reset buttons', () => {
    it('resets theme via section control after choosing dark', async () => {
      const screen = await renderConfigDrawer()
      await openDrawer(screen)

      await userEvent.click(screen.getByRole('radio', { name: /select dark/i }))
      await waitFor(() => expect(getCookie('vite-ui-theme')).toBe('dark'))

      await userEvent.click(
        screen.getByRole('button', {
          name: /reset theme preference to default/i,
        })
      )
      await waitFor(() => expect(getCookie('vite-ui-theme')).toBe('system'))
    })

    it('resets direction via section control after choosing RTL', async () => {
      const screen = await renderConfigDrawer()
      await openDrawer(screen)

      await userEvent.click(
        screen.getByRole('radio', { name: /select right to left/i })
      )
      await waitFor(() =>
        expect(document.documentElement.getAttribute('dir')).toBe('rtl')
      )

      await userEvent.click(
        screen.getByRole('button', {
          name: /reset text direction to default/i,
        })
      )
      await waitFor(() =>
        expect(document.documentElement.getAttribute('dir')).toBe('ltr')
      )
      expect(getCookie('dir')).toBe('ltr')
    })

    it('resets sidebar style via section control after choosing floating', async () => {
      const screen = await renderConfigDrawer()
      await openDrawer(screen)

      await userEvent.click(
        screen.getByRole('radio', { name: /select floating/i })
      )
      await waitFor(() => expect(getCookie('layout_variant')).toBe('floating'))

      await userEvent.click(
        screen.getByRole('button', {
          name: /reset sidebar style to default/i,
        })
      )
      await waitFor(() => expect(getCookie('layout_variant')).toBe('inset'))
    })

    it('resets layout via section control after choosing compact', async () => {
      const screen = await renderConfigDrawer({ sidebarDefaultOpen: true })
      await openDrawer(screen)

      await userEvent.click(
        screen.getByRole('radio', { name: /select compact/i })
      )
      await waitFor(() => expect(getCookie('sidebar_state')).toBe('false'))

      await userEvent.click(
        screen.getByRole('button', {
          name: /reset layout options to default/i,
        })
      )
      await waitFor(() => expect(getCookie('sidebar_state')).toBe('true'))
      await waitFor(() => expect(getCookie('layout_collapsible')).toBe('icon'))
    })
  })

  it('changes direction and applies it to <html dir>', async () => {
    const screen = await renderConfigDrawer()

    await openDrawer(screen)

    await userEvent.click(
      screen.getByRole('radio', { name: /select right to left/i })
    )
    await waitFor(() =>
      expect(document.documentElement.getAttribute('dir')).toBe('rtl')
    )
    expect(getCookie('dir')).toBe('rtl')
  })

  it('updates layout: selecting non-default closes sidebar and changes layout cookie', async () => {
    const screen = await renderConfigDrawer({ sidebarDefaultOpen: true })

    await openDrawer(screen)

    expect(
      screen.getByRole('radio', { name: /select default/i })
    ).toHaveAttribute('data-state', 'checked')

    await userEvent.click(
      screen.getByRole('radio', { name: /select compact/i })
    )

    await waitFor(() => expect(getCookie('sidebar_state')).toBe('false'))
    await waitFor(() => expect(getCookie('layout_collapsible')).toBe('icon'))
  })

  it('reset restores defaults across sidebar/theme/layout/direction', async () => {
    const screen = await renderConfigDrawer({ sidebarDefaultOpen: true })

    await openDrawer(screen)

    await userEvent.click(screen.getByRole('radio', { name: /select dark/i }))
    await userEvent.click(
      screen.getByRole('radio', { name: /select right to left/i })
    )
    await userEvent.click(
      screen.getByRole('radio', { name: /select floating/i })
    )
    await userEvent.click(
      screen.getByRole('radio', { name: /select full layout/i })
    )

    await waitFor(() => expect(getCookie('vite-ui-theme')).toBe('dark'))
    await waitFor(() => expect(getCookie('dir')).toBe('rtl'))
    await waitFor(() => expect(getCookie('layout_variant')).toBe('floating'))
    await waitFor(() =>
      expect(getCookie('layout_collapsible')).toBe('offcanvas')
    )

    await userEvent.click(
      screen.getByRole('button', {
        name: /reset all settings to default values/i,
      })
    )

    await waitFor(() => expect(getCookie('sidebar_state')).toBe('true'))
    await waitFor(() => expect(getCookie('dir')).toBeUndefined())
    await waitFor(() => expect(getCookie('vite-ui-theme')).toBeUndefined())
    await waitFor(() => expect(getCookie('layout_variant')).toBe('inset'))
    await waitFor(() => expect(getCookie('layout_collapsible')).toBe('icon'))
    await waitFor(() =>
      expect(document.documentElement.getAttribute('dir')).toBe('ltr')
    )
  })
})
