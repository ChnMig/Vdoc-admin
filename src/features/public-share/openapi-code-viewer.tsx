export type OpenApiCodeViewerProps = {
  readonly content: string
}

export function OpenApiCodeViewer({ content }: OpenApiCodeViewerProps) {
  return (
    <pre className='max-w-full overflow-x-auto rounded-lg border bg-card p-5 font-mono text-xs leading-5 break-words whitespace-pre-wrap text-card-foreground shadow-[var(--shadow-card)] panel-control sm:p-6'>
      <code>{content.replace(/\r\n?/g, '\n')}</code>
    </pre>
  )
}
