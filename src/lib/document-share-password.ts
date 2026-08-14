const DOCUMENT_SHARE_PASSWORD_MIN_BYTES = 12
const DOCUMENT_SHARE_PASSWORD_MAX_BYTES = 72

export type DocumentSharePasswordError = 'required' | 'bytes' | 'whitespace'

export function documentSharePasswordError(
  value: string,
  options: { readonly optional?: boolean } = {}
): DocumentSharePasswordError | undefined {
  if (value === '') return options.optional ? undefined : 'required'
  if (value.trim() !== value) return 'whitespace'

  const byteLength = new TextEncoder().encode(value).byteLength
  if (
    byteLength < DOCUMENT_SHARE_PASSWORD_MIN_BYTES ||
    byteLength > DOCUMENT_SHARE_PASSWORD_MAX_BYTES
  ) {
    return 'bytes'
  }
  return undefined
}
