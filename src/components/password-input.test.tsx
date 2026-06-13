import { useForm } from 'react-hook-form'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { PasswordInput } from './password-input'

describe('PasswordInput', () => {
  it('renders the password input correctly', async () => {
    const { getByPlaceholderText, getByRole } = await render(
      <PasswordInput placeholder='password' />
    )

    const passwordInput = getByPlaceholderText('password')
    const showPasswordButton = getByRole('button', { name: /show password/i })

    expect(passwordInput).toBeInTheDocument()
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(showPasswordButton).toBeVisible()
  })

  it('toggles the password visibility when the show password button is clicked', async () => {
    const { getByPlaceholderText, getByRole } = await render(
      <PasswordInput placeholder='password' />
    )

    const passwordInput = getByPlaceholderText('password')
    const showPasswordButton = getByRole('button', { name: /show password/i })

    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(showPasswordButton).toBeInTheDocument()

    await userEvent.click(showPasswordButton)

    expect(passwordInput).toHaveAttribute('type', 'text')
    const hidePasswordButton = getByRole('button', { name: /hide password/i })
    expect(hidePasswordButton).toBeInTheDocument()

    await userEvent.click(hidePasswordButton)

    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(getByRole('button', { name: /show password/i })).toBeInTheDocument()
  })

  it('disables the show password button when the password input is disabled', async () => {
    const { getByPlaceholderText, getByRole } = await render(
      <PasswordInput placeholder='password' disabled />
    )

    const passwordInput = getByPlaceholderText('password')
    const showPasswordButton = getByRole('button', { name: /show password/i })
    expect(showPasswordButton).toBeDisabled()
    expect(passwordInput).toBeDisabled()
  })

  it('works with FormLabel and react-hook-form field spread', async () => {
    function PasswordInLabeledForm() {
      const form = useForm<{ password: string }>({
        defaultValues: { password: '' },
      })

      return (
        <Form {...form}>
          <form>
            <FormField
              control={form.control}
              name='password'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <PasswordInput {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>
      )
    }

    const { getByLabelText } = await render(<PasswordInLabeledForm />)

    const password = getByLabelText(/^Password$/i)
    expect(password).toHaveAttribute('type', 'password')

    await userEvent.type(password, 'secret-value')

    expect(password).toHaveValue('secret-value')
  })
})
