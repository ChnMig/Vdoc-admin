import { useSyncExternalStore } from 'react'

// All shared Radix dialogs, confirmations and sheets yield the mobile top layer.
// Observe their owned state, not aria-hidden/inert side effects from focus scopes.
const externalDocumentModalSelector = [
  '[role="dialog"][data-state="open"][data-slot="dialog-content"]',
  '[role="alertdialog"][data-state="open"][data-slot="alert-dialog-content"]',
  '[role="dialog"][data-state="open"][data-slot="sheet-content"]',
].join(',')
export function hasExternalDocumentModal() {
  return Array.from(
    globalThis.document.querySelectorAll<HTMLElement>(
      externalDocumentModalSelector
    )
  ).some((modal) => !modal.closest('dialog.document-assistant-panel, [hidden]'))
}
function subscribeExternalDocumentModals(callback: () => void) {
  const observer = new MutationObserver(callback)
  observer.observe(globalThis.document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-state', 'data-slot', 'role', 'hidden'],
  })
  return () => observer.disconnect()
}
export function useExternalDocumentModal() {
  return useSyncExternalStore(
    subscribeExternalDocumentModals,
    hasExternalDocumentModal,
    () => false
  )
}
const wideDocumentQuery = '(min-width: 1280px)'
function subscribeWideDocumentLayout(callback: () => void) {
  const media = window.matchMedia(wideDocumentQuery)
  media.addEventListener('change', callback)
  return () => media.removeEventListener('change', callback)
}
export function useWideDocumentLayout() {
  return useSyncExternalStore(
    subscribeWideDocumentLayout,
    () => window.matchMedia(wideDocumentQuery).matches,
    () => false
  )
}
