import { useEffect, useRef, useState } from 'react'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import {
  revealProjectAIProviderKey,
  revealSystemAIProviderKey,
} from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ProviderScope } from './ai-settings-types'

export function AIAPIKeyField({
  id,
  scope,
  projectId,
  saved,
  disabled,
  onChange,
}: {
  id: string
  scope: ProviderScope
  projectId?: string
  saved: boolean
  disabled: boolean
  onChange?: () => void
}) {
  const { t } = useLanguage()
  const [replacement, setReplacement] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const request = useRef<AbortController | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const usingSaved = saved && replacement === null

  useEffect(() => () => request.current?.abort(), [])

  async function toggleVisibility() {
    if (disabled) return
    if (visible || loading) {
      request.current?.abort()
      setRevealed(null)
      setVisible(false)
      setLoading(false)
      return
    }
    if (!usingSaved) {
      setVisible(true)
      return
    }
    const controller = new AbortController()
    request.current?.abort()
    request.current = controller
    setLoading(true)
    setFailed(false)
    try {
      const result =
        scope === 'project' && projectId
          ? await revealProjectAIProviderKey(projectId, {
              signal: controller.signal,
            })
          : await revealSystemAIProviderKey({ signal: controller.signal })
      if (controller.signal.aborted) return
      setRevealed(result.api_key)
      setVisible(true)
    } catch {
      if (!controller.signal.aborted) setFailed(true)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  return (
    <div className='grid min-w-0 gap-2'>
      <div className='relative flex items-center justify-between gap-2'>
        <Label htmlFor={id}>
          {t(
            scope === 'system'
              ? 'admin.ai.systemApiKey'
              : 'admin.ai.projectApiKey'
          )}
        </Label>
        {saved && (
          <button
            type='button'
            disabled={disabled}
            className='absolute end-0 top-1/2 min-h-6 -translate-y-1/2 rounded-sm text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50'
            onClick={() => {
              request.current?.abort()
              setLoading(false)
              setRevealed(null)
              setVisible(false)
              setFailed(false)
              setReplacement(usingSaved ? '' : null)
              onChange?.()
              if (usingSaved) input.current?.focus()
            }}
          >
            {t(usingSaved ? 'admin.ai.replaceKey' : 'admin.ai.keepSavedKey')}
          </button>
        )}
      </div>
      <div className='relative'>
        <Input
          ref={input}
          id={id}
          name='api_key_display'
          type={visible ? 'text' : 'password'}
          autoComplete='off'
          spellCheck={false}
          className='pe-11 font-mono'
          value={usingSaved ? (revealed ?? '••••••••') : (replacement ?? '')}
          readOnly={usingSaved}
          disabled={disabled}
          required={!saved}
          aria-describedby={`${id}-help`}
          onChange={(event) => setReplacement(event.target.value)}
        />
        <input
          type='hidden'
          name='api_key'
          value={replacement ?? ''}
          disabled={disabled}
        />
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='absolute inset-y-0 end-0.5 my-auto size-8 text-muted-foreground'
          disabled={disabled}
          aria-controls={id}
          aria-pressed={visible}
          aria-label={t(
            loading
              ? 'admin.ai.cancelRevealKey'
              : visible
                ? 'admin.ai.hideKey'
                : 'admin.ai.showKey'
          )}
          onClick={() => void toggleVisibility()}
        >
          {loading ? (
            <LoaderCircle className='animate-spin' aria-hidden />
          ) : visible ? (
            <EyeOff aria-hidden />
          ) : (
            <Eye aria-hidden />
          )}
        </Button>
      </div>
      <p
        id={`${id}-help`}
        role={failed ? 'alert' : undefined}
        className='text-xs leading-5 text-muted-foreground'
      >
        {t(
          failed
            ? 'admin.ai.revealKeyFailed'
            : usingSaved
              ? 'admin.ai.savedKeyHint'
              : 'admin.ai.apiKeyPlaceholder'
        )}
      </p>
    </div>
  )
}
