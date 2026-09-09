import type { QueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'

export function bindQueryCacheToAuth(queryClient: QueryClient): () => void {
  return useAuthStore.subscribe((state, previous) => {
    if (
      state.auth.accessToken === previous.auth.accessToken &&
      state.auth.user?.id === previous.auth.user?.id
    ) {
      return
    }

    // Clear synchronously at every session boundary. Query cancellation also
    // prevents a late response from repopulating the next account's cache.
    void queryClient.cancelQueries()
    queryClient.clear()
  })
}
