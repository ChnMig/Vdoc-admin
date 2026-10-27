import { useEffect, useRef, useState, type RefObject } from 'react'
import { Check, ChevronDown, LoaderCircle, RefreshCw } from 'lucide-react'
import {
  listProjectAIProviderModels,
  listSystemAIProviderModels,
  type AIProviderModelsPayload,
} from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { ProviderScope } from './ai-settings-types'

export function AIModelField({
  id,
  scope,
  projectId,
  defaultValue,
  disabled,
  formRef,
  onModelChange,
}: {
  id: string
  scope: ProviderScope
  projectId?: string
  defaultValue: string
  disabled: boolean
  formRef: RefObject<HTMLFormElement | null>
  onModelChange?: () => void
}) {
  const { t } = useLanguage()
  const [model, setModel] = useState(defaultValue)
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<readonly string[]>([])
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error' | 'credentials'
  >('idle')
  const inputRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const cachedConnection = useRef<string | null>(null)
  const pendingConnection = useRef<string | null>(null)
  const selectedFromList = useRef(false)

  function connection(): AIProviderModelsPayload {
    const data = new FormData(formRef.current ?? undefined)
    const apiKey = String(data.get('api_key') ?? '').trim()
    const timeout = String(data.get('timeout_ms') ?? '').trim()
    return {
      base_url: String(data.get('base_url') ?? '').trim(),
      ...(apiKey ? { api_key: apiKey } : {}),
      ...(timeout ? { timeout_ms: Number(timeout) } : {}),
    }
  }

  useEffect(() => {
    const form = formRef.current
    const invalidate = (event: Event) => {
      const target = event.target
      if (
        !(target instanceof HTMLInputElement) ||
        !['base_url', 'api_key', 'timeout_ms'].includes(target.name)
      )
        return
      generation.current++
      requestRef.current?.abort()
      cachedConnection.current = null
      pendingConnection.current = null
      setModels([])
      setStatus('idle')
    }
    form?.addEventListener('input', invalidate)
    form?.addEventListener('change', invalidate)
    return () => {
      requestRef.current?.abort()
      form?.removeEventListener('input', invalidate)
      form?.removeEventListener('change', invalidate)
    }
  }, [formRef])

  async function loadModels(force = false) {
    if (disabled) return
    const payload = connection()
    if (!payload.base_url) {
      setStatus('credentials')
      return
    }
    // 凭证只用于本次请求及组件内比较，不进入查询缓存或浏览器存储。
    const identity = JSON.stringify(payload)
    if (
      !force &&
      (cachedConnection.current === identity ||
        pendingConnection.current === identity)
    )
      return
    requestRef.current?.abort()
    cachedConnection.current = null
    const controller = new AbortController()
    requestRef.current = controller
    pendingConnection.current = identity
    const sequence = ++generation.current
    const current = () =>
      !controller.signal.aborted &&
      sequence === generation.current &&
      identity === JSON.stringify(connection())
    setStatus('loading')
    setModels([])
    try {
      const result =
        scope === 'project' && projectId
          ? await listProjectAIProviderModels(projectId, payload, {
              signal: controller.signal,
            })
          : await listSystemAIProviderModels(payload, {
              signal: controller.signal,
            })
      if (!current()) return
      setModels(result.models)
      cachedConnection.current = identity
      setStatus('success')
    } catch {
      if (current()) setStatus('error')
    } finally {
      if (sequence === generation.current) {
        requestRef.current = null
        pendingConnection.current = null
      }
    }
  }

  return (
    <div className='grid min-w-0 gap-2'>
      <Label htmlFor={id}>{t('admin.ai.model')}</Label>
      <div className='flex min-w-0 items-center gap-2'>
        <Input
          ref={inputRef}
          id={id}
          name='model'
          value={model}
          onChange={(event) => setModel(event.target.value)}
          disabled={disabled}
          required
          autoComplete='off'
          aria-describedby={`${id}-help`}
        />
        <Popover
          open={open && !disabled}
          onOpenChange={(nextOpen) => {
            setOpen(nextOpen)
            if (nextOpen) void loadModels()
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type='button'
              variant='outline'
              size='icon'
              className='size-9 shrink-0'
              disabled={disabled}
              aria-label={t('admin.ai.browseModels')}
            >
              {status === 'loading' ? (
                <LoaderCircle className='animate-spin' aria-hidden />
              ) : (
                <ChevronDown aria-hidden />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align='end'
            aria-label={t('admin.ai.browseModels')}
            className='w-80 max-w-[calc(100vw-2rem)] p-0'
            onCloseAutoFocus={(event) => {
              if (!selectedFromList.current) return
              event.preventDefault()
              selectedFromList.current = false
              inputRef.current?.focus()
            }}
          >
            <Command>
              <CommandInput
                placeholder={t('admin.ai.searchModels')}
                aria-label={t('admin.ai.searchModels')}
              />
              <CommandList className='max-h-64'>
                {status === 'loading' ? (
                  <p
                    role='status'
                    className='p-4 text-sm text-muted-foreground'
                  >
                    {t('admin.ai.loadingModels')}
                  </p>
                ) : (
                  <CommandEmpty>{t('admin.ai.noModels')}</CommandEmpty>
                )}
                {models.map((id) => (
                  <CommandItem
                    key={id}
                    value={id}
                    disabled={disabled}
                    onSelect={() => {
                      setModel(id)
                      onModelChange?.()
                      selectedFromList.current = true
                      setOpen(false)
                    }}
                  >
                    <span className='min-w-0 flex-1 [overflow-wrap:anywhere]'>
                      {id}
                    </span>
                    {model === id && <Check className='size-4' aria-hidden />}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              className='w-full justify-start rounded-none border-t'
              disabled={disabled || status === 'loading'}
              onClick={() => void loadModels(true)}
            >
              <RefreshCw aria-hidden />
              {t('admin.ai.refreshModels')}
            </Button>
          </PopoverContent>
        </Popover>
      </div>
      <p
        id={`${id}-help`}
        role={status === 'error' ? 'alert' : undefined}
        className='text-xs leading-5 text-muted-foreground'
      >
        {t(
          status === 'error'
            ? 'admin.ai.modelsLoadFailed'
            : status === 'credentials'
              ? 'admin.ai.modelsCredentials'
              : 'admin.ai.modelsHint'
        )}
      </p>
    </div>
  )
}
