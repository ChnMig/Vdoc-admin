import {
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react'
import { Maximize2, Minimize2, X } from 'lucide-react'
import { useLanguage } from '@/context/language-provider'
import { Button } from '@/components/ui/button'
import { useExternalDocumentModal } from './document-layout-hooks'

// The panel stays in one DOM location; expansion only changes its width.
export function DocumentToolSidebar({
  open,
  expanded,
  overlay,
  title,
  onExpand,
  onClose,
  triggerRef,
  children,
}: {
  open: boolean
  expanded: boolean
  overlay: boolean
  title: string
  onExpand: () => void
  onClose: () => void
  triggerRef: RefObject<HTMLButtonElement | null>
  children: ReactNode
}) {
  const { language } = useLanguage()
  const zh = language === 'zh-CN'
  const titleId = useId()
  const panelRef = useRef<HTMLElement>(null)
  const externalModal = useExternalDocumentModal()
  const previousOpen = useRef(false)
  useLayoutEffect(() => {
    if (
      open &&
      overlay &&
      !externalModal &&
      (!previousOpen.current ||
        !panelRef.current?.contains(document.activeElement))
    )
      panelRef.current?.focus({ preventScroll: true })
    previousOpen.current = open
  }, [open, overlay, externalModal])
  const close = () => {
    onClose()
    triggerRef.current?.focus({ preventScroll: true })
  }
  return (
    <>
      <div
        className='document-tool-backdrop'
        hidden={!open || !overlay}
        aria-hidden='true'
        onClick={close}
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        hidden={!open}
        inert={!open || externalModal}
        role={overlay ? 'dialog' : 'complementary'}
        aria-modal={open && overlay && !externalModal ? true : undefined}
        aria-labelledby={titleId}
        className='document-tool-sidebar bg-card text-foreground focus:outline-none'
        data-expanded={expanded || undefined}
        onKeyDown={(event) => {
          if (externalModal || event.defaultPrevented) return
          if (event.key === 'Escape') {
            event.preventDefault()
            close()
          }
          if (!overlay || event.key !== 'Tab') return
          const elements = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
          ).filter(
            (element) =>
              !element.matches(':disabled') &&
              !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
              element.getClientRects().length > 0
          )
          const first = elements[0],
            last = elements[elements.length - 1]
          if (
            event.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === event.currentTarget)
          ) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          }
        }}
      >
        <header className='flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4'>
          <h2 id={titleId} className='truncate text-sm font-semibold'>
            {title}
          </h2>
          <div className='flex shrink-0 gap-1'>
            <Button
              variant='ghost'
              size='icon'
              className='size-8'
              aria-label={
                expanded
                  ? zh
                    ? '缩回侧栏'
                    : 'Collapse sidebar'
                  : zh
                    ? '展开侧栏'
                    : 'Expand sidebar'
              }
              title={
                expanded
                  ? zh
                    ? '缩回侧栏'
                    : 'Collapse sidebar'
                  : zh
                    ? '展开侧栏'
                    : 'Expand sidebar'
              }
              aria-pressed={expanded}
              onClick={onExpand}
            >
              {expanded ? (
                <Minimize2 aria-hidden className='size-4' />
              ) : (
                <Maximize2 aria-hidden className='size-4' />
              )}
            </Button>
            <Button
              variant='ghost'
              size='icon'
              className='size-8'
              aria-label={zh ? '关闭侧栏' : 'Close sidebar'}
              onClick={close}
            >
              <X aria-hidden className='size-4' />
            </Button>
          </div>
        </header>
        <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
          {children}
        </div>
      </aside>
    </>
  )
}
