import { useEffect, useId, useRef, useState } from 'react'
import { ImagePlus, Eye, Code2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { uploadDocumentImage } from '@/lib/document-images-api'
import {
  DOCUMENT_IMAGE_ACCEPT,
  DOCUMENT_IMAGE_MAX_BYTES,
  insertMarkdownImages,
} from '@/lib/markdown-image'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AuthenticatedMarkdownImages } from '@/features/document-reader/markdown-images'
import { MarkdownPreview } from './markdown-preview'

type MarkdownImageEditorProps = {
  id: string
  projectId: string
  documentId: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
  onBusyChange: (pending: boolean) => void
}

export function MarkdownImageEditor(props: MarkdownImageEditorProps) {
  const session = useAuthStore((state) => state.auth.sessionVersion)
  return (
    <MarkdownImageEditorSession
      key={`${session}:${props.projectId}:${props.documentId}`}
      {...props}
      session={session}
    />
  )
}

function MarkdownImageEditorSession({
  id,
  projectId,
  documentId,
  value,
  disabled,
  onChange,
  onBusyChange,
  session,
}: MarkdownImageEditorProps & { session: number }) {
  const { t } = useLanguage()
  const hintId = useId()
  const input = useRef<HTMLInputElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const controller = useRef<AbortController | undefined>(undefined)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const [preview, setPreview] = useState(false)
  useEffect(
    () => () => {
      controller.current?.abort()
      onBusyChange(false)
    },
    [onBusyChange]
  )

  async function insert(files: readonly File[]) {
    if (!files.length || disabled || controller.current) return
    setError(undefined)
    if (
      files.some((file) => !file.size || file.size > DOCUMENT_IMAGE_MAX_BYTES)
    ) {
      setError(t('images.tooLarge'))
      return
    }
    if (
      files.some(
        (file) =>
          file.type && !DOCUMENT_IMAGE_ACCEPT.split(',').includes(file.type)
      )
    ) {
      setError(t('images.invalidType'))
      return
    }
    const request = new AbortController()
    controller.current = request
    const start = textarea.current?.selectionStart ?? value.length
    const end = textarea.current?.selectionEnd ?? start
    const ownsRequest = () =>
      !request.signal.aborted &&
      useAuthStore.getState().auth.sessionVersion === session
    setPending(true)
    onBusyChange(true)
    try {
      const images = []
      for (const file of files) {
        if (!ownsRequest()) return
        images.push(
          await uploadDocumentImage(projectId, documentId, file, request.signal)
        )
      }
      if (!ownsRequest()) return
      const inserted = insertMarkdownImages(value, start, end, images)
      onChange(inserted.content)
      requestAnimationFrame(() => {
        if (!ownsRequest()) return
        textarea.current?.focus()
        textarea.current?.setSelectionRange(inserted.caret, inserted.caret)
      })
    } catch {
      if (ownsRequest()) setError(t('images.uploadFailed'))
    } finally {
      if (controller.current === request) controller.current = undefined
      if (!request.signal.aborted) {
        setPending(false)
        onBusyChange(false)
      }
    }
  }
  const blocked = disabled || pending
  return (
    <div className='grid min-w-0 gap-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          disabled={blocked || preview}
          onClick={() => input.current?.click()}
        >
          <ImagePlus aria-hidden />
          {t(pending ? 'images.uploading' : 'images.insert')}
        </Button>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          disabled={pending}
          aria-pressed={preview}
          onClick={() => setPreview((current) => !current)}
        >
          {preview ? <Code2 aria-hidden /> : <Eye aria-hidden />}
          {t(preview ? 'images.editSource' : 'images.preview')}
        </Button>
      </div>
      <p id={hintId} className='text-xs leading-5 text-muted-foreground'>
        {t('images.hint')}
      </p>
      <input
        ref={input}
        type='file'
        className='sr-only'
        accept={DOCUMENT_IMAGE_ACCEPT}
        multiple
        aria-label={t('images.choose')}
        tabIndex={-1}
        disabled={blocked}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          void insert(files)
        }}
      />
      {error && (
        <Alert variant='destructive'>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {pending && (
        <p role='status' className='text-sm text-muted-foreground'>
          {t('images.uploading')}
        </p>
      )}
      {preview ? (
        <AuthenticatedMarkdownImages
          projectId={projectId}
          documentId={documentId}
        >
          <MarkdownPreview content={value} />
        </AuthenticatedMarkdownImages>
      ) : (
        <Textarea
          ref={textarea}
          id={id}
          value={value}
          disabled={blocked}
          aria-describedby={hintId}
          spellCheck={false}
          className='min-h-72 resize-y bg-card font-mono leading-6 shadow-none dark:bg-card'
          onChange={(event) =>
            onChange(
              value.includes('\r\n') && !/(^|[^\r])\n/.test(value)
                ? event.target.value.replace(/\r?\n/g, '\r\n')
                : event.target.value
            )
          }
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files).filter((file) =>
              file.type.startsWith('image/')
            )
            if (files.length) {
              event.preventDefault()
              void insert(files)
            }
          }}
          onDragOver={(event) => {
            if (Array.from(event.dataTransfer.types).includes('Files'))
              event.preventDefault()
          }}
          onDrop={(event) => {
            const files = Array.from(event.dataTransfer.files)
            if (files.length) {
              event.preventDefault()
              void insert(files)
            }
          }}
        />
      )}
    </div>
  )
}
