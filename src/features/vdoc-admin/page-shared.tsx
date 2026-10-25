import {
  Children,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Plus,
  ShieldCheck,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { OptionsSelect } from '@/components/options-select'
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
import { useWorkspaceEmbedding } from './workspace-embedding'

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
  const guideId = useId()
  const [guideOpen, setGuideOpen] = useState(false)
  const projectId = useVdocContextStore((state) => state.projectId)
  const documentId = useVdocContextStore((state) => state.documentId)
  const embedded = useWorkspaceEmbedding()
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
  if (embedded) return <div className='grid min-w-0 gap-5'>{children}</div>
  return (
    <>
      <Header>
        <Search className='me-auto' />
        <LanguageSwitch />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main>
        <section className='mb-6 grid min-w-0 gap-4'>
          <div className='grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2'>
            <h1 className='min-w-0 text-2xl font-semibold tracking-tight'>
              {t(`admin.pages.${page}.title`)}
            </h1>
            {!guidance && (
              <button
                type='button'
                aria-expanded={guideOpen}
                aria-controls={guideId}
                onClick={() => setGuideOpen((open) => !open)}
                className='col-start-2 row-start-1 flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
              >
                {t('admin.common.pageHelp')}
                <ChevronDown
                  aria-hidden
                  className={`size-4 shrink-0 transition-transform ${guideOpen ? 'rotate-180' : ''}`}
                />
              </button>
            )}
            <p className='col-span-full max-w-3xl text-sm leading-6 text-pretty text-muted-foreground'>
              {t(`admin.pages.${page}.description`)}
            </p>
            {!guidance && (
              <div id={guideId} hidden={!guideOpen} className='col-span-full'>
                <div className='grid gap-3 rounded-md border bg-card p-4 text-sm text-muted-foreground'>
                  <p className='leading-6'>{t(`admin.pages.${page}.cue`)}</p>
                  <p className='leading-6'>{resolvedGuidance.description}</p>
                  {resolvedGuidance.action && (
                    <Button
                      asChild
                      size='sm'
                      variant='outline'
                      className='w-fit max-w-full'
                    >
                      <a
                        href={contextualHref(
                          resolvedGuidance.action.href,
                          projectId,
                          documentId
                        )}
                      >
                        {resolvedGuidance.action.label}
                        <ArrowRight aria-hidden />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
          {guidance && (
            <aside
              aria-label={t('admin.common.nextAction')}
              className='flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-md border bg-card px-4 py-3 text-sm'
            >
              <details open className='group min-w-0 flex-1'>
                <summary className='flex min-h-8 cursor-pointer list-none items-center gap-2 rounded-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden'>
                  {resolvedGuidance.title}
                  <ChevronDown
                    aria-hidden
                    className='size-4 shrink-0 transition-transform group-open:rotate-180'
                  />
                </summary>
                <p className='max-w-3xl pt-2 text-sm leading-6 text-muted-foreground'>
                  {resolvedGuidance.description}
                </p>
              </details>
              {resolvedGuidance.action && (
                <Button
                  asChild
                  size='sm'
                  variant='outline'
                  className='max-w-full shrink-0'
                >
                  <a
                    href={contextualHref(
                      resolvedGuidance.action.href,
                      projectId,
                      documentId
                    )}
                  >
                    {resolvedGuidance.action.label}
                    <ArrowRight aria-hidden />
                  </a>
                </Button>
              )}
            </aside>
          )}
        </section>
        <div className='grid min-w-0 gap-6'>{children}</div>
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
    <div className='grid justify-items-start gap-2 px-1 py-6 text-sm'>
      <p className='font-medium'>{title}</p>
      <p className='max-w-2xl leading-6 text-muted-foreground'>{description}</p>
      {action && <p className='max-w-2xl leading-6'>{action}</p>}
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
    <div className='grid min-w-0 content-start gap-2'>
      <Label htmlFor={controlId}>{label}</Label>
      <OptionsSelect
        id={controlId}
        name={name}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        disabled={disabled}
        required={required}
        aria-describedby={hint ? `${controlId}-hint` : undefined}
        onChange={onChange}
        options={selectOptions}
        placeholder={placeholder}
      />
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
  const fieldCount = Children.toArray(children).length
  return (
    <section
      aria-label={t('admin.common.selectedContext')}
      className='grid min-w-0 gap-3 border-b pb-5'
    >
      <div
        className='grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-4'
        style={{ maxWidth: `${Math.max(fieldCount, 1) * 24}rem` }}
      >
        {children}
      </div>
    </section>
  )
}

export function ContextSelectorGrid({
  children,
  scopeFields = 2,
}: {
  children: React.ReactNode
  scopeFields?: number
}) {
  const embedded = useWorkspaceEmbedding()
  const fields = Children.toArray(children)
  const visibleFields = embedded ? fields.slice(scopeFields) : fields
  return visibleFields.length ? (
    <SelectorGrid>{visibleFields}</SelectorGrid>
  ) : null
}

function sameFormValues(left: FormData, right: FormData) {
  const leftEntries = [...left.entries()]
  const rightEntries = [...right.entries()]
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(([name, value], index) => {
      const [rightName, rightValue] = rightEntries[index]
      return (
        name === rightName &&
        (typeof value === 'string'
          ? value === rightValue
          : rightValue instanceof File &&
            value.name === rightValue.name &&
            value.size === rightValue.size &&
            value.type === rightValue.type &&
            value.lastModified === rightValue.lastModified)
      )
    })
  )
}

export function FormCard({
  title,
  children,
  submitLabel,
  pending,
  onSubmit,
  onSuccess,
  submissionScope = '',
  resetOnSuccess = true,
  disabled = false,
  presentation = 'card',
  onCancel,
}: {
  title: string
  children: React.ReactNode
  submitLabel: string
  pending: boolean
  onSubmit: (formData: FormData) => Promise<unknown>
  onSuccess?: () => void
  submissionScope?: string
  resetOnSuccess?: boolean
  disabled?: boolean
  presentation?: 'card' | 'dialog'
  onCancel?: () => void
}) {
  const { t } = useLanguage()
  const [submitError, setSubmitError] = useState<{
    owner: object
    error: Error
  } | null>(null)
  const submitLockedRef = useRef(false)
  const editVersionRef = useRef(0)
  const submissionOwner = useMemo(
    () => ({ scope: submissionScope }),
    [submissionScope]
  )
  const currentOwnerRef = useRef<object | null>(null)
  useLayoutEffect(() => {
    currentOwnerRef.current = submissionOwner
    return () => {
      currentOwnerRef.current = null
    }
  }, [submissionOwner])
  const currentError =
    submitError?.owner === submissionOwner ? submitError.error : null
  const form = (
    <form
      className='grid min-w-0 gap-4'
      aria-busy={pending}
      onInputCapture={() => editVersionRef.current++}
      onChangeCapture={() => editVersionRef.current++}
      onSubmit={async (event) => {
        event.preventDefault()
        if (submitLockedRef.current || pending || disabled) return
        submitLockedRef.current = true
        const form = event.currentTarget
        const submittedValues = new FormData(form)
        const submittedEditVersion = editVersionRef.current
        setSubmitError(null)
        try {
          await onSubmit(submittedValues)
          if (
            currentOwnerRef.current === submissionOwner &&
            editVersionRef.current === submittedEditVersion &&
            (presentation === 'dialog' ||
              sameFormValues(submittedValues, new FormData(form)))
          ) {
            if (resetOnSuccess) form.reset()
            onSuccess?.()
          }
        } catch (error) {
          if (currentOwnerRef.current === submissionOwner)
            setSubmitError({
              owner: submissionOwner,
              error:
                error instanceof Error
                  ? error
                  : new Error(t('toasts.somethingWrong')),
            })
        } finally {
          submitLockedRef.current = false
        }
      }}
    >
      {children}
      {currentError && (
        <Alert variant='destructive' aria-live='polite'>
          <AlertCircle />
          <AlertTitle>{t('admin.common.error')}</AlertTitle>
          <AlertDescription>{currentError.message}</AlertDescription>
        </Alert>
      )}
      <div
        className={
          presentation === 'dialog'
            ? 'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'
            : undefined
        }
      >
        {onCancel && (
          <Button
            type='button'
            variant='outline'
            disabled={pending}
            onClick={onCancel}
          >
            {t('common.cancel')}
          </Button>
        )}
        <Button
          type='submit'
          className={presentation === 'card' ? 'w-fit' : undefined}
          disabled={pending || disabled}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  )
  if (presentation === 'dialog') return form
  return (
    <Card className='min-w-0'>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{form}</CardContent>
    </Card>
  )
}

type FormDialogProps = Omit<
  React.ComponentProps<typeof FormCard>,
  'presentation' | 'onCancel'
> & {
  description?: string
  triggerLabel?: string
  triggerVariant?: React.ComponentProps<typeof Button>['variant']
  triggerSize?: React.ComponentProps<typeof Button>['size']
  onOpenChange?: (open: boolean) => void
}

export function FormDialog(props: FormDialogProps) {
  const sessionVersion = useAuthStore((state) => state.auth.sessionVersion)
  return (
    <ScopedFormDialog
      key={JSON.stringify([sessionVersion, props.submissionScope])}
      {...props}
    />
  )
}

function ScopedFormDialog({
  title,
  description,
  triggerLabel = title,
  triggerVariant = 'default',
  triggerSize = 'default',
  onOpenChange,
  onSuccess,
  ...formProps
}: FormDialogProps) {
  const [open, setOpen] = useState(false)
  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!formProps.pending) changeOpen(nextOpen)
      }}
    >
      <DialogTrigger asChild>
        <Button
          type='button'
          variant={triggerVariant}
          size={triggerSize}
          disabled={formProps.disabled || formProps.pending}
        >
          {triggerVariant === 'default' && <Plus aria-hidden='true' />}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent
        className='max-h-[calc(100dvh-2rem)] overflow-y-auto'
        showCloseButton={!formProps.pending}
        {...(!description ? { 'aria-describedby': undefined } : {})}
      >
        <DialogHeader className='text-start'>
          <DialogTitle className='pr-6'>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <FormCard
          {...formProps}
          title={title}
          presentation='dialog'
          onCancel={() => changeOpen(false)}
          onSuccess={() => {
            changeOpen(false)
            onSuccess?.()
          }}
        />
      </DialogContent>
    </Dialog>
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
  actions,
}: {
  title: string
  description?: string
  count?: number
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  const { t } = useLanguage()
  return (
    <Card className='min-w-0 gap-0 overflow-hidden py-0'>
      <CardHeader className='min-w-0 grid-cols-[minmax(0,1fr)] border-b px-4 py-3 sm:px-5 [.border-b]:pb-3'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] gap-1'>
            <div className='flex min-w-0 flex-wrap items-center gap-2'>
              <CardTitle className='text-sm leading-6'>{title}</CardTitle>
              {typeof count === 'number' && (
                <Badge variant='secondary' className='tabular-nums'>
                  {t('admin.common.total')}: {count}
                </Badge>
              )}
            </div>
            {description && (
              <CardDescription className='max-w-3xl leading-5 [overflow-wrap:anywhere]'>
                {description}
              </CardDescription>
            )}
          </div>
          {actions && (
            <div className='flex max-w-full shrink-0 flex-wrap items-center gap-2'>
              {actions}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className='grid min-w-0 gap-4 p-4 sm:px-5'>
        {children}
      </CardContent>
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
    <div className='grid min-w-0 content-start gap-2'>
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
  actions,
}: {
  items: Array<TeamDTO | ProjectDTO>
  onUpdate: (id: string, name: string, description: string) => Promise<unknown>
  onArchive: (id: string) => Promise<unknown>
  pending: boolean
  emptyPreset: EmptyStatePreset
  readOnly?: boolean
  canEdit?: (id: string) => boolean
  actions?: React.ReactNode
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
      actions={actions}
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
                <TableCell className='max-w-md min-w-48 whitespace-normal'>
                  <div className='grid gap-1'>
                    <span className='font-medium break-words'>{item.name}</span>
                    <span className='text-sm break-words text-muted-foreground'>
                      {item.description || t('admin.common.none')}
                    </span>
                  </div>
                </TableCell>
                <TableCell className='font-mono text-xs'>{item.id}</TableCell>
                {hasEditableItem && (
                  <TableCell>
                    {(!('status' in item) || item.status === ACTIVE_STATUS) &&
                      (!canEdit || canEdit(item.id)) && (
                        <div className='flex items-center justify-center gap-2'>
                          <FormDialog
                            title={t(
                              emptyPreset === 'teams'
                                ? 'admin.sections.editTeam'
                                : 'admin.sections.editProject'
                            )}
                            description={item.name}
                            triggerLabel={t('admin.common.edit')}
                            triggerVariant='outline'
                            triggerSize='sm'
                            submitLabel={t('admin.common.save')}
                            pending={pending}
                            submissionScope={item.id}
                            onSubmit={(values) =>
                              onUpdate(
                                item.id,
                                fieldValue(values, 'name'),
                                fieldValue(values, 'description')
                              )
                            }
                          >
                            <TextField
                              label={t('admin.fields.name')}
                              name='name'
                              defaultValue={item.name}
                              required
                            />
                            <TextField
                              label={t('admin.fields.description')}
                              name='description'
                              defaultValue={item.description ?? ''}
                            />
                          </FormDialog>
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
                        </div>
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
  isTextDiff,
}: {
  summary: DiffSummaryDTO
  isTextDiff: boolean
}) {
  const { t } = useLanguage()
  const cards = isTextDiff
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
    <section className='grid min-w-0 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4'>
      {cards.map(([title, value, description]) => (
        <div key={String(title)} className='grid min-w-0 gap-2 bg-card p-4'>
          <p className='text-sm text-muted-foreground'>{title}</p>
          <p className='text-xl font-semibold tabular-nums'>{value}</p>
          <p className='text-xs leading-5 text-muted-foreground'>
            {description}
          </p>
        </div>
      ))}
    </section>
  )
}

export function DiffReviewList({
  items,
  isTextDiff = false,
}: {
  items: DiffItemDTO[]
  isTextDiff?: boolean
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

  if (isTextDiff) {
    return (
      <section className='grid min-w-0 gap-3'>
        <div>
          <p className='font-medium'>{t('admin.diff.unifiedDiff')}</p>
          <p className='text-xs text-muted-foreground'>
            {items.length} {t('admin.diff.changeCount')}
          </p>
        </div>
        <div className='min-w-0 overflow-hidden rounded-md border bg-background font-mono text-xs'>
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
    <div className='grid min-w-0 gap-6'>
      {groups.map(([severity, severityItems]) => (
        <section key={severity} className='grid min-w-0 gap-3'>
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
                className='grid min-w-0 gap-4 rounded-md border bg-background p-4'
              >
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div className='grid min-w-0 gap-1'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <Badge variant='outline'>
                        {methodLabel(item.method)}
                      </Badge>
                      <code className='min-w-0 font-mono text-xs break-all'>
                        {item.path ?? item.location ?? t('admin.common.none')}
                      </code>
                    </div>
                    <p className='font-medium break-words'>
                      {diffMessageLabel(item.message, t)}
                    </p>
                    {item.frontend_impact && (
                      <p className='text-sm break-words text-muted-foreground'>
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
                <div className='grid min-w-0 gap-3 md:grid-cols-2'>
                  <div className='grid min-w-0 gap-2'>
                    <p className='text-xs font-medium text-muted-foreground'>
                      {t('admin.diff.oldValue')}
                    </p>
                    <pre className='max-h-72 overflow-auto rounded-md border bg-[var(--surface-control)] p-3 text-xs leading-relaxed'>
                      {jsonPreview(item.old_value, item.old_value_json)}
                    </pre>
                  </div>
                  <div className='grid min-w-0 gap-2'>
                    <p className='text-xs font-medium text-muted-foreground'>
                      {t('admin.diff.newValue')}
                    </p>
                    <pre className='max-h-72 overflow-auto rounded-md border bg-[var(--surface-control)] p-3 text-xs leading-relaxed'>
                      {jsonPreview(item.new_value, item.new_value_json)}
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
  emptyContent,
  queryState,
  onRetry,
  refreshing = false,
  pending = false,
  actions,
}: {
  tokens: MCPTokenDTO[]
  selected?: string
  onView?: (tokenId: string) => void
  onRevoke: (tokenId: string) => Promise<unknown>
  title?: string
  description?: string
  emptyPreset?: EmptyStatePreset
  emptyContent?: React.ReactNode
  queryState?: QueryState
  onRetry?: () => void
  refreshing?: boolean
  pending?: boolean
  actions?: React.ReactNode
}) {
  const { t } = useLanguage()
  return (
    <CollectionCard
      title={title ?? t('nav.mcpTokens')}
      description={description}
      actions={actions}
      count={
        tokens.length || (!queryState?.isLoading && !queryState?.isError)
          ? tokens.length
          : undefined
      }
    >
      {queryState?.isLoading && (
        <p role='status' className='text-sm text-muted-foreground'>
          {t('admin.common.loading')}
        </p>
      )}
      {queryState?.isError && (
        <Alert variant='destructive' aria-live='polite'>
          <AlertCircle />
          <AlertTitle>{t('admin.common.error')}</AlertTitle>
          <AlertDescription className='grid gap-3'>
            <p>{queryState.error?.message ?? t('toasts.somethingWrong')}</p>
            {onRetry && (
              <Button
                type='button'
                variant='outline'
                className='w-fit'
                disabled={refreshing}
                onClick={onRetry}
              >
                {t('errors.retry')}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
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
                  <div className='flex justify-center gap-2'>
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
      ) : !queryState?.isLoading && !queryState?.isError ? (
        (emptyContent ?? <EmptyState preset={emptyPreset} />)
      ) : null}
    </CollectionCard>
  )
}
