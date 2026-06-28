import { useRef, useState } from 'react'
import type { AIProviderPayload } from '@/lib/vdoc-api'
import type { ProviderScope, ProviderTestState } from './ai-settings-types'

const idleProviderTestState = {
  status: 'idle',
} as const satisfies ProviderTestState

export type ProviderTestRequest = {
  readonly identity: string
  readonly providerIdentity: string
  readonly payload: AIProviderPayload
}

export type ProjectProviderTestRequest = ProviderTestRequest & {
  readonly projectId: string
}

type ProviderTestResponse = {
  readonly ok: boolean
  readonly content: string
}

type ProviderTestStore = {
  readonly activeIdentity?: string
  readonly providerIdentity: string
  readonly result: ProviderTestState
}

export function useProviderTestState(providerIdentity: string) {
  const requestCounterRef = useRef(0)
  const [store, setStore] = useState<ProviderTestStore>({
    providerIdentity,
    result: idleProviderTestState,
  })

  const visibleState =
    store.providerIdentity === providerIdentity
      ? store.result
      : idleProviderTestState

  return {
    state: visibleState,
    reset: () => {
      setStore({ providerIdentity, result: idleProviderTestState })
    },
    begin: (
      scope: ProviderScope,
      projectId: string,
      payload: AIProviderPayload
    ) => {
      requestCounterRef.current += 1
      const identity = providerTestIdentity(
        scope,
        projectId,
        requestCounterRef.current
      )
      setStore({
        activeIdentity: identity,
        providerIdentity,
        result: idleProviderTestState,
      })
      return { identity, providerIdentity, payload }
    },
    acceptResult: (
      request: ProviderTestRequest,
      result: ProviderTestResponse
    ) => {
      setStore((current) => {
        if (
          current.activeIdentity !== request.identity ||
          current.providerIdentity !== request.providerIdentity
        ) {
          return current
        }
        return {
          ...current,
          result: {
            status: result.ok ? 'success' : 'error',
            message: result.content,
          },
        }
      })
    },
    acceptError: (request: ProviderTestRequest, message: string) => {
      setStore((current) => {
        if (
          current.activeIdentity !== request.identity ||
          current.providerIdentity !== request.providerIdentity
        ) {
          return current
        }
        return {
          ...current,
          result: {
            status: 'error',
            message,
          },
        }
      })
    },
  }
}

function providerTestIdentity(
  scope: ProviderScope,
  projectId: string,
  requestId: number
) {
  return [scope, projectId, requestId].join('\u001f')
}
