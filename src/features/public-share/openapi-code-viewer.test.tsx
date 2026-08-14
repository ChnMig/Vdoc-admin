import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OpenApiCodeViewer } from './openapi-code-viewer'

describe('OpenApiCodeViewer', () => {
  it('renders normalized OpenAPI source as escaped wrapped text', () => {
    const content = '<script>alert("secret")</script>\r\nopenapi: 3.1.0'
    const screen = render(<OpenApiCodeViewer content={content} />)

    expect(screen.container.querySelector('script')).not.toBeInTheDocument()
    expect(screen.getByText(/<script>alert/)).toBeInTheDocument()
    expect(screen.getByText(/openapi: 3.1.0/)).toBeInTheDocument()
    expect(screen.container.querySelector('pre')).toHaveClass(
      'whitespace-pre-wrap'
    )
  })
})
