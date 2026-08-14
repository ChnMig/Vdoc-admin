import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createDocumentShare,
  listDocumentShares,
  revealDocumentShare,
  revokeDocumentShare,
} from './document-share-api'
import { vdocApi, type VdocEnvelope } from './vdoc-api'

const originalAdapter = vdocApi.defaults.adapter

afterEach(() => {
  vdocApi.defaults.adapter = originalAdapter
})

describe('document share management API', () => {
  it('uses exact project document management endpoints and payloads', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    vdocApi.defaults.adapter = shareAdapter(requests)

    await listDocumentShares('project-1', 'document-1')
    await createDocumentShare('project-1', 'document-1', {
      branch_id: 'branch-1',
      version_scope: 2,
      expiry_preset: '3_months',
    })
    await revealDocumentShare('project-1', 'document-1', 'share-1')
    await revokeDocumentShare('project-1', 'document-1', 'share-1')

    expect(requests.map(({ url }) => url)).toEqual([
      '/api/v1/private/projects/project-1/documents/document-1/shares',
      '/api/v1/private/projects/project-1/documents/document-1/shares',
      '/api/v1/private/projects/project-1/documents/document-1/shares/share-1/reveal',
      '/api/v1/private/projects/project-1/documents/document-1/shares/share-1/revoke',
    ])
    expect(requests[1]?.data).toBe(
      JSON.stringify({
        branch_id: 'branch-1',
        version_scope: 2,
        expiry_preset: '3_months',
      })
    )
    expect(requests[2]?.data).toBeUndefined()
    expect(requests[3]?.data).toBeUndefined()
  })
})

function shareAdapter(requests: InternalAxiosRequestConfig[]): AxiosAdapter {
  return async (config) => {
    requests.push(config)
    const detail = config.method === 'get' ? [] : shareDetail(config.url ?? '')
    return {
      data: {
        code: 200,
        status: 'OK',
        timestamp: 1,
        detail,
        ...(config.method === 'get' ? { total: 0 } : {}),
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    } satisfies AxiosResponse<VdocEnvelope<unknown>>
  }
}

function shareDetail(url: string) {
  const share = {
    id: 'share-1',
    project_id: 'project-1',
    document_id: 'document-1',
    branch_id: 'branch-1',
    version_scope: 2,
    status: 1,
    created_by: 'user-1',
    created_at: '2026-07-20T00:00:00Z',
    updated_at: '2026-07-20T00:00:00Z',
  }
  return url.endsWith('/revoke') ? share : { share, secret: 'redacted' }
}
