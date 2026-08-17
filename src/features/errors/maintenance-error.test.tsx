import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '@/context/language-provider'
import { MaintenanceError } from './maintenance-error'

describe('MaintenanceError', () => {
  it('explains that the session is preserved and retries on demand', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    render(
      <LanguageProvider>
        <MaintenanceError onRetry={onRetry} />
      </LanguageProvider>
    )

    expect(
      screen.getByText('Vdoc service is temporarily unavailable')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Your signed-in session is preserved. Restore backend connectivity, then try again.'
      )
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
