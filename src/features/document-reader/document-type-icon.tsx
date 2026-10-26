import {
  File,
  FileCode2,
  FileJson2,
  FileText,
  type LucideProps,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const DOCUMENT_TYPE_OPENAPI = 1
const DOCUMENT_TYPE_MARKDOWN = 2
const DOCUMENT_TYPE_TEXT = 3

export function DocumentTypeIcon({
  documentType,
  className,
  ...props
}: LucideProps & { documentType?: number }) {
  const Icon =
    documentType === DOCUMENT_TYPE_OPENAPI
      ? FileJson2
      : documentType === DOCUMENT_TYPE_MARKDOWN
        ? FileCode2
        : documentType === DOCUMENT_TYPE_TEXT
          ? FileText
          : File
  const named = Boolean(props['aria-label'] || props['aria-labelledby'])
  return (
    <Icon
      aria-hidden={named ? undefined : true}
      role={named ? 'img' : undefined}
      focusable='false'
      {...props}
      className={cn('size-4 shrink-0', className)}
    />
  )
}
