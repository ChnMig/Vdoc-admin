import type { MCPTokenDTO } from './vdoc-api'

export const MCP_SCOPE_READ = 5
export const MCP_SCOPE_WRITE = 6

export function mcpTokenPermissions(token: Pick<MCPTokenDTO, 'scopes'>) {
  const has = (scope: number) => token.scopes.includes(scope)
  const reads = [has(MCP_SCOPE_READ) || has(1), has(MCP_SCOPE_READ) || has(3)]
  const writes = [
    has(MCP_SCOPE_WRITE) || has(2),
    has(MCP_SCOPE_WRITE) || has(4),
  ]
  const level = (permissions: boolean[]) =>
    permissions.every(Boolean)
      ? 'full'
      : permissions.some(Boolean)
        ? 'partial'
        : 'none'
  return {
    read: level(reads),
    write: level(writes),
    canRead: reads.some(Boolean),
    canWrite: writes.some(Boolean),
    canPatch: reads.some((read, index) => read && writes[index]),
    legacy: token.scopes.some((scope) => scope >= 1 && scope <= 4),
  } as const
}
