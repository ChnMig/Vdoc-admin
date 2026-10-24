import { useId, useRef } from 'react'
import { FileText, Upload, X } from 'lucide-react'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function DraftFileField({
  file,
  onChange,
}: {
  readonly file?: File
  readonly onChange: (file?: File) => void
}) {
  const { t } = useLanguage()
  const inputId = useId()
  const hintId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className='grid min-w-0 gap-2'>
      <Label htmlFor={inputId}>{t('admin.fields.schemaFile')}</Label>
      <div className='grid min-w-0 gap-3 rounded-md border border-dashed bg-muted/25 p-3'>
        <input
          ref={inputRef}
          id={inputId}
          name='schema_file'
          type='file'
          className='sr-only'
          tabIndex={-1}
          aria-describedby={hintId}
          accept='.yaml,.yml,.json,.md,.txt,text/markdown,text/plain,application/json,application/yaml,text/yaml'
          onChange={(event) => {
            const nextFile = event.currentTarget.files?.[0]
            if (nextFile) onChange(nextFile)
            event.currentTarget.value = ''
          }}
        />
        <div className='flex flex-wrap items-center gap-3'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => inputRef.current?.click()}
          >
            <Upload className='size-4' />
            {t('admin.draftEditor.chooseFile')}
          </Button>
          {!file && (
            <span className='text-sm text-muted-foreground'>
              {t('admin.draftEditor.noFile')}
            </span>
          )}
        </div>
        {file && (
          <div className='flex min-w-0 items-start gap-2 rounded-md border bg-background p-2 text-sm'>
            <FileText className='mt-1 size-4 shrink-0 text-muted-foreground' />
            <span className='min-w-0 flex-1 py-1 break-all'>{file.name}</span>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => onChange(undefined)}
            >
              <X className='size-4' />
              {t('admin.draftEditor.removeFile')}
            </Button>
          </div>
        )}
        <p id={hintId} className='text-xs leading-5 text-muted-foreground'>
          {t('admin.draftEditor.fileHint')}
        </p>
      </div>
    </div>
  )
}
