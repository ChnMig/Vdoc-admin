import { afterEach, describe, expect, it, vi } from 'vitest'
import { routeViewTransition } from './route-transition'

type TransitionTypes = Exclude<typeof routeViewTransition.types, string[]>
type Navigation = Parameters<TransitionTypes>[0]
const previous = { pathname: '/documents' } as Navigation['toLocation']
const next = { pathname: '/settings' } as Navigation['toLocation']

function types(overrides: Partial<Navigation> = {}) {
  const resolve = routeViewTransition.types
  if (typeof resolve !== 'function')
    throw new Error('Expected a navigation-scoped transition')
  return resolve({
    fromLocation: previous,
    toLocation: next,
    pathChanged: true,
    hrefChanged: true,
    hashChanged: false,
    ...overrides,
  })
}

describe('workbench route motion', () => {
  afterEach(() => vi.restoreAllMocks())

  it('transitions between pages after the initial navigation', () => {
    expect(types()).toEqual(['workspace-navigation'])
    expect(types({ fromLocation: undefined })).toBe(false)
  })

  it('keeps search, filter and hash changes as local updates', () => {
    expect(types({ pathChanged: false })).toBe(false)
    expect(types({ pathChanged: false, hashChanged: true })).toBe(false)
  })

  it('respects reduced motion at the moment of navigation', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
    } as MediaQueryList)
    expect(types()).toBe(false)
  })
})
