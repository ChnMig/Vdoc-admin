import { describe, expect, it } from 'vitest'
import { withNativeSelectPlaceholder } from './native-select-options'

describe('withNativeSelectPlaceholder', () => {
  it('adds a distinct empty placeholder exactly once', () => {
    expect(
      withNativeSelectPlaceholder(
        [{ value: 'project-1', label: 'Project one' }],
        'Select a project'
      )
    ).toEqual([
      { value: '', label: 'Select a project' },
      { value: 'project-1', label: 'Project one' },
    ])
  })

  it('does not duplicate a placeholder represented by a real option label', () => {
    expect(
      withNativeSelectPlaceholder(
        [
          { value: 'raw', label: 'Raw' },
          { value: 'normalized', label: 'Normalized' },
        ],
        'Raw'
      )
    ).toEqual([
      { value: 'raw', label: 'Raw' },
      { value: 'normalized', label: 'Normalized' },
    ])
  })

  it('uses an explicit empty option instead of adding another placeholder', () => {
    expect(
      withNativeSelectPlaceholder(
        [
          { value: '', label: 'All' },
          { value: 'active', label: 'Active' },
        ],
        'All'
      )
    ).toEqual([
      { value: '', label: 'All' },
      { value: 'active', label: 'Active' },
    ])
  })
})
