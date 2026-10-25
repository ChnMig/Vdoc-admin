import { z } from 'zod'

const optionalEntityId = z.preprocess((value) => {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized.length > 0 && normalized.length <= 128
    ? normalized
    : undefined
}, z.string().optional())

export const vdocRouteSearchSchema = z.object({
  team_id: optionalEntityId,
  project_id: optionalEntityId,
  folder_id: optionalEntityId,
  document_id: optionalEntityId,
  branch_id: optionalEntityId,
  draft_id: optionalEntityId,
  version_id: optionalEntityId,
  endpoint_id: optionalEntityId,
  from_version_id: optionalEntityId,
  to_version_id: optionalEntityId,
  diff_id: optionalEntityId,
  token_id: optionalEntityId,
  content_mode: z.enum(['published', 'draft']).optional().catch(undefined),
  workspace_view: z
    .enum(['content', 'drafts', 'versions', 'diffs', 'share', 'manage', 'ai'])
    .optional()
    .catch(undefined),
})

export type VdocRouteSearch = z.infer<typeof vdocRouteSearchSchema>

export type VdocPageDeepLinkProps = {
  search?: VdocRouteSearch
  onSearchChange?: (
    patch: Partial<VdocRouteSearch>,
    options?: { replace?: boolean }
  ) => void
}
