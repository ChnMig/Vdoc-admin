export type NativeSelectOption = {
  readonly value: string
  readonly label: string
}

export function withNativeSelectPlaceholder<Option extends NativeSelectOption>(
  options: readonly Option[],
  placeholder: string
): readonly NativeSelectOption[] {
  const placeholderAlreadyRepresented = options.some(
    (option) => option.value === '' || option.label === placeholder
  )

  return placeholderAlreadyRepresented
    ? options
    : [{ value: '', label: placeholder }, ...options]
}
