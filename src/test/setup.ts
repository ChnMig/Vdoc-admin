import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  })

  class TestResizeObserver implements ResizeObserver {
    observe() {
      return undefined
    }

    unobserve() {
      return undefined
    }

    disconnect() {
      return undefined
    }
  }

  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    value: TestResizeObserver,
  })

  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    value: TestResizeObserver,
  })

  if (!window.PointerEvent) {
    class TestPointerEvent extends MouseEvent {
      pointerId: number
      pointerType: string
      isPrimary: boolean

      constructor(type: string, options: PointerEventInit = {}) {
        super(type, options)
        this.pointerId = options.pointerId ?? 1
        this.pointerType = options.pointerType ?? 'mouse'
        this.isPrimary = options.isPrimary ?? true
      }
    }
    Object.defineProperty(window, 'PointerEvent', {
      writable: true,
      value: TestPointerEvent,
    })
    Object.defineProperty(globalThis, 'PointerEvent', {
      writable: true,
      value: TestPointerEvent,
    })
  }

  for (const method of [
    'setPointerCapture',
    'releasePointerCapture',
  ] as const) {
    if (!(method in Element.prototype)) {
      Object.defineProperty(Element.prototype, method, {
        configurable: true,
        value: () => undefined,
      })
    }
  }
  if (!Element.prototype.hasPointerCapture) {
    Object.defineProperty(Element.prototype, 'hasPointerCapture', {
      configurable: true,
      value: () => false,
    })
  }

  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    writable: true,
    value: () => undefined,
  })
}

afterEach(() => {
  cleanup()
})
