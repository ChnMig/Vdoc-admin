import type { QueryClient, QueryKey } from '@tanstack/react-query'

export type VdocChange =
  | { kind: 'document'; projectId: string; documentId?: string }
  | { kind: 'project'; projectId: string }
  | { kind: 'users' | 'teams' | 'tokens' }

const documentQueries = new Set([
  'branches',
  'drafts',
  'draft-content',
  'versions',
  'version',
  'version-content',
  'endpoints',
  'endpoint',
  'diffs',
  'diff-summary',
  'document-shares',
  'document-overview',
  'mcp-readiness',
])

function resourceContext(key: QueryKey) {
  if (key[0] === 'ai-summary' || key[0] === 'ai-chat-sessions') {
    const target = key.find(
      (part) => part && typeof part === 'object' && 'projectId' in part
    ) as { projectId?: string; documentId?: string } | undefined
    return [target?.projectId, target?.documentId]
  }
  if (key[0] === 'ai-chat-session' && typeof key[1] === 'string') {
    try {
      return JSON.parse(key[1]) as unknown[]
    } catch {
      return []
    }
  }
  if (key[0] === 'ai-provider' || key[0] === 'ai-prompts')
    return [key[2], undefined]
  return [key[1], key[2]]
}

export function queryAffectedByChange(
  key: QueryKey,
  change: VdocChange
): boolean {
  const root = String(key[0])
  // 审计页既有项目筛选，也有管理员全局视图。
  if (root === 'audit-logs') {
    return !('projectId' in change) || !key[1] || key[1] === change.projectId
  }
  if (change.kind === 'tokens')
    return [
      'mcp-tokens',
      'user-mcp-tokens',
      'mcp-usage',
      'mcp-readiness',
    ].includes(root)
  if (change.kind === 'teams') return root === 'teams'
  if (change.kind === 'users')
    return [
      'users',
      'identity',
      'projects',
      'project-members',
      'project-member-candidates',
      'user-mcp-tokens',
      'mcp-tokens',
      'mcp-readiness',
    ].includes(root)
  if (!('projectId' in change)) return false
  const [projectId, documentId] = resourceContext(key)
  if (change.kind === 'project' && root === 'projects') return true
  if (projectId !== change.projectId) return false
  if (root === 'documents') return true
  if (
    change.kind === 'project' &&
    [
      'project-members',
      'project-member-candidates',
      'ai-provider',
      'ai-prompts',
    ].includes(root)
  )
    return true
  if (
    !documentQueries.has(root) &&
    !['ai-summary', 'ai-chat-sessions', 'ai-chat-session'].includes(root)
  )
    return false
  return (
    change.kind === 'project' ||
    !change.documentId ||
    documentId === change.documentId
  )
}

export function invalidateVdocQueries(client: QueryClient, change: VdocChange) {
  return client.invalidateQueries({
    predicate: ({ queryKey }) => queryAffectedByChange(queryKey, change),
  })
}
