import { describe, expect, it } from 'vitest'
import { documentSharePasswordError } from './document-share-password'

describe('document share password policy', () => {
  it('counts UTF-8 bytes instead of JavaScript characters', () => {
    expect('密码密码'.length).toBe(4)
    expect(documentSharePasswordError('密码密码')).toBeUndefined()
    expect(
      documentSharePasswordError(
        '密码密码密码密码密码密码密码密码密码密码密码密码密码密码密码密码密码密码密码密码密码密码密码密码密码'
      )
    ).toBe('bytes')
  })

  it('supports optional creation values but requires unlock values', () => {
    expect(documentSharePasswordError('', { optional: true })).toBeUndefined()
    expect(documentSharePasswordError('')).toBe('required')
  })

  it('rejects leading and trailing Unicode whitespace', () => {
    expect(documentSharePasswordError(' correct horse battery')).toBe(
      'whitespace'
    )
    expect(documentSharePasswordError('correct horse battery\u00a0')).toBe(
      'whitespace'
    )
  })
})
