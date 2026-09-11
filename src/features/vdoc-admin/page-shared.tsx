import { useId, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react'
import { useVdocContextStore } from '@/stores/vdoc-context-store'
import { withNativeSelectPlaceholder } from '@/lib/native-select-options'
import {
  type DiffItemDTO,
  type DiffSummaryDTO,
  type MCPTokenDTO,
  type ProjectDTO,
  type TeamDTO,
} from '@/lib/vdoc-api'
import { useLanguage } from '@/context/language-provider'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { LanguageSwitch } from '@/components/language-switch'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  type PageKey,
  type PageGuidance,
  pageNextRoute,
  contextualHref,
  type QueryState,
  type EmptyStatePreset,
  type SelectOption,
  type ConfirmedAction,
  fieldValue,
  ACTIVE_STATUS,
  changeSeverityLabel,
  diffMessageLabel,
  methodLabel,
  changeTypeLabel,
  jsonPreview,
  tokenIsActive,
  tokenStatusLabel,
  formatDate,
} from './page-utils'

export function PageChrome({
  page,
  children,
  guidance,
}: {
  page: PageKey
  children: React.ReactNode
  guidance?: PageGuidance
}) {
  const { t } = useLanguage()
  const projectId = useVdocContextStore((state) => state.projectId)
  const documentId = useVdocContextStore((state) => state.documentId)
  const resolvedGuidance =
    guidance ??
    ({
      title: t('admin.common.nextAction'),
      description: t(`admin.pages.${page}.next`),
      action: {
        href: pageNextRoute[page],
        label: t('admin.common.openNextAction'),
      },
    } satisfies PageGuidance)
  return (
    <>
      <Header>
        <Search />
        <LanguageSwitch />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        <section className='mb-5 grid gap-4 rounded-lg border bg-card p-5 text-card-foreground shadow-[var(--shadow-card)] panel-control md:grid-cols-[minmax(0,1fr)_21rem]'>
          <div className='grid gap-4'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge
                className='border-primary/20 bg-primary/8 text-primary'
                variant='outline'
              >
                {t(`admin.pages.${page}.stage`)}
              </Badge>
              <span className='font-mono text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase'>
                {t('app.consoleLabel')}
              </span>
            </div>
            <div className='grid gap-2'>
              <h1 className='text-2xl font-semibold tracking-[-0.025em] text-balance'>
                {t(`admin.pages.${page}.title`)}
              </h1>
              <p className='max-w-3xl text-sm leading-6 text-pretty text-muted-foreground'>
                {t(`admin.pages.${page}.description`)}
              </p>
            </div>
            <p className='max-w-3xl border-t pt-3 text-sm text-muted-foreground'>
              {t(`admin.pages.${page}.cue`)}
            </p>
          </div>
          <aside className='grid content-start gap-3 rounded-md border bg-[var(--surface-control)] p-4 text-sm shadow-[var(--shadow-panel)]'>
            <p className='font-mono text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase'>
              {resolvedGuidance.title}
            </p>
            <p className='leading-6 text-muted-foreground'>
              {resolvedGuidance.description}
            </p>
            {resolvedGuidance.action && (
              <Button asChild size='sm' variant='outline' className='w-fit'>
                <a
                  href={contextualHref(
                    resolvedGuidance.action.href,
                    projectId,
                    documentId
                  )}
                >
                  {resolvedGuidance.action.label}
                  <ArrowRight />
                </a>
              </Button>
            )}
          </aside>
        </section>
        <div className='grid gap-5'>{children}</div>
      </Main>
    </>
  )
}

export function LoadingErrorState({ state }: { state: QueryState }) {
  const { t } = useLanguage()
  if (state.isLoading) {
    return (
      <Card>
        <CardContent className='grid gap-3 py-6 text-sm text-muted-foreground'>
          <div className='flex items-center justify-between gap-3'>
            <span>{t('admin.common.loading')}</span>
            <span className='h-2 w-24 rounded-full bg-muted' />
          </div>
          <div className='grid gap-2'>
            <span className='h-2 rounded-full bg-muted/80' />
            <span className='h-2 w-2/3 rounded-full bg-muted/70' />
          </div>
        </CardContent>
      </Card>
    )
  }
  if (state.isError) {
    return (
      <Alert variant='destructive'>
        <AlertCircle />
        <AlertTitle>{t('admin.common.error')}</AlertTitle>
        <AlertDescription>
          {state.error?.message ?? t('toasts.somethingWrong')}
        </AlertDescription>
      </Alert>
    )
  }
  return null
}

export function DeepLinkAlert({ targets }: { targets: string[] }) {
  const { t } = useLanguage()
  if (targets.length === 0) return null
  return (
    <Alert variant='destructive' aria-live='polite'>
      <AlertCircle />
      <AlertTitle>{t('admin.deepLink.invalidTitle')}</AlertTitle>
      <AlertDescription>
        {t('admin.deepLink.invalidDescription', {
          targets: targets.join(', '),
        })}
      </AlertDescription>
    </Alert>
  )
}

export function AccessDeniedPage({ page }: { page: PageKey }) {
  const { t } = useLanguage()
  return (
    <PageChrome page={page}>
      <Alert variant='destructive'>
        <ShieldCheck />
        <AlertTitle>{t('errors.forbiddenTitle')}</AlertTitle>
        <AlertDescription>
          {t('admin.permissions.superAdminOnly')}
        </AlertDescription>
      </Alert>
    </PageChrome>
  )
}

export function EmptyState({ preset }: { preset?: EmptyStatePreset }) {
  const { t } = useLanguage()
  const title = preset
    ? t(`admin.emptyStates.${preset}.title`)
    : t('admin.common.empty')
  const description = preset
    ? t(`admin.emptyStates.${preset}.description`)
    : t('admin.emptyStates.generic.description')
  const action = preset ? t(`admin.emptyStates.${preset}.action`) : undefined
  return (
    <div className='grid gap-4 rounded-lg border border-dashed bg-[var(--surface-control)] p-5 text-sm'>
      <div className='flex items-start gap-3'>
        <span className='mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-primary'>
          <ArrowRight className='size-4' />
        </span>
        <div className='grid gap-2'>
          <p className='font-medium'>{title}</p>
          <p className='max-w-2xl text-muted-foreground'>{description}</p>
        </div>
      </div>
      {action && (
        <div className='rounded-md border bg-background p-3'>
          <p className='font-mono text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase'>
            {t('admin.common.nextAction')}
          </p>
          <p className='mt-1 text-sm'>{action}</p>
        </div>
      )}
    </div>
  )
}

export function NativeSelect({
  id,
  label,
  value,
  options,
  placeholder,
  onChange,
  name,
  defaultValue,
  hint,
  disabled = false,
  required = false,
}: {
  id?: string
  label: string
  value?: string
  options: SelectOption[]
  placeholder: string
  onChange?: (value: string) => void
  name?: string
  defaultValue?: string
  hint?: string
  disabled?: boolean
  required?: boolean
}) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const selectOptions = withNativeSelectPlaceholder(options, placeholder)
  return (
    <div className='grid gap-2'>
      <Label htmlFor={controlId}>{label}</Label>
      <select
        id={controlId}
        name={name}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        disabled={disabled}
        required={required}
        aria-describedby={hint ? `${controlId}-hint` : undefined}
        onChange={(event) => onChange?.(event.currentTarget.value)}
        className='h-9 rounded-md border border-input bg-background/75 px-3 text-sm shadow-[0_1px_1px_oklch(0_0_0_/_4%)] transition-[background-color,border-color,color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-hidden dark:bg-input/25'
      >
        {selectOptions.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={required && option.value === ''}
          >
            {option.label}
          </option>
        ))}
      </select>
      {hint && (
        <p id={`${controlId}-hint`} className='text-sm text-muted-foreground'>
          {hint}
        </p>
      )}
    </div>
  )
}

export function SelectorGrid({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage()
  return (
    <section className='grid gap-3 rounded-lg border bg-card p-4 panel-control'>
      <p className='font-mono text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase'>
        {t('admin.common.selectedContext')}
      </p>
      <div className='grid gap-4 md:grid-cols-3 xl:grid-cols-4'>{children}</div>
    </section>
  )
}

export function StatCard({
  title,
  value,
  description,
}: {
  title: string
  value: string
  description: string
}) {
  return (
    <Card className='gap-3 py-5'>
      <CardHeader className='gap-2 pb-0'>
        <CardDescription className='font-mono text-[0.68rem] font-semibold tracking-wide uppercase'>
          {title}
        </CardDescription>
        <CardTitle className='text-2xl font-semibold tracking-[-0.02em] tabular-nums'>
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className='text-sm text-muted-foreground'>
        {description}
      </CardContent>
    </Card>
  )
}

export function FormCard({
  title,
  children,
  submitLabel,
  pending,
  onSubmit,
  resetOnSuccess = true,
  disabled = false,
}: {
  title: string
  children: React.ReactNode
  submitLabel: string
  pending: boolean
  onSubmit: (formData: FormData) => Promise<unknown>
  resetOnSuccess?: boolean
  disabled?: boolean
}) {
  const { t } = useLanguage()
  const [submitError, setSubmitError] = useState<Error | null>(null)
  const submitLockedRef = useRef(false)
  return (
    <Card className='border-primary/25'>
      <CardHeader className='border-b pb-5'>
        <Badge
          className='w-fit border-primary/20 bg-primary/8 text-primary'
          variant='outline'
        >
          {t('admin.common.operationPanel')}
        </Badge>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {t('admin.common.operationPanelDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className='grid gap-4'
          onSubmit={async (event) => {
            event.preventDefault()
            if (submitLockedRef.current || pending || disabled) return
            submitLockedRef.current = true
            const form = event.currentTarget
            setSubmitError(null)
            try {
              await onSubmit(new FormData(form))
              if (resetOnSuccess) form.reset()
            } catch (error) {
              setSubmitError(
                error instanceof Error
                  ? error
                  : new Error(t('toasts.somethingWrong'))
              )
            } finally {
              submitLockedRef.current = false
            }
          }}
        >
          {children}
          {submitError && (
            <Alert variant='destructive' aria-live='polite'>
              <AlertCircle />
              <AlertTitle>{t('admin.common.error')}</AlertTitle>
              <AlertDescription>{submitError.message}</AlertDescription>
            </Alert>
          )}
          <Button
            type='submit'
            className='w-fit'
            disabled={pending || disabled}
          >
            {submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export function ConfirmActionButton({
  label,
  title,
  description,
  onConfirm,
  disabled = false,
  pending = false,
  destructive = true,
  variant = 'outline',
  size = 'sm',
}: {
  label: React.ReactNode
  title: React.ReactNode
  description: string
  onConfirm: () => Promise<unknown>
  disabled?: boolean
  pending?: boolean
  destructive?: boolean
  variant?: React.ComponentProps<typeof Button>['variant']
  size?: React.ComponentProps<typeof Button>['size']
}) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<Error>()
  const [confirmedAction, setConfirmedAction] = useState<ConfirmedAction>()
  const submitLockedRef = useRef(false)

  return (
    <>
      <Button
        type='button'
        variant={variant}
        size={size}
        disabled={disabled || pending || submitting}
        onClick={() => {
          setError(undefined)
          setConfirmedAction({
            label,
            title,
            description,
            onConfirm,
            destructive,
          })
          setOpen(true)
        }}
      >
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!submitting) {
            setOpen(nextOpen)
            if (!nextOpen) {
              setError(undefined)
              setConfirmedAction(undefined)
            }
          }
        }}
        title={confirmedAction?.title ?? ''}
        desc={confirmedAction?.description ?? ''}
        confirmText={confirmedAction?.label}
        destructive={confirmedAction?.destructive}
        isLoading={submitting}
        handleConfirm={() => {
          if (submitLockedRef.current || !confirmedAction) return
          submitLockedRef.current = true
          setSubmitting(true)
          setError(undefined)
          void Promise.resolve()
            .then(confirmedAction.onConfirm)
            .then(() => {
              setOpen(false)
              setConfirmedAction(undefined)
            })
            .catch((cause: unknown) =>
              setError(
                cause instanceof Error
                  ? cause
                  : new Error(t('toasts.somethingWrong'))
              )
            )
            .finally(() => {
              submitLockedRef.current = false
              setSubmitting(false)
            })
        }}
      >
        {error && (
          <Alert variant='destructive' aria-live='polite'>
            <AlertCircle />
            <AlertTitle>{t('admin.common.error')}</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
      </ConfirmDialog>
    </>
  )
}

export function CollectionCard({
  title,
  description,
  count,
  children,
}: {
  title: string
  description?: string
  count?: number
  children: React.ReactNode
}) {
  const { t } = useLanguage()
  return (
    <Card className='overflow-hidden'>
      <CardHeader className='border-b pb-5'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='grid gap-2'>
            <Badge className='w-fit' variant='secondary'>
              {t('admin.common.resourceCollection')}
            </Badge>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {typeof count === 'number' && (
            <Badge variant='outline'>
              {t('admin.common.total')}: {count}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className='grid gap-4 p-5'>{children}</CardContent>
    </Card>
  )
}

export function TextField({
  id,
  label,
  name,
  type = 'text',
  required = false,
  placeholder,
  value,
  onChange,
  defaultValue,
  disabled = false,
  readOnly = false,
  description,
}: {
  id?: string
  label: string
  name: string
  type?: string
  required?: boolean
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  defaultValue?: string
  disabled?: boolean
  readOnly?: boolean
  description?: string
}) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  return (
    <div className='grid gap-2'>
      <Label htmlFor={controlId}>{label}</Label>
      <Input
        id={controlId}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        disabled={disabled}
        readOnly={readOnly}
        aria-describedby={description ? `${controlId}-description` : undefined}
        onChange={
          onChange ? (event) => onChange(event.currentTarget.value) : undefined
        }
      />
      {description && (
        <p
          id={`${controlId}-description`}
          className='text-xs text-muted-foreground'
        >
          {description}
        </p>
      )}
    </div>
  )
}

export function InlineNameDescriptionForm({
  item,
  onUpdate,
  pending,
}: {
  item: { id: string; name: string; description?: string }
  onUpdate: (id: string, name: string, description: string) => Promise<unknown>
  pending: boolean
}) {
  const { t } = useLanguage()
  const [error, setError] = useState<Error>()
  const submitLockedRef = useRef(false)
  return (
    <form
      className='grid gap-2 sm:grid-cols-[1fr_1fr_auto]'
      onSubmit={async (event) => {
        event.preventDefault()
        if (submitLockedRef.current) return
        submitLockedRef.current = true
        const formData = new FormData(event.currentTarget)
        setError(undefined)
        try {
          await onUpdate(
            item.id,
            fieldValue(formData, 'name'),
            fieldValue(formData, 'description')
          )
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause
              : new Error(t('toasts.somethingWrong'))
          )
        } finally {
          submitLockedRef.current = false
        }
      }}
    >
      <Input
        name='name'
        defaultValue={item.name}
        aria-label={t('admin.fields.name')}
      />
      <Input
        name='description'
        defaultValue={item.description ?? ''}
        aria-label={t('admin.fields.description')}
      />
      <Button type='submit' variant='outline' size='sm' disabled={pending}>
        {t('admin.common.update')}
      </Button>
      {error && (
        <Alert
          className='sm:col-span-full'
          variant='destructive'
          aria-live='polite'
        >
          <AlertCircle />
          <AlertTitle>{t('admin.common.error')}</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
    </form>
  )
}

export function StatusBadge({
  children,
  muted = false,
}: {
  children: React.ReactNode
  muted?: boolean
}) {
  return (
    <Badge
      className={
        muted
          ? 'border-input bg-secondary text-secondary-foreground'
          : 'border-primary/25 bg-primary/8 text-primary'
      }
      variant='outline'
    >
      {children}
    </Badge>
  )
}

export function ContentViewer({
  title,
  content,
}: {
  title: string
  content?: string
}) {
  const { t } = useLanguage()
  return (
    <CollectionCard title={title}>
      {content ? (
        <pre className='max-h-[36rem] overflow-auto rounded-md border bg-[var(--surface-control)] p-4 text-xs leading-relaxed text-foreground'>
          {content}
        </pre>
      ) : (
        <p className='text-sm text-muted-foreground'>
          {t('admin.common.empty')}
        </p>
      )}
    </CollectionCard>
  )
}

export function NameDescriptionTable({
  items,
  onUpdate,
  onArchive,
  pending,
  emptyPreset,
  readOnly = false,
  canEdit,
}: {
  items: Array<TeamDTO | ProjectDTO>
  onUpdate: (id: string, name: string, description: string) => Promise<unknown>
  onArchive: (id: string) => Promise<unknown>
  pending: boolean
  emptyPreset: EmptyStatePreset
  readOnly?: boolean
  canEdit?: (id: string) => boolean
}) {
  const { t } = useLanguage()
  const hasEditableItem =
    !readOnly &&
    items.some(
      (item) =>
        ('status' in item ? item.status === ACTIVE_STATUS : true) &&
        (canEdit?.(item.id) ?? true)
    )
  return (
    <CollectionCard
      title={emptyPreset === 'teams' ? t('nav.teams') : t('nav.projects')}
      count={items.length}
    >
      {items.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.fields.name')}</TableHead>
              <TableHead>{t('admin.fields.id')}</TableHead>
              {hasEditableItem && (
                <TableHead>{t('admin.fields.actions')}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className='min-w-80'>
                  {readOnly ||
                  ('status' in item && item.status !== ACTIVE_STATUS) ||
                  (canEdit && !canEdit(item.id)) ? (
                    <div className='grid gap-1'>
                      <span className='font-medium'>{item.name}</span>
                      <span className='text-sm text-muted-foreground'>
                        {item.description || t('admin.common.none')}
                      </span>
                    </div>
                  ) : (
                    <InlineNameDescriptionForm
                      item={item}
                      onUpdate={onUpdate}
                      pending={pending}
                    />
                  )}
                </TableCell>
                <TableCell className='font-mono text-xs'>{item.id}</TableCell>
                {hasEditableItem && (
                  <TableCell>
                    {(!('status' in item) || item.status === ACTIVE_STATUS) &&
                      (!canEdit || canEdit(item.id)) && (
                        <ConfirmActionButton
                          label={t('admin.common.archive')}
                          title={t(
                            emptyPreset === 'teams'
                              ? 'admin.confirm.archiveTeamTitle'
                              : 'admin.confirm.archiveProjectTitle',
                            { name: item.name }
                          )}
                          description={t(
                            emptyPreset === 'teams'
                              ? 'admin.confirm.archiveTeamDescription'
                              : 'admin.confirm.archiveProjectDescription'
                          )}
                          pending={pending}
                          onConfirm={() => onArchive(item.id)}
                        />
                      )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState preset={emptyPreset} />
      )}
    </CollectionCard>
  )
}

export function DiffSummaryCards({
  summary,
  isMarkdown,
}: {
  summary: DiffSummaryDTO
  isMarkdown: boolean
}) {
  const { t } = useLanguage()
  const cards = isMarkdown
    ? [
        [
          t('admin.diff.addedLines'),
          summary.added_lines ?? 0,
          t('admin.diff.addedLinesDescription'),
        ],
        [
          t('admin.diff.removedLines'),
          summary.removed_lines ?? 0,
          t('admin.diff.removedLinesDescription'),
        ],
        [
          t('admin.diff.modifiedLines'),
          summary.modified_lines ?? 0,
          t('admin.diff.modifiedLinesDescription'),
        ],
        [
          t('admin.diff.modifiedBlocks'),
          summary.modified_blocks ?? 0,
          t('admin.diff.modifiedBlocksDescription'),
        ],
      ]
    : [
        [
          t('admin.diff.addedEndpoints'),
          summary.added_endpoints,
          t('admin.diff.addedDescription'),
        ],
        [
          t('admin.diff.removedEndpoints'),
          summary.removed_endpoints,
          t('admin.diff.removedDescription'),
        ],
        [
          t('admin.diff.modifiedEndpoints'),
          summary.modified_endpoints,
          t('admin.diff.modifiedDescription'),
        ],
        [
          t('admin.diff.breakingChanges'),
          summary.breaking_changes,
          t('admin.diff.breakingDescription'),
        ],
      ]
  return (
    <section className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      {cards.map(([title, value, description]) => (
        <StatCard
          key={String(title)}
          title={String(title)}
          value={String(value)}
          description={String(description)}
        />
      ))}
    </section>
  )
}

export function DiffReviewList({
  items,
  isMarkdown = false,
}: {
  items: DiffItemDTO[]
  isMarkdown?: boolean
}) {
  const { t } = useLanguage()
  const groups = useMemo(() => {
    const bySeverity = new Map<string, DiffItemDTO[]>()
    items.forEach((item) => {
      const key = changeSeverityLabel(item.severity, t)
      const group = bySeverity.get(key) ?? []
      group.push(item)
      bySeverity.set(key, group)
    })
    return Array.from(bySeverity.entries())
  }, [items, t])

  if (isMarkdown) {
    return (
      <section className='grid gap-3 rounded-md border bg-[var(--surface-control)] p-4'>
        <div>
          <p className='font-medium'>{t('admin.diff.unifiedDiff')}</p>
          <p className='text-xs text-muted-foreground'>
            {items.length} {t('admin.diff.changeCount')}
          </p>
        </div>
        <div className='overflow-hidden rounded-md border bg-background font-mono text-xs'>
          {items.map((item) => (
            <div key={item.id} className='border-b last:border-b-0'>
              <div className='bg-muted/50 px-3 py-2 text-muted-foreground'>
                @@ {item.location ?? diffMessageLabel(item.message, t)} @@
              </div>
              <pre className='overflow-x-auto px-3 py-2 leading-6'>
                {(item.frontend_impact ?? item.message)
                  .split('\n')
                  .map((line, index) => (
                    <span
                      key={`${item.id}-${index}`}
                      className={`block px-2 ${
                        line.startsWith('+')
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : line.startsWith('-')
                            ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                            : ''
                      }`}
                    >
                      {line || ' '}
                    </span>
                  ))}
              </pre>
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <div className='grid gap-4'>
      {groups.map(([severity, severityItems]) => (
        <section
          key={severity}
          className='grid gap-3 rounded-md border bg-[var(--surface-control)] p-4'
        >
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <p className='font-medium'>{severity}</p>
              <p className='text-xs text-muted-foreground'>
                {severityItems.length} {t('admin.diff.changeCount')}
              </p>
            </div>
            <Badge variant='secondary'>{t('admin.diff.severity')}</Badge>
          </div>
          <div className='grid gap-3'>
            {severityItems.map((item) => (
              <article
                key={item.id}
                className='grid gap-3 rounded-md border bg-background p-4'
              >
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div className='grid gap-1'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <Badge variant='outline'>
                        {methodLabel(item.method)}
                      </Badge>
                      <code className='font-mono text-xs'>
                        {item.path ?? item.location ?? t('admin.common.none')}
                      </code>
                    </div>
                    <p className='font-medium'>
                      {diffMessageLabel(item.message, t)}
                    </p>
                    {item.frontend_impact && (
                      <p className='text-sm text-muted-foreground'>
                        {item.frontend_impact === item.message
                          ? diffMessageLabel(item.frontend_impact, t)
                          : item.frontend_impact}
                      </p>
                    )}
                  </div>
                  <div className='flex flex-wrap gap-2'>
                    <Badge variant='secondary'>
                      {changeTypeLabel(item.change_type, t)}
                    </Badge>
                    {item.is_breaking && (
                      <Badge variant='outline'>
                        {t('admin.diff.breaking')}
                      </Badge>
                    )}
                    {item.must_handle && (
                      <Badge variant='outline'>
                        {t('admin.diff.mustHandle')}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className='grid gap-3 md:grid-cols-2'>
                  <div className='grid gap-2'>
                    <p className='text-xs font-medium text-muted-foreground'>
                      {t('admin.diff.oldValue')}
                    </p>
                    <pre className='max-h-72 overflow-auto rounded-md border bg-[var(--surface-control)] p-3 text-xs leading-relaxed'>
                      {jsonPreview(item.old_value)}
                    </pre>
                  </div>
                  <div className='grid gap-2'>
                    <p className='text-xs font-medium text-muted-foreground'>
                      {t('admin.diff.newValue')}
                    </p>
                    <pre className='max-h-72 overflow-auto rounded-md border bg-[var(--surface-control)] p-3 text-xs leading-relaxed'>
                      {jsonPreview(item.new_value)}
                    </pre>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function TokenTable({
  tokens,
  selected,
  onView,
  onRevoke,
  title,
  description,
  emptyPreset = 'tokens',
  pending = false,
}: {
  tokens: MCPTokenDTO[]
  selected?: string
  onView?: (tokenId: string) => void
  onRevoke: (tokenId: string) => Promise<unknown>
  title?: string
  description?: string
  emptyPreset?: EmptyStatePreset
  pending?: boolean
}) {
  const { t } = useLanguage()
  return (
    <CollectionCard
      title={title ?? t('nav.mcpTokens')}
      description={description}
      count={tokens.length}
    >
      {tokens.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.fields.name')}</TableHead>
              <TableHead>{t('admin.fields.status')}</TableHead>
              <TableHead>{t('admin.fields.expiresAt')}</TableHead>
              <TableHead>{t('admin.fields.lastUsedAt')}</TableHead>
              <TableHead>{t('admin.fields.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tokens.map((token) => (
              <TableRow
                key={token.id}
                data-state={selected === token.id ? 'selected' : undefined}
              >
                <TableCell>
                  <div className='font-medium'>{token.name}</div>
                  <div className='text-xs text-muted-foreground'>
                    {token.id}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge muted={!tokenIsActive(token)}>
                    {tokenStatusLabel(token, t)}
                  </StatusBadge>
                </TableCell>
                <TableCell>{formatDate(token.expires_at)}</TableCell>
                <TableCell>{formatDate(token.last_used_at)}</TableCell>
                <TableCell>
                  <div className='flex gap-2'>
                    {onView && (
                      <Button
                        variant='outline'
                        size='sm'
                        disabled={pending || !tokenIsActive(token)}
                        onClick={() => onView(token.id)}
                      >
                        {t('admin.common.view')}
                      </Button>
                    )}
                    <ConfirmActionButton
                      label={t('admin.common.revoke')}
                      title={t('admin.confirm.revokeTokenTitle', {
                        name: token.name,
                      })}
                      description={t('admin.confirm.revokeTokenDescription')}
                      disabled={!tokenIsActive(token)}
                      pending={pending}
                      onConfirm={() => onRevoke(token.id)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState preset={emptyPreset} />
      )}
    </CollectionCard>
  )
}
