import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageProvider } from '@/context/language-provider'
import { AuditRetentionPanel } from './audit-retention-panel'

const api = vi.hoisted(() => ({
  getAuditRetention: vi.fn(),
  updateAuditRetention: vi.fn(),
}))
vi.mock('@/lib/vdoc-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/vdoc-api')>()),
  ...api,
}))
beforeEach(() => {
  vi.resetAllMocks()
  useAuthStore.getState().auth.reset()
  api.getAuditRetention.mockResolvedValue({ audit_retention_days: 30 })
  api.updateAuditRetention.mockImplementation(async (value) => {
    api.getAuditRetention.mockResolvedValue(value)
    return value
  })
})
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const view = render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <LanguageProvider>
          <AuditRetentionPanel />
        </LanguageProvider>
      </QueryClientProvider>
    </StrictMode>
  )
  return { ...view, user: userEvent.setup(), client }
}
it('loads the current value and saves zero, with a clear permanent-deletion explanation', async () => {
  const view = setup()
  const input = await view.findByLabelText('Retention (days)')
  expect(input).toHaveValue('30')
  expect(view.getByRole('button', { name: 'Save retention' })).toBeDisabled()
  await view.user.clear(input)
  await view.user.type(input, '0')
  expect(view.getByText(/Saving 0 stops retaining/)).toBeVisible()
  await view.user.click(view.getByRole('button', { name: 'Save retention' }))
  await view.findByText(/Saved for all users/)
  expect(api.updateAuditRetention).toHaveBeenCalledWith(
    { audit_retention_days: 0 },
    { signal: expect.any(AbortSignal) }
  )
  expect(input).toHaveValue('0')
})
it('rejects blank, negative, fractional and oversized values without a request', async () => {
  const view = setup()
  const input = await view.findByLabelText('Retention (days)')
  for (const value of ['', '-1', '1.5', '36501', '1e2']) {
    await view.user.clear(input)
    if (value) await view.user.type(input, value)
    await view.user.click(view.getByRole('button', { name: 'Save retention' }))
    expect(view.getByRole('alert')).toHaveTextContent('Enter a whole number')
  }
  expect(api.updateAuditRetention).not.toHaveBeenCalled()
})
it('keeps an unsaved value after failure and retries successfully', async () => {
  api.updateAuditRetention.mockRejectedValueOnce(new Error('offline'))
  const view = setup()
  const input = await view.findByLabelText('Retention (days)')
  await view.user.clear(input)
  await view.user.type(input, '1')
  await view.user.click(view.getByRole('button', { name: 'Save retention' }))
  await view.findByText(/Could not save/)
  expect(input).toHaveValue('1')
  await view.user.click(view.getByRole('button', { name: 'Save retention' }))
  await view.findByText(/Saved for all users/)
})
it('recovers from a load failure', async () => {
  api.getAuditRetention.mockRejectedValue(new Error('offline'))
  const view = setup()
  await view.findByText(/Could not load/)
  api.getAuditRetention.mockResolvedValue({ audit_retention_days: 1 })
  await view.user.click(view.getByRole('button', { name: 'Try again' }))
  expect(await view.findByLabelText('Retention (days)')).toHaveValue('1')
})
it('aborts and ignores a save response from an earlier session', async () => {
  let resolve!: (value: { audit_retention_days: number }) => void
  api.updateAuditRetention.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done
      })
  )
  const view = setup()
  const input = await view.findByLabelText('Retention (days)')
  await view.user.clear(input)
  await view.user.type(input, '0')
  await view.user.click(view.getByRole('button', { name: 'Save retention' }))
  const signal = api.updateAuditRetention.mock.calls[0][1].signal as AbortSignal
  await act(async () => useAuthStore.getState().auth.reset())
  await act(async () => resolve({ audit_retention_days: 0 }))
  expect(signal.aborted).toBe(true)
  await waitFor(() =>
    expect(view.getByLabelText('Retention (days)')).toHaveValue('30')
  )
  expect(view.queryByText(/Saved for all users/)).not.toBeInTheDocument()
})
