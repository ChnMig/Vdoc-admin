import { StrictMode } from 'react'
import { clearCookies } from '@/test-utils/cookies'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'
import {
  VdocApiError,
  type SystemUpdatesDTO,
  type SystemVersionDTO,
} from '@/lib/vdoc-api'
import { LanguageProvider } from '@/context/language-provider'
import { ReleaseStatusPanel } from './release-status-panel'

const mocks = vi.hoisted(() => ({
  getSystemVersion: vi.fn(),
  checkSystemUpdates: vi.fn(),
  buildInfo: {
    version: 'v0.3.17-beta.4',
    gitCommit: 'abc123',
    buildTime: '2026-10-23T00:00:00Z',
  },
}))

vi.mock('@/lib/build-info', () => ({ adminBuildInfo: mocks.buildInfo }))
vi.mock('@/lib/vdoc-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/vdoc-api')>()),
  getSystemVersion: mocks.getSystemVersion,
  checkSystemUpdates: mocks.checkSystemUpdates,
}))

const originalRuntimeConfig = window.__VDOC_ADMIN_CONFIG__
const user: AuthUser = {
  id: 'admin-1',
  email: 'admin@example.test',
  name: 'Admin',
  is_super_admin: true,
  can_access_audit: true,
  status: 1,
}

function version(overrides: Partial<SystemVersionDTO> = {}): SystemVersionDTO {
  return {
    version: 'v0.3.17-beta.4',
    channel: 'beta',
    git_commit: 'abc123',
    build_time: '2026-10-23T00:00:00Z',
    ...overrides,
  }
}

function update(overrides: Partial<SystemUpdatesDTO> = {}): SystemUpdatesDTO {
  return {
    current_version: 'v0.3.17-beta.4',
    channel: 'beta',
    latest_version: 'v0.3.17-beta.5',
    update_available: true,
    release_url:
      'https://github.com/ChnMig/Vdoc-site/releases/tag/v0.3.17-beta.5',
    published_at: '2026-10-24T00:00:00Z',
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function renderPanel(strict = false) {
  const panel = (
    <LanguageProvider>
      <ReleaseStatusPanel />
    </LanguageProvider>
  )
  return render(strict ? <StrictMode>{panel}</StrictMode> : panel)
}

describe('ReleaseStatusPanel', () => {
  beforeEach(() => {
    clearCookies()
    useAuthStore.getState().auth.reset()
    useAuthStore.getState().auth.setSession(user, 'admin.jwt')
    window.__VDOC_ADMIN_CONFIG__ = { releaseChannel: 'beta' }
    mocks.buildInfo.version = 'v0.3.17-beta.4'
    mocks.getSystemVersion.mockReset().mockResolvedValue(version())
    mocks.checkSystemUpdates.mockReset().mockResolvedValue(update())
  })

  afterEach(() => {
    window.__VDOC_ADMIN_CONFIG__ = originalRuntimeConfig
  })

  it('shows the actual frontend and backend versions without automatically checking updates', async () => {
    const backend = deferred<SystemVersionDTO>()
    mocks.getSystemVersion.mockReturnValueOnce(backend.promise)
    const view = renderPanel()

    expect(view.getByText('Loading backend version…')).toBeVisible()
    expect(view.getByText('v0.3.17-beta.4')).toBeVisible()
    expect(
      view.getByRole('button', { name: 'Check for updates' })
    ).toBeDisabled()
    expect(mocks.checkSystemUpdates).not.toHaveBeenCalled()
    await act(async () => backend.resolve(version()))
    expect(view.getAllByText('v0.3.17-beta.4')).toHaveLength(2)
    expect(view.getByText('Beta')).toBeVisible()
    expect(
      view.getByRole('button', { name: 'Check for updates' })
    ).toBeEnabled()
    fireEvent.focus(window)
    expect(mocks.checkSystemUpdates).not.toHaveBeenCalled()
    expect(mocks.getSystemVersion).toHaveBeenCalledTimes(1)
  })

  it('checks only on click, prevents duplicate dispatch, and links to release notes for manual deployment', async () => {
    const pending = deferred<SystemUpdatesDTO>()
    mocks.checkSystemUpdates.mockReturnValueOnce(pending.promise)
    const view = renderPanel()
    const button = view.getByRole('button', { name: 'Check for updates' })
    await waitFor(() => expect(button).toBeEnabled())
    fireEvent.click(button)
    fireEvent.click(button)

    expect(mocks.checkSystemUpdates).toHaveBeenCalledTimes(1)
    expect(
      view.getByRole('button', { name: 'Checking for updates…' })
    ).toBeDisabled()
    expect(mocks.checkSystemUpdates.mock.calls[0]?.[0]?.signal).toBeInstanceOf(
      AbortSignal
    )
    await act(async () => pending.resolve(update()))

    expect(view.getByRole('status')).toHaveTextContent(
      'A new Beta version is available: v0.3.17-beta.5'
    )
    expect(
      view.getByRole('link', { name: 'View release notes' })
    ).toHaveAttribute(
      'href',
      'https://github.com/ChnMig/Vdoc-site/releases/tag/v0.3.17-beta.5'
    )
    expect(
      view.getByRole('link', { name: 'View release notes' })
    ).toHaveAttribute('rel', 'noopener noreferrer')
    expect(
      view.getByText(
        'Checking only reads release information. Deploy updates manually with Docker Compose.'
      )
    ).toBeVisible()
  })

  it('reports a stable backend as up to date on the stable channel', async () => {
    mocks.buildInfo.version = 'v0.3.17'
    window.__VDOC_ADMIN_CONFIG__ = { releaseChannel: 'release' }
    mocks.getSystemVersion.mockResolvedValue(
      version({ version: 'v0.3.17', channel: 'release' })
    )
    mocks.checkSystemUpdates.mockResolvedValue(
      update({
        current_version: 'v0.3.17',
        channel: 'release',
        latest_version: 'v0.3.17',
        update_available: false,
        release_url: 'https://github.com/ChnMig/Vdoc-site/releases/tag/v0.3.17',
      })
    )
    const view = renderPanel()
    await waitFor(() =>
      expect(
        view.getByRole('button', { name: 'Check for updates' })
      ).toBeEnabled()
    )
    await userEvent.click(
      view.getByRole('button', { name: 'Check for updates' })
    )

    expect(
      await view.findByText('The backend is up to date on the Stable channel.')
    ).toBeVisible()
    expect(view.getByText('Latest version: v0.3.17')).toBeVisible()
    expect(view.getByText('Stable')).toBeVisible()
  })

  it('distinguishes no release from an up-to-date deployment', async () => {
    mocks.checkSystemUpdates.mockResolvedValue(
      update({
        latest_version: null,
        update_available: false,
        release_url: null,
        published_at: null,
      })
    )
    const view = renderPanel()
    await waitFor(() =>
      expect(
        view.getByRole('button', { name: 'Check for updates' })
      ).toBeEnabled()
    )
    await userEvent.click(
      view.getByRole('button', { name: 'Check for updates' })
    )

    expect(
      await view.findByText(
        'No published version was found on the Beta channel.'
      )
    ).toBeVisible()
    expect(view.queryByRole('link')).not.toBeInTheDocument()
    expect(view.getByRole('status')).not.toHaveTextContent('up to date')
  })

  it('keeps network errors local, hides diagnostics, and allows a retry', async () => {
    mocks.checkSystemUpdates
      .mockRejectedValueOnce(new Error('private token diagnostic'))
      .mockResolvedValueOnce(update())
    const view = renderPanel()
    const button = view.getByRole('button', { name: 'Check for updates' })
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.click(button)
    expect(
      await view.findByText('Updates could not be checked. Please try again.')
    ).toBeVisible()
    expect(view.container).not.toHaveTextContent('private token diagnostic')
    expect(useAuthStore.getState().auth.accessToken).toBe('admin.jwt')
    await userEvent.click(button)
    expect(
      await view.findByText('A new Beta version is available: v0.3.17-beta.5')
    ).toBeVisible()
    expect(
      view.queryByText('Updates could not be checked. Please try again.')
    ).not.toBeInTheDocument()
    expect(mocks.checkSystemUpdates).toHaveBeenCalledTimes(2)
  })

  it('shows a backend version failure and lets the user retry before checking updates', async () => {
    mocks.getSystemVersion
      .mockRejectedValueOnce(new Error('private version diagnostics'))
      .mockResolvedValueOnce(version())
    const view = renderPanel()
    expect(
      await view.findByText('The backend version could not be loaded.')
    ).toBeVisible()
    expect(
      view.getByRole('button', { name: 'Check for updates' })
    ).toBeDisabled()
    expect(view.container).not.toHaveTextContent('private version diagnostics')
    await userEvent.click(
      view.getByRole('button', { name: 'Retry loading version' })
    )
    await waitFor(() =>
      expect(
        view.getByRole('button', { name: 'Check for updates' })
      ).toBeEnabled()
    )
    expect(mocks.getSystemVersion).toHaveBeenCalledTimes(2)
    expect(mocks.checkSystemUpdates).not.toHaveBeenCalled()
  })

  it('does not claim a development deployment is up to date', async () => {
    mocks.buildInfo.version = 'dev'
    mocks.getSystemVersion.mockResolvedValue(
      version({ version: 'dev', channel: 'development' })
    )
    const view = renderPanel()
    expect(
      await view.findByText(
        'Development builds cannot check for published updates.'
      )
    ).toBeVisible()
    expect(view.getByText('Development')).toBeVisible()
    expect(
      view.getByRole('button', { name: 'Check for updates' })
    ).toBeDisabled()
    expect(mocks.checkSystemUpdates).not.toHaveBeenCalled()
  })

  it('handles unsupported backend metadata returned during a check', async () => {
    mocks.checkSystemUpdates.mockRejectedValueOnce(
      new VdocApiError({
        code: 412,
        status: 'FAILED_PRECONDITION',
        timestamp: 1,
      })
    )
    const view = renderPanel()
    const button = view.getByRole('button', { name: 'Check for updates' })
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.click(button)
    expect(
      await view.findByText(
        'Development builds cannot check for published updates.'
      )
    ).toBeVisible()
    expect(view.getByRole('status')).not.toHaveTextContent('up to date')
  })

  it.each([
    { version: 'v0.3.17-beta.3', channel: 'beta' as const },
    { version: 'v0.3.17-beta.4', channel: 'release' as const },
  ])(
    'warns about differing frontend and backend deployment metadata: $version / $channel',
    async (metadata) => {
      mocks.getSystemVersion.mockResolvedValue(version(metadata))
      const view = renderPanel()
      expect(
        await view.findByText(
          'The frontend and backend versions or channels differ. Deploy matching versions for consistent behavior.'
        )
      ).toBeVisible()
    }
  )

  it.each([
    { current_version: 'v0.3.17-beta.6' },
    { channel: 'release' as const },
  ])('rejects results from a changed deployment: %o', async (metadata) => {
    mocks.checkSystemUpdates.mockResolvedValue(update(metadata))
    const view = renderPanel()
    const button = view.getByRole('button', { name: 'Check for updates' })
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.click(button)
    expect(
      await view.findByText(
        'The deployment version or channel changed. Refresh this page before checking again.'
      )
    ).toBeVisible()
    expect(view.queryByRole('link')).not.toBeInTheDocument()
  })

  it.each([
    'javascript:alert(1)',
    'https://github.com.evil.test/ChnMig/Vdoc-site/releases/tag/v0.3.17-beta.5',
    'https://user:password@github.com/ChnMig/Vdoc-site/releases/tag/v0.3.17-beta.5',
    'http://github.com/ChnMig/Vdoc-site/releases/tag/v0.3.17-beta.5',
    'https://github.com/other/repo/releases/tag/v0.3.17-beta.5',
    'https://github.com/ChnMig/Vdoc-site/releases/tag/v0.3.18',
  ])(
    'never renders an unexpected release URL as a link: %s',
    async (releaseUrl) => {
      mocks.checkSystemUpdates.mockResolvedValue(
        update({ release_url: releaseUrl })
      )
      const view = renderPanel()
      const button = view.getByRole('button', { name: 'Check for updates' })
      await waitFor(() => expect(button).toBeEnabled())
      await userEvent.click(button)
      expect(
        await view.findByText('A new Beta version is available: v0.3.17-beta.5')
      ).toBeVisible()
      expect(view.queryByRole('link')).not.toBeInTheDocument()
    }
  )

  it('aborts a version request when unmounted and ignores its late response', async () => {
    const pending = deferred<SystemVersionDTO>()
    mocks.getSystemVersion.mockReturnValueOnce(pending.promise)
    const view = renderPanel()
    const signal = mocks.getSystemVersion.mock.calls[0]?.[0]
      ?.signal as AbortSignal
    view.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => pending.resolve(version()))
    expect(mocks.checkSystemUpdates).not.toHaveBeenCalled()
  })

  it('aborts a check at a session boundary and never reuses its late result', async () => {
    const pending = deferred<SystemUpdatesDTO>()
    mocks.checkSystemUpdates.mockReturnValueOnce(pending.promise)
    const view = renderPanel()
    const button = view.getByRole('button', { name: 'Check for updates' })
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.click(button)
    const signal = mocks.checkSystemUpdates.mock.calls[0]?.[0]
      ?.signal as AbortSignal

    act(() =>
      useAuthStore
        .getState()
        .auth.setSession({ ...user, id: 'admin-2' }, 'other.jwt')
    )
    expect(signal.aborted).toBe(true)
    await act(async () => pending.resolve(update()))
    expect(
      view.queryByText('A new Beta version is available: v0.3.17-beta.5')
    ).not.toBeInTheDocument()
    expect(view.queryByRole('link')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(
        view.getByRole('button', { name: 'Check for updates' })
      ).toBeEnabled()
    )
    expect(mocks.checkSystemUpdates).toHaveBeenCalledTimes(1)
  })

  it('aborts an update request when the panel is unmounted', async () => {
    const pending = deferred<SystemUpdatesDTO>()
    mocks.checkSystemUpdates.mockReturnValueOnce(pending.promise)
    const view = renderPanel()
    const button = view.getByRole('button', { name: 'Check for updates' })
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.click(button)
    const signal = mocks.checkSystemUpdates.mock.calls[0]?.[0]
      ?.signal as AbortSignal
    view.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => pending.resolve(update()))
  })

  it('loads the current backend version through Strict Mode effect cleanup', async () => {
    const view = renderPanel(true)
    await waitFor(() =>
      expect(
        view.getByRole('button', { name: 'Check for updates' })
      ).toBeEnabled()
    )
    const firstSignal = mocks.getSystemVersion.mock.calls[0]?.[0]
      ?.signal as AbortSignal
    expect(firstSignal.aborted).toBe(true)
    expect(mocks.getSystemVersion).toHaveBeenCalledTimes(2)
    expect(mocks.checkSystemUpdates).not.toHaveBeenCalled()
  })
})
