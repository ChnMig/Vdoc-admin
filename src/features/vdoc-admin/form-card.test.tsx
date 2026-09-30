import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '@/context/language-provider'
import { FormCard } from './page-shared'

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((finish, fail) => {
    resolve = finish
    reject = fail
  })
  return { promise, resolve, reject }
}

describe('FormCard submission ownership', () => {
  it.each(['unchanged', 'new-input', 'changed-scope', 'returned-scope'])(
    'resets only the submitted form without discarding later work: %s',
    async (scenario) => {
      const request = deferred()
      const onSubmit = vi.fn(() => request.promise)
      const onSuccess = vi.fn()
      const card = (scope: string) => (
        <LanguageProvider>
          <FormCard
            title='Create document'
            submitLabel='Create'
            pending={false}
            onSubmit={onSubmit}
            onSuccess={onSuccess}
            submissionScope={scope}
          >
            <input aria-label='Name' name='name' />
          </FormCard>
        </LanguageProvider>
      )
      const view = render(card('project-a'))
      const name = view.getByLabelText('Name')
      fireEvent.change(name, { target: { value: 'Original document' } })
      fireEvent.submit(name.closest('form')!)
      expect(onSubmit).toHaveBeenCalledOnce()
      if (scenario === 'new-input')
        fireEvent.change(name, { target: { value: 'New unsaved document' } })
      if (scenario === 'changed-scope' || scenario === 'returned-scope') {
        view.rerender(card('project-b'))
        if (scenario === 'returned-scope') view.rerender(card('project-a'))
      }
      await act(async () => request.resolve())
      expect(name).toHaveValue(
        scenario === 'unchanged'
          ? ''
          : scenario === 'new-input'
            ? 'New unsaved document'
            : 'Original document'
      )
      expect(onSuccess).toHaveBeenCalledTimes(scenario === 'unchanged' ? 1 : 0)
    }
  )

  it('suppresses an old error after the form scope changes', async () => {
    const request = deferred()
    const card = (scope: string) => (
      <LanguageProvider>
        <FormCard
          title='Create document'
          submitLabel='Create'
          pending={false}
          onSubmit={() => request.promise}
          submissionScope={scope}
        >
          <input aria-label='Name' name='name' />
        </FormCard>
      </LanguageProvider>
    )
    const view = render(card('project-a'))
    fireEvent.submit(view.getByLabelText('Name').closest('form')!)
    view.rerender(card('project-b'))
    await act(async () => request.reject(new Error('Project A failed')))
    expect(view.queryByText('Project A failed')).not.toBeInTheDocument()
  })

  it('does not run success effects after unmounting', async () => {
    const request = deferred()
    const onSuccess = vi.fn()
    const view = render(
      <LanguageProvider>
        <FormCard
          title='Create document'
          submitLabel='Create'
          pending={false}
          onSubmit={() => request.promise}
          onSuccess={onSuccess}
        >
          <input aria-label='Name' name='name' />
        </FormCard>
      </LanguageProvider>
    )
    fireEvent.submit(view.getByLabelText('Name').closest('form')!)
    view.unmount()
    await act(async () => request.resolve())
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
