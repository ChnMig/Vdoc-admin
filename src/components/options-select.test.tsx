import { useState } from 'react'
import { selectOption } from '@/test/select-option'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OptionsSelect } from './options-select'

const options = [
  { value: '', label: 'All projects' },
  { value: 'project-a', label: 'Project A' },
  { value: 'project-b', label: 'Project B' },
]

describe('OptionsSelect', () => {
  it('keeps the popup inside its native dialog and Escape closes only the popup', async () => {
    const user = userEvent.setup()
    render(
      <dialog open aria-label='Assistant'>
        <OptionsSelect aria-label='Session' options={options} />
      </dialog>
    )
    const dialog = screen.getByRole('dialog', { name: 'Assistant' })
    const trigger = screen.getByRole('combobox', { name: 'Session' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const popup = await screen.findByRole('listbox')
    expect(dialog).toContainElement(popup)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(dialog).toHaveAttribute('open')
    expect(trigger).toHaveFocus()
  })

  it('submits the selected value, supports clearing, and resets to its default', async () => {
    const user = userEvent.setup()
    render(
      <form data-testid='form'>
        <label htmlFor='project'>Project</label>
        <OptionsSelect
          id='project'
          name='project_id'
          defaultValue='project-a'
          options={options}
        />
        <button type='reset'>Reset</button>
      </form>
    )
    const form = screen.getByTestId('form') as HTMLFormElement
    const trigger = screen.getByRole('combobox', { name: 'Project' })
    expect(new FormData(form).get('project_id')).toBe('project-a')

    await selectOption(trigger, 'project-b', user)
    expect(new FormData(form).get('project_id')).toBe('project-b')
    await selectOption(trigger, '', user)
    expect(trigger).toHaveTextContent('All projects')
    expect(new FormData(form).get('project_id')).toBe('')
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(trigger).toHaveTextContent('Project A')
    expect(new FormData(form).get('project_id')).toBe('project-a')
  })

  it('validates required choices and excludes a disabled field from form data', async () => {
    const user = userEvent.setup()
    const submit = vi.fn()
    const view = render(
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <OptionsSelect
          aria-label='Project'
          name='project_id'
          options={options}
          required
        />
        <OptionsSelect
          aria-label='Disabled project'
          name='disabled_project'
          defaultValue='project-b'
          options={options}
          disabled
        />
        <button type='submit'>Save</button>
      </form>
    )
    const form = view.container.querySelector('form')!
    expect(form.checkValidity()).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(submit).not.toHaveBeenCalled()
    const trigger = screen.getByRole('combobox', { name: 'Project' })
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Select an option.')
    await selectOption(trigger, 'project-a', user)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(form.checkValidity()).toBe(true)
    expect(new FormData(form).get('project_id')).toBe('project-a')
    expect(new FormData(form).has('disabled_project')).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(submit).toHaveBeenCalledOnce()
  })

  it('focuses the first invalid choice when several required fields are empty', async () => {
    const user = userEvent.setup()
    render(
      <form>
        <OptionsSelect
          aria-label='Project'
          name='project'
          options={options}
          required
        />
        <OptionsSelect
          aria-label='Branch'
          name='branch'
          options={options}
          required
        />
        <button type='submit'>Save</button>
      </form>
    )
    const project = screen.getByRole('combobox', { name: 'Project' })
    const branch = screen.getByRole('combobox', { name: 'Branch' })
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(project).toHaveFocus()
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    await selectOption(project, 'project-a', user)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(branch).toHaveFocus()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('keeps controlled selections and falls back safely when options change', async () => {
    const user = userEvent.setup()
    function Controlled() {
      const [value, setValue] = useState('project-a')
      const [availableOptions, setAvailableOptions] = useState(options)
      return (
        <>
          <OptionsSelect
            aria-label='Project'
            value={value}
            onChange={setValue}
            options={availableOptions}
          />
          <button onClick={() => setAvailableOptions(options.slice(0, 1))}>
            Remove projects
          </button>
        </>
      )
    }
    render(<Controlled />)
    const trigger = screen.getByRole('combobox', { name: 'Project' })
    await selectOption(trigger, 'project-b', user)
    expect(trigger).toHaveTextContent('Project B')
    await user.click(screen.getByRole('button', { name: 'Remove projects' }))
    expect(trigger).toHaveTextContent('All projects')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(
      await screen.findByRole('option', { name: 'All projects' })
    ).toBeVisible()
  })
})
