import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DocumentTypeIcon } from './document-type-icon'

describe('document type icon', () => {
  it('stays decorative next to a document name', () => {
    const screen = render(
      <DocumentTypeIcon documentType={3} className='text-primary' />
    )
    expect(screen.container.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
    expect(screen.container.querySelector('svg')).toHaveAttribute(
      'focusable',
      'false'
    )
    expect(screen.container.querySelector('svg')).toHaveClass('text-primary')
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('accepts an accessible name for standalone use and a generic fallback', () => {
    const screen = render(<DocumentTypeIcon aria-label='Document' />)
    expect(screen.getByRole('img', { name: 'Document' })).toHaveClass(
      'lucide-file'
    )
    expect(screen.getByRole('img', { name: 'Document' })).not.toHaveAttribute(
      'aria-hidden'
    )
  })
})
