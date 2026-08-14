import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import '@/styles/index.css'
import { MarkdownDocumentViewer } from '@/features/public-share/markdown-document-viewer'
import { OpenApiCodeViewer } from '@/features/public-share/openapi-code-viewer'

const markdown = `# Markdown document

This fixture proves **GFM**, long-line wrapping, and safe links.

- [x] Reviewed
- [ ] Published

[Documentation](https://example.test/docs)

![blocked remote image](https://example.test/remote.png)

<script data-unsafe-fixture>window.fixtureUnsafe = true</script>

| Method | Path |
| --- | --- |
| GET | /api/v1/open/document-shares/0123456789abcdef0123456789abcdef/versions/abcdef0123456789abcdef0123456789/content-with-an-intentionally-unbroken-segment |
`

const openApi = `openapi: 3.1.0
info:
  title: Public fixture
  version: 1.0.0
paths:
  /health:
    get:
      responses:
        '200':
          description: Ready
<script data-unsafe-fixture>window.fixtureUnsafe = true</script>`

export function ViewerFixtures() {
  return (
    <main className='mx-auto grid min-h-svh w-full max-w-5xl gap-5 p-4 sm:p-6 lg:p-8'>
      <header className='grid gap-2'>
        <p className='text-sm font-medium text-primary'>Control Plane</p>
        <h1 className='text-2xl font-semibold tracking-[-0.02em] text-balance'>
          Public viewer fixtures
        </h1>
        <p className='max-w-prose text-sm text-pretty text-muted-foreground'>
          Token-free fixture content for responsive and accessibility checks.
        </p>
      </header>
      <MarkdownDocumentViewer content={markdown} />
      <section className='grid min-w-0 gap-3'>
        <h2 className='text-xl font-semibold'>OpenAPI source</h2>
        <OpenApiCodeViewer content={openApi} />
      </section>
    </main>
  )
}

const root = document.getElementById('root')
if (root !== null) {
  ReactDOM.createRoot(root).render(
    <StrictMode>
      <ViewerFixtures />
    </StrictMode>
  )
}
