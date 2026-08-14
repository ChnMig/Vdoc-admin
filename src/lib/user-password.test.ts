import { describe, expect, it } from 'vitest'
import { userPasswordError } from './user-password'

describe('user password policy', () => {
  it('enforces the bcrypt boundary in UTF-8 bytes', () => {
    expect(userPasswordError('密码密码')).toBeUndefined()
    expect(userPasswordError('密码密')).toBe('bytes')
    expect(userPasswordError('密'.repeat(24))).toBeUndefined()
    expect(userPasswordError('密'.repeat(25))).toBe('bytes')
  })

  it('rejects Unicode whitespace only at credential boundaries', () => {
    expect(userPasswordError('\u0085correct horse battery')).toBe('whitespace')
    expect(userPasswordError('correct horse battery\u00a0')).toBe('whitespace')
    expect(userPasswordError('correct horse battery')).toBeUndefined()
  })
})
