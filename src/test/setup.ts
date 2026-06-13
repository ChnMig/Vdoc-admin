import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

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

Object.defineProperty(Element.prototype, 'scrollIntoView', {
  writable: true,
  value: () => undefined,
})

afterEach(() => {
  cleanup()
})
