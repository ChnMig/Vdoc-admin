import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { Bot, Maximize2, Minimize2, X } from 'lucide-react'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import {
  hasExternalDocumentModal,
  useExternalDocumentModal,
  useWideDocumentLayout,
} from './document-layout-hooks'

// Keep one dialog and one subtree while changing between docked and modal views.
export function DocumentAssistantPanel({
  open,
  suspended = false,
  onClose,
  triggerRef,
  children,
}: {
  open: boolean
  suspended?: boolean
  onClose: () => void
  triggerRef: RefObject<HTMLButtonElement | null>
  children: ReactNode
}) {
  const { t } = useLanguage()
  const [assistantVisited, setAssistantVisited] = useState(open)
  if (open && !assistantVisited) setAssistantVisited(true)
  const [assistantExpanded, setAssistantExpanded] = useState(false)
  const wideLayout = useWideDocumentLayout()
  const assistantModal = !wideLayout || assistantExpanded
  const externalModalOpen = useExternalDocumentModal()
  const assistantPresented =
    open && (!assistantModal || !(externalModalOpen || suspended))
  const assistantRef = useRef<HTMLDialogElement>(null)
  const restoreAssistantFocus = useRef(false)
  const assistantTitleId = useId()
  const closeAssistant = () => {
    restoreAssistantFocus.current = true
    onClose()
  }
  useLayoutEffect(() => {
    const panel = assistantRef.current
    if (!panel) return
    if (!assistantPresented || (assistantModal && hasExternalDocumentModal())) {
      if (panel.open) panel.close()
      if (restoreAssistantFocus.current) {
        triggerRef.current?.focus({ preventScroll: true })
        restoreAssistantFocus.current = false
      }
      return
    }
    const focused = panel.contains(globalThis.document.activeElement)
      ? (globalThis.document.activeElement as HTMLElement)
      : null
    if (panel.open) panel.close()
    if (assistantModal) panel.showModal()
    else panel.show()
    focused?.focus({ preventScroll: true })
  }, [assistantPresented, assistantModal, triggerRef])
  return (
    <dialog
      ref={assistantRef}
      inert={!assistantPresented}
      className='document-assistant-panel bg-card text-foreground'
      data-expanded={assistantExpanded || undefined}
      aria-labelledby={assistantTitleId}
      aria-modal={assistantPresented && assistantModal ? true : undefined}
      onKeyDown={(event) => {
        if (assistantModal && event.key === 'Tab' && !event.defaultPrevented) {
          const focusable = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
          ).filter(
            (element) =>
              !element.matches(':disabled') &&
              !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
              element.getClientRects().length > 0
          )
          const first = focusable[0]
          const last = focusable[focusable.length - 1]
          const active = globalThis.document.activeElement
          if (
            event.shiftKey &&
            (active === first || active === event.currentTarget)
          ) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && active === last) {
            event.preventDefault()
            first?.focus()
          }
        }
        if (
          !assistantModal &&
          event.key === 'Escape' &&
          !event.defaultPrevented
        ) {
          event.preventDefault()
          closeAssistant()
        }
      }}
      onCancel={(event) => {
        event.preventDefault()
        closeAssistant()
      }}
      onClick={(event) => {
        if (!assistantModal || event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          closeAssistant()
      }}
    >
      <div className='flex h-full min-h-0 min-w-0 flex-col'>
        <div className='flex shrink-0 items-center justify-between gap-2 border-b px-5 py-3'>
          <h2
            id={assistantTitleId}
            className='flex items-center gap-2 text-sm font-semibold'
          >
            <Bot aria-hidden className='size-4 text-primary' />
            {t('admin.workspace.ai')}
          </h2>
          <div className='flex items-center gap-1'>
            <Button
              variant='ghost'
              size='icon'
              className='size-8'
              aria-label={t(
                assistantExpanded
                  ? 'admin.ai.collapseChat'
                  : 'admin.ai.expandChat'
              )}
              title={t(
                assistantExpanded
                  ? 'admin.ai.collapseChat'
                  : 'admin.ai.expandChat'
              )}
              aria-pressed={assistantExpanded}
              onClick={() => setAssistantExpanded(!assistantExpanded)}
            >
              {assistantExpanded ? (
                <Minimize2 aria-hidden className='size-4' />
              ) : (
                <Maximize2 aria-hidden className='size-4' />
              )}
            </Button>
            <Button
              variant='ghost'
              size='icon'
              className='size-8'
              aria-label={t('admin.workspace.closeAssistant')}
              onClick={closeAssistant}
            >
              <X aria-hidden className='size-4' />
            </Button>
          </div>
        </div>
        <div className='min-h-0 min-w-0 flex-1 overflow-hidden p-4'>
          {assistantVisited && children}
        </div>
      </div>
    </dialog>
  )
}
