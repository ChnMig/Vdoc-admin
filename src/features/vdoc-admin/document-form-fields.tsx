import { useId, useRef, useState } from 'react'
import { FileText, Upload, X } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import type { TFunction } from '@/lib/i18n'
import type { CreateDocumentPayload, DocumentDTO } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DocumentFolderPicker } from './document-folder-picker'
import { NativeSelect } from './page-shared'
import {
  DOCUMENT_TYPE_MARKDOWN,
  DOCUMENT_TYPE_OPENAPI,
  DOCUMENT_TYPE_TEXT,
} from './page-utils'

export function documentTypeFromFilename(filename: string) {
  if (/\.md$/i.test(filename)) return DOCUMENT_TYPE_MARKDOWN
  if (/\.txt$/i.test(filename)) return DOCUMENT_TYPE_TEXT
  if (/\.(yaml|yml|json)$/i.test(filename)) return DOCUMENT_TYPE_OPENAPI
  return undefined
}

export function defaultDocumentFilename(name: string, type: number) {
  if (!name.trim()) return ''
  if (documentTypeFromFilename(name) === type) return name.trim()
  const extension =
    type === DOCUMENT_TYPE_MARKDOWN
      ? '.md'
      : type === DOCUMENT_TYPE_TEXT
        ? '.txt'
        : '.yaml'
  return `${name.trim()}${extension}`
}

async function readUtf8File(file: File, t: TFunction) {
  const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () =>
      reject(reader.error ?? new Error(t('toasts.somethingWrong')))
    reader.readAsArrayBuffer(file)
  })
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      bytes
    )
  } catch {
    throw new Error(t('admin.documentForm.uploadInvalidUtf8'))
  }
}

export type DocumentFormPayload = Extract<
  CreateDocumentPayload,
  { file_name: string }
>

export async function documentPayloadFromFormData(
  formData: FormData,
  t: TFunction
): Promise<DocumentFormPayload> {
  const name = String(formData.get('name') ?? '').trim()
  let fileName = String(formData.get('file_name') ?? '').trim()
  const documentType = Number(
    formData.get('document_type') || DOCUMENT_TYPE_OPENAPI
  )
  if (
    !fileName ||
    /^[.]+$/.test(fileName) ||
    /[/\\]/.test(fileName) ||
    Array.from(fileName).some((character) => {
      const code = character.codePointAt(0)!
      return code < 32 || (code >= 127 && code <= 159)
    })
  )
    throw new Error(t('admin.documentForm.filenameInvalid'))
  if (!fileName.includes('.'))
    fileName = defaultDocumentFilename(fileName, documentType)
  if (documentTypeFromFilename(fileName) !== documentType)
    throw new Error(t('admin.documentForm.filenameTypeMismatch'))
  if (formData.get('initial_file_invalid') === 'true')
    throw new Error(t('admin.documentForm.uploadInvalidExtension'))
  if (formData.get('folder_valid') === 'false')
    throw new Error(t('admin.documentForm.folderUnavailable'))
  const payload: DocumentFormPayload = {
    name,
    description: String(formData.get('description') ?? '').trim(),
    document_type: documentType,
    file_name: fileName,
    folder_id: String(formData.get('folder_id') ?? '') || null,
  }
  const file = formData.get('initial_file')
  if (file instanceof File && file.name) {
    const type = documentTypeFromFilename(file.name)
    if (!type) throw new Error(t('admin.documentForm.uploadInvalidExtension'))
    if (type !== documentType)
      throw new Error(t('admin.documentForm.uploadTypeMismatch'))
    payload.initial_content = {
      content: await readUtf8File(file, t),
      version_name: '0.1.0',
    }
  }
  return payload
}

type DocumentFormFieldsProps = {
  projectId: string
  document?: DocumentDTO
  initialFolderId?: string
  disabled?: boolean
  allowUpload?: boolean
}

export function DocumentFormFields(props: DocumentFormFieldsProps) {
  const sessionVersion = useAuthStore((state) => state.auth.sessionVersion)
  return (
    <ScopedDocumentFormFields
      key={`${sessionVersion}:${props.projectId}:${props.document?.id ?? 'new'}`}
      {...props}
    />
  )
}

function ScopedDocumentFormFields({
  projectId,
  document,
  initialFolderId = '',
  disabled = false,
  allowUpload = !document,
}: DocumentFormFieldsProps) {
  const { t } = useLanguage()
  const [name, setName] = useState(document?.name ?? '')
  const [documentType, setDocumentType] = useState(
    document?.document_type ?? DOCUMENT_TYPE_OPENAPI
  )
  const [customFilename, setCustomFilename] = useState<string | null>(
    document
      ? (document.file_name ?? document.relative_path?.split('/').pop() ?? '')
      : null
  )
  const filenameEdited = useRef(Boolean(document))
  const filename = customFilename ?? defaultDocumentFilename(name, documentType)
  const [folderId, setFolderId] = useState(
    document?.folder_id ?? initialFolderId
  )
  const [file, setFile] = useState<File>()
  const [fileError, setFileError] = useState<string>()
  const filenameId = useId()
  const filenameHintId = useId()
  const nameId = useId()
  const descriptionId = useId()
  const fileId = useId()
  const fileHintId = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const previousPath =
    document?.relative_path?.split('/').slice(0, -1).join('/') ?? ''
  return (
    <div className='grid min-w-0 gap-4'>
      <div className='grid min-w-0 gap-2'>
        <Label htmlFor={nameId}>{t('admin.fields.name')}</Label>
        <Input
          id={nameId}
          name='name'
          required
          disabled={disabled}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      {!document ? (
        <NativeSelect
          name='document_type'
          label={t('admin.fields.type')}
          placeholder={t('admin.types.openapi')}
          value={String(documentType)}
          onChange={(value) => setDocumentType(Number(value))}
          options={[
            {
              value: String(DOCUMENT_TYPE_OPENAPI),
              label: t('admin.types.openapi'),
            },
            {
              value: String(DOCUMENT_TYPE_MARKDOWN),
              label: t('admin.types.markdown'),
            },
            { value: String(DOCUMENT_TYPE_TEXT), label: t('admin.types.text') },
          ]}
          disabled={disabled}
        />
      ) : (
        <input type='hidden' name='document_type' value={documentType} />
      )}
      <div className='grid min-w-0 gap-2'>
        <Label htmlFor={filenameId}>{t('admin.documentForm.filename')}</Label>
        <Input
          id={filenameId}
          name='file_name'
          required
          disabled={disabled}
          value={filename}
          aria-describedby={filenameHintId}
          onChange={(event) => {
            filenameEdited.current = true
            setCustomFilename(event.target.value)
          }}
        />
        <p id={filenameHintId} className='text-xs text-muted-foreground'>
          {t('admin.documentForm.filenameHint')}
        </p>
      </div>
      <DocumentFolderPicker
        key={projectId}
        projectId={projectId}
        value={folderId ?? ''}
        onChange={setFolderId}
        initialPath={document?.folder_id === undefined ? previousPath : ''}
        filename={
          filename.includes('.')
            ? filename
            : defaultDocumentFilename(filename, documentType)
        }
        disabled={disabled}
      />
      {allowUpload && (
        <div className='grid min-w-0 gap-2'>
          <Label htmlFor={fileId}>{t('admin.documentForm.upload')}</Label>
          <input
            type='hidden'
            name='initial_file_invalid'
            value={fileError ? 'true' : 'false'}
          />
          <div className='grid min-w-0 gap-3 rounded-md border border-dashed bg-muted/25 p-3'>
            <input
              ref={fileInput}
              id={fileId}
              type='file'
              name='initial_file'
              className='sr-only'
              tabIndex={-1}
              aria-describedby={fileHintId}
              accept='.yaml,.yml,.json,.md,.txt,text/plain,text/markdown,application/json,application/yaml,text/yaml'
              disabled={disabled}
              onChange={(event) => {
                const selected = event.target.files?.[0]
                setFileError(undefined)
                if (!selected) {
                  setFile(undefined)
                  return
                }
                const inferred = documentTypeFromFilename(selected.name)
                if (!inferred) {
                  setFileError(t('admin.documentForm.uploadInvalidExtension'))
                  event.target.value = ''
                  setFile(undefined)
                  return
                }
                setFile(selected)
                setDocumentType(inferred)
                if (!filenameEdited.current) setCustomFilename(selected.name)
                if (!name.trim()) setName(selected.name.replace(/\.[^.]+$/, ''))
              }}
            />
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='w-fit'
              disabled={disabled}
              onClick={() => fileInput.current?.click()}
            >
              <Upload className='size-4' />
              {t('admin.draftEditor.chooseFile')}
            </Button>
            {(file || fileError) && (
              <div className='flex min-w-0 items-start gap-2 text-sm'>
                {file && <FileText className='mt-1 size-4 shrink-0' />}
                <span className='min-w-0 flex-1 break-all'>{file?.name}</span>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  aria-label={t('admin.documentForm.removeUpload')}
                  disabled={disabled}
                  onClick={() => {
                    if (fileInput.current) {
                      fileInput.current.value = ''
                      fileInput.current.dispatchEvent(
                        new Event('input', { bubbles: true })
                      )
                    }
                    setFile(undefined)
                    setFileError(undefined)
                  }}
                >
                  <X className='size-4' />
                </Button>
              </div>
            )}
            <p
              id={fileHintId}
              className='text-xs leading-5 text-muted-foreground'
            >
              {t('admin.documentForm.uploadHint')}
            </p>
            {fileError && (
              <p role='alert' className='text-sm text-destructive'>
                {fileError}
              </p>
            )}
          </div>
        </div>
      )}
      <div className='grid min-w-0 gap-2'>
        <Label htmlFor={descriptionId}>{t('admin.fields.description')}</Label>
        <Input
          id={descriptionId}
          name='description'
          defaultValue={document?.description ?? ''}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
