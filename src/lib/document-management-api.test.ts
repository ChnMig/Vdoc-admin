import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  deleteRepositoryDocument,
  updateRepositoryDocumentMetadata,
} from './document-management-api'
import { vdocApi } from './vdoc-api'

afterEach(() => vi.restoreAllMocks())

describe('document management API', () => {
  it('keeps structured server errors from HTTP failures for inline retry feedback', async () => {
    const patch = vi.spyOn(vdocApi, 'patch').mockRejectedValue({
      isAxiosError: true,
      response: {
        data: {
          code: 409,
          status: 'ABORTED',
          description: 'This path already exists.',
          timestamp: 1,
        },
      },
    })
    await expect(
      updateRepositoryDocumentMetadata('project/one', 'document/two', {
        name: 'Updated',
      })
    ).rejects.toMatchObject({
      name: 'VdocApiError',
      code: 409,
      message: 'This path already exists.',
    })
    expect(patch).toHaveBeenCalledWith(
      '/api/v1/private/projects/project%2Fone/repository/documents/document%2Ftwo',
      { name: 'Updated' }
    )
  })

  it('deletes by stable document ID and propagates transport failures', async () => {
    const error = new Error('Connection unavailable')
    const remove = vi.spyOn(vdocApi, 'delete').mockRejectedValue(error)
    await expect(deleteRepositoryDocument('project', 'document')).rejects.toBe(
      error
    )
    expect(remove).toHaveBeenCalledWith(
      '/api/v1/private/projects/project/repository/documents/document'
    )
  })
})
