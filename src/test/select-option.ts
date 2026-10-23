import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

export async function selectOption(
  control: HTMLElement,
  value: string,
  user = userEvent.setup()
) {
  await user.click(control)
  const option = await waitFor(() => {
    const match = screen
      .getAllByRole('option')
      .find((item) => item.getAttribute('data-value') === value)
    if (!match)
      throw new Error(`No select option has value ${JSON.stringify(value)}`)
    return match
  })
  await user.click(option)
}
