/* eslint-disable @typescript-eslint/no-unused-vars -- Declaration merging requires matching generic parameters. */
import type { CellData, RowData, TableFeatures } from '@tanstack/react-table'

declare module '@tanstack/react-table' {
  interface ColumnMeta<
    TFeatures extends TableFeatures,
    TData extends RowData,
    TValue extends CellData = CellData,
  > {
    className?: string // apply to both th and td
    tdClassName?: string
    thClassName?: string
  }
}
