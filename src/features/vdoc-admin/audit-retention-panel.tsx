import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { getAuditRetention, updateAuditRetention } from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AuditRetentionPanel() {
  const sessionVersion = useAuthStore((state) => state.auth.sessionVersion)
  return <RetentionForm key={sessionVersion} sessionVersion={sessionVersion} />
}

function RetentionForm({ sessionVersion }: { sessionVersion: number }) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const queryKey = ['system-audit-retention', sessionVersion] as const
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getAuditRetention({ signal }),
    refetchOnWindowFocus: false,
    retry: false,
  })
  const [draft, setDraft] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<'saved' | 'failed' | 'invalid' | null>(
    null
  )
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  const value = draft ?? String(query.data?.audit_retention_days ?? '')
  const valid = /^\d+$/.test(value) && Number(value) <= 36500
  const changed =
    query.data !== undefined &&
    Number(value) !== query.data.audit_retention_days

  async function save(event: FormEvent) {
    event.preventDefault()
    if (request.current || !query.data) return
    if (!valid) {
      setResult('invalid')
      return
    }
    if (
      !changed ||
      useAuthStore.getState().auth.sessionVersion !== sessionVersion
    )
      return
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setResult(null)
    const ownsSession = () =>
      !controller.signal.aborted &&
      useAuthStore.getState().auth.sessionVersion === sessionVersion
    try {
      const saved = await updateAuditRetention(
        { audit_retention_days: Number(value) },
        { signal: controller.signal }
      )
      if (!ownsSession()) return
      queryClient.setQueryData(queryKey, saved)
      setDraft(null)
      setResult('saved')
      // Audit lists, document activity and MCP usage all derive from this policy.
      void queryClient.invalidateQueries()
    } catch {
      if (ownsSession()) setResult('failed')
    } finally {
      request.current = null
      if (ownsSession()) setPending(false)
    }
  }

  return (
    <section
      className='grid min-w-0 items-start gap-5 rounded-lg border bg-card px-5 py-6 text-card-foreground sm:px-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-8'
      aria-labelledby='audit-retention-title'
    >
      <div className='space-y-2'>
        <h2 id='audit-retention-title' className='font-semibold'>
          {t('admin.settings.retention.title')}
        </h2>
        <p className='text-sm leading-6 text-muted-foreground'>
          {t('admin.settings.retention.description')}
        </p>
      </div>
      {query.isPending ? (
        <p role='status' className='text-sm text-muted-foreground'>
          {t('admin.common.loading')}
        </p>
      ) : query.isError ? (
        <div className='space-y-3'>
          <p role='alert' className='text-sm text-destructive'>
            {t('admin.settings.retention.loadFailed')}
          </p>
          <Button
            variant='outline'
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t('admin.settings.retention.retry')}
          </Button>
        </div>
      ) : (
        <form
          className='grid max-w-xl min-w-0 gap-4'
          onSubmit={(event) => void save(event)}
          noValidate
          aria-busy={pending}
        >
          <div className='grid gap-2'>
            <Label htmlFor='audit-retention-days'>
              {t('admin.settings.retention.label')}
            </Label>
            <Input
              id='audit-retention-days'
              type='text'
              inputMode='numeric'
              className='max-w-40'
              value={value}
              disabled={pending}
              aria-describedby='audit-retention-help audit-retention-impact'
              aria-invalid={result === 'invalid'}
              onChange={(event) => {
                setDraft(event.target.value)
                setResult(null)
              }}
            />
            <p
              id='audit-retention-help'
              className='text-sm leading-6 text-muted-foreground'
            >
              {t('admin.settings.retention.help')}
            </p>
          </div>
          <p id='audit-retention-impact' className='text-sm leading-6'>
            {t(
              valid && Number(value) === 0
                ? 'admin.settings.retention.zero'
                : 'admin.settings.retention.impact'
            )}
          </p>
          <Button
            type='submit'
            className='w-fit'
            disabled={pending || (valid && !changed)}
          >
            {t(
              pending
                ? 'admin.settings.retention.saving'
                : 'admin.settings.retention.save'
            )}
          </Button>
          {result && (
            <p
              role={result === 'saved' ? 'status' : 'alert'}
              className={
                result === 'saved'
                  ? 'text-sm text-muted-foreground'
                  : 'text-sm text-destructive'
              }
            >
              {t(`admin.settings.retention.${result}`)}
            </p>
          )}
        </form>
      )}
    </section>
  )
}
