import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { cn } from '@/lib/utils'
import { useLanguage } from '@/context/language-provider'

type OutlineEntry = {
  id: string
  label: string
  level: number
  element: HTMLElement
}

// Inline and dialog outlines of the same reader must share heading anchors.
const readerAnchorScopes = new WeakMap<HTMLElement, string>()

type DocumentWorkspaceOutlineProps = {
  contentRootRef: RefObject<HTMLElement | null>
  scrollRootRef?: RefObject<HTMLElement | null>
  contextKey: string
  onNavigate?: () => void
}

export function DocumentWorkspaceOutline(props: DocumentWorkspaceOutlineProps) {
  // A new revision gets a fresh outline before its asynchronous reader resolves.
  return <DocumentOutline key={props.contextKey} {...props} />
}

function DocumentOutline({
  contentRootRef,
  scrollRootRef,
  contextKey,
  onNavigate,
}: DocumentWorkspaceOutlineProps) {
  const { t } = useLanguage()
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [entries, setEntries] = useState<OutlineEntry[]>([])
  const [activeId, setActiveId] = useState('')
  const entriesRef = useRef<OutlineEntry[]>([])

  useEffect(() => {
    const root = contentRootRef.current
    if (!root) return
    const scrollRoot = scrollRootRef?.current
    const scrollTarget = scrollRoot ?? window
    let frame = 0

    const updateActive = () => {
      frame = 0
      const top = (scrollRoot?.getBoundingClientRect().top ?? 0) + 40
      let current = entriesRef.current[0]?.id ?? ''
      for (const entry of entriesRef.current) {
        if (entry.element.getBoundingClientRect().top > top) break
        current = entry.id
      }
      setActiveId(current)
    }

    const scheduleActive = () => {
      if (!frame) frame = requestAnimationFrame(updateActive)
    }

    const collect = () => {
      const headings = Array.from(
        root.querySelectorAll<HTMLElement>(
          '[data-document-content] h1, [data-document-content] h2, [data-document-content] h3, [data-document-content] h4'
        )
      ).filter((heading) => {
        const hiddenAncestor = heading.closest(
          '[hidden], [aria-hidden="true"], [data-state="inactive"]'
        )
        // Modal isolation may hide the reader's ancestors from assistive
        // technology. Only hidden source content inside this reader is absent
        // from its outline; the dialog still navigates the same rendered text.
        return (
          heading.textContent?.trim() &&
          (!hiddenAncestor || !root.contains(hiddenAncestor))
        )
      })
      const idCounts = new Map<string, number>()
      for (const node of root.ownerDocument.querySelectorAll('[id]')) {
        idCounts.set(node.id, (idCounts.get(node.id) ?? 0) + 1)
      }
      let scope = readerAnchorScopes.get(root)
      if (!scope) {
        scope = instanceId
        readerAnchorScopes.set(root, scope)
      }
      const prefix = `vdoc-section-${hashKey(contextKey)}-${scope}`
      const nextEntries = headings.map((element, index) => {
        let id = element.id
        if (
          !id ||
          idCounts.get(id) !== 1 ||
          (id.startsWith('vdoc-section-') && !id.startsWith(`${prefix}-`))
        ) {
          const base = `${prefix}-${index}`
          id = base
          let collision = 0
          while (
            root.ownerDocument.getElementById(id) &&
            root.ownerDocument.getElementById(id) !== element
          ) {
            id = `${base}-${++collision}`
          }
          element.id = id
        }
        return {
          id,
          label: element.textContent!.trim(),
          level: Number(element.tagName.slice(1)),
          element,
        }
      })
      entriesRef.current = nextEntries
      setEntries((previous) =>
        previous.length === nextEntries.length &&
        previous.every(
          (entry, index) =>
            entry.id === nextEntries[index].id &&
            entry.label === nextEntries[index].label &&
            entry.level === nextEntries[index].level &&
            entry.element === nextEntries[index].element
        )
          ? previous
          : nextEntries
      )
      scheduleActive()
    }

    const mutations = new MutationObserver(collect)
    mutations.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['hidden', 'aria-hidden', 'data-state'],
    })
    const resize = new ResizeObserver(scheduleActive)
    resize.observe(root)
    scrollTarget.addEventListener('scroll', scheduleActive, { passive: true })
    window.addEventListener('resize', scheduleActive)
    collect()

    return () => {
      mutations.disconnect()
      resize.disconnect()
      scrollTarget.removeEventListener('scroll', scheduleActive)
      window.removeEventListener('resize', scheduleActive)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [contentRootRef, scrollRootRef, contextKey, instanceId])

  const baseLevel = Math.min(...entries.map((entry) => entry.level))
  return (
    <nav aria-label={t('admin.workspace.outline')} className='min-w-0'>
      <p className='mb-4 text-xs font-medium text-foreground'>
        {t('admin.workspace.outline')}
      </p>
      {entries.length ? (
        <ol className='space-y-1 border-s border-border/70 text-sm'>
          {entries.map((entry) => (
            <li key={entry.id}>
              <a
                href={`#${encodeURIComponent(entry.id)}`}
                aria-current={entry.id === activeId ? 'location' : undefined}
                className={cn(
                  '-ms-px block border-s-2 border-transparent py-1.5 pe-2 leading-5 break-words transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  ['ps-3', 'ps-6', 'ps-9', 'ps-12'][entry.level - baseLevel],
                  entry.id === activeId
                    ? 'border-primary font-medium text-primary'
                    : 'text-muted-foreground'
                )}
                onClick={(event) => {
                  event.preventDefault()
                  const behavior = window.matchMedia(
                    '(prefers-reduced-motion: reduce)'
                  ).matches
                    ? 'auto'
                    : 'smooth'
                  const scrollRoot = scrollRootRef?.current
                  if (scrollRoot) {
                    scrollRoot.scrollTo({
                      top: Math.max(
                        0,
                        scrollRoot.scrollTop +
                          entry.element.getBoundingClientRect().top -
                          scrollRoot.getBoundingClientRect().top -
                          32
                      ),
                      behavior,
                    })
                  } else {
                    entry.element.scrollIntoView({ behavior, block: 'start' })
                  }
                  setActiveId(entry.id)
                  onNavigate?.()
                }}
              >
                {entry.label}
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <p className='text-xs leading-6 text-muted-foreground'>
          {t('admin.workspace.outlineEmpty')}
        </p>
      )}
    </nav>
  )
}

function hashKey(key: string) {
  let hash = 2166136261
  for (let index = 0; index < key.length; index++) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}
