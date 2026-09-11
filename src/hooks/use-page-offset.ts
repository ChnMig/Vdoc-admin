import { useState } from 'react'

export function usePageOffset(scope: string) {
  const [page, setPage] = useState({ scope, offset: 0 })
  const offset = page.scope === scope ? page.offset : 0
  return [
    offset,
    (value: number) => setPage({ scope, offset: Math.max(0, value) }),
  ] as const
}
