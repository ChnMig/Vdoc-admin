import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { getDocumentImage } from '@/lib/document-images-api'
import { managedImageId } from '@/lib/markdown-image'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'

export type MarkdownImageLoader = (
  assetId: string,
  signal: AbortSignal
) => Promise<Blob>
const ImageContext = createContext<MarkdownImageLoader | undefined>(undefined)

export function MarkdownImageProvider({
  loadImage,
  children,
}: {
  loadImage?: MarkdownImageLoader
  children: ReactNode
}) {
  return (
    <ImageContext.Provider value={loadImage}>{children}</ImageContext.Provider>
  )
}

export function AuthenticatedMarkdownImages({
  projectId,
  documentId,
  children,
}: {
  projectId: string
  documentId?: string
  children: ReactNode
}) {
  const session = useAuthStore((state) => state.auth.sessionVersion)
  const loadImage = useCallback<MarkdownImageLoader>(
    (assetId, signal) => {
      if (
        !documentId ||
        useAuthStore.getState().auth.sessionVersion !== session
      )
        return Promise.reject(new Error('Image scope is unavailable'))
      return getDocumentImage(projectId, documentId, assetId, signal)
    },
    [projectId, documentId, session]
  )
  return (
    <MarkdownImageProvider loadImage={documentId ? loadImage : undefined}>
      {children}
    </MarkdownImageProvider>
  )
}

export function ManagedMarkdownImage({
  src,
  alt,
  title,
}: {
  src?: string
  alt?: string
  title?: string
}) {
  const loadImage = useContext(ImageContext)
  const assetId = src ? managedImageId(src) : undefined
  // Remote images remain disabled, including in AI output and untrusted shares.
  if (!assetId) return null
  return (
    <LoadedImage
      key={assetId}
      assetId={assetId}
      loadImage={loadImage}
      alt={alt}
      title={title}
    />
  )
}

function LoadedImage({
  assetId,
  loadImage,
  alt,
  title,
}: {
  assetId: string
  loadImage?: MarkdownImageLoader
  alt?: string
  title?: string
}) {
  const { t } = useLanguage()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{
    loader: MarkdownImageLoader
    attempt: number
    url?: string
    failed?: boolean
  }>()
  const current =
    result?.loader === loadImage && result?.attempt === attempt
      ? result
      : undefined
  useEffect(() => {
    if (!loadImage) return
    const controller = new AbortController()
    let objectUrl: string | undefined
    void loadImage(assetId, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setResult({ loader: loadImage, attempt, url: objectUrl })
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ loader: loadImage, attempt, failed: true })
      })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [assetId, loadImage, attempt])
  if (current?.url)
    return (
      <img
        src={current.url}
        alt={alt ?? ''}
        title={title}
        loading='lazy'
        decoding='async'
        referrerPolicy='no-referrer'
        className='my-4 h-auto max-h-[70svh] max-w-full rounded-md object-contain'
      />
    )
  return (
    <span
      className='my-3 inline-flex max-w-full flex-wrap items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground'
      role='status'
    >
      <span>
        {alt ? `${alt} — ` : ''}
        {t(
          current?.failed || !loadImage ? 'images.loadFailed' : 'images.loading'
        )}
      </span>
      {current?.failed && (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={() => setAttempt((value) => value + 1)}
        >
          {t('images.retry')}
        </Button>
      )}
    </span>
  )
}
