const USER_PASSWORD_MIN_BYTES = 12
const USER_PASSWORD_MAX_BYTES = 72
const boundaryUnicodeWhitespace = /^\p{White_Space}|\p{White_Space}$/u

export type UserPasswordError = 'required' | 'bytes' | 'whitespace'

export function userPasswordError(
  value: string
): UserPasswordError | undefined {
  if (value === '') return 'required'
  if (boundaryUnicodeWhitespace.test(value)) return 'whitespace'

  const byteLength = new TextEncoder().encode(value).byteLength
  if (
    byteLength < USER_PASSWORD_MIN_BYTES ||
    byteLength > USER_PASSWORD_MAX_BYTES
  ) {
    return 'bytes'
  }
  return undefined
}
