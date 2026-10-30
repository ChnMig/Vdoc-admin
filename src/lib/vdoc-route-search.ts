import { z } from 'zod/mini'

const optionalEntityId = z.optional(
  z.pipe(
    z.transform((value: unknown) => {
      if (typeof value !== 'string') return undefined
      const normalized = value.trim()
      return normalized.length > 0 && normalized.length <= 128
        ? normalized
        : undefined
    }),
    z.optional(z.string())
  )
)

export const vdocRouteSearchSchema = z.object({
  team_id: optionalEntityId,
  project_id: optionalEntityId,
  folder_id: optionalEntityId,
  document_id: optionalEntityId,
  repository_branch_id: optionalEntityId,
  commit_id: optionalEntityId,
  repository_view: z.catch(
    z.optional(
      z.enum([
        'content',
        'edit',
        'history',
        'compare',
        'merges',
        'releases',
        'events',
        'ai',
      ])
    ),
    undefined
  ),
  branch_id: optionalEntityId,
  draft_id: optionalEntityId,
  version_id: optionalEntityId,
  endpoint_id: optionalEntityId,
  from_branch_id: optionalEntityId,
  to_branch_id: optionalEntityId,
  from_draft_id: optionalEntityId,
  to_draft_id: optionalEntityId,
  from_version_id: optionalEntityId,
  to_version_id: optionalEntityId,
  diff_id: optionalEntityId,
  token_id: optionalEntityId,
  content_mode: z.catch(z.optional(z.enum(['published', 'draft'])), undefined),
  workspace_view: z.catch(
    z.optional(
      z.enum([
        'content',
        'drafts',
        'versions',
        'activity',
        'diffs',
        'share',
        'manage',
        'ai',
      ])
    ),
    undefined
  ),
})

export type VdocRouteSearch = z.infer<typeof vdocRouteSearchSchema>

export type VdocPageDeepLinkProps = {
  search?: VdocRouteSearch
  onSearchChange?: (
    patch: Partial<VdocRouteSearch>,
    options?: { replace?: boolean }
  ) => void
}
