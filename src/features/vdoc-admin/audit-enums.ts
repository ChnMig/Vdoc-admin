import type { TFunction } from '@/lib/i18n'

export const AUDIT_ACTION_LABELS = {
  'user.register': 'admin.audit.actions.user_register',
  'auth.login': 'admin.audit.actions.auth_login',
  'user.create': 'admin.audit.actions.user_create',
  'user.patch': 'admin.audit.actions.user_patch',
  'user.change_password': 'admin.audit.actions.user_change_password',
  'team.create': 'admin.audit.actions.team_create',
  'team.update': 'admin.audit.actions.team_update',
  'team.archive': 'admin.audit.actions.team_archive',
  'project.create': 'admin.audit.actions.project_create',
  'project.update': 'admin.audit.actions.project_update',
  'project.archive': 'admin.audit.actions.project_archive',
  'project_member.add': 'admin.audit.actions.project_member_add',
  'project_member.update_role':
    'admin.audit.actions.project_member_update_role',
  'project_member.remove': 'admin.audit.actions.project_member_remove',
  'api_service.create': 'admin.audit.actions.api_service_create',
  'api_service.update': 'admin.audit.actions.api_service_update',
  'api_service.archive': 'admin.audit.actions.api_service_archive',
  'document.create': 'admin.audit.actions.document_create',
  'document.update': 'admin.audit.actions.document_update',
  'document.archive': 'admin.audit.actions.document_archive',
  'document_folder.create': 'admin.audit.actions.document_folder_create',
  'contract_branch.create': 'admin.audit.actions.contract_branch_create',
  'contract_branch.update': 'admin.audit.actions.contract_branch_update',
  'contract_branch.archive': 'admin.audit.actions.contract_branch_archive',
  'contract_draft.create': 'admin.audit.actions.contract_draft_create',
  'contract_draft.promote': 'admin.audit.actions.contract_draft_promote',
  'contract_draft.update': 'admin.audit.actions.contract_draft_update',
  'contract_draft.submit': 'admin.audit.actions.contract_draft_submit',
  'contract_draft.review': 'admin.audit.actions.contract_draft_review',
  'markdown_draft.create': 'admin.audit.actions.markdown_draft_create',
  'markdown_draft.update': 'admin.audit.actions.markdown_draft_update',
  'markdown_draft.submit': 'admin.audit.actions.markdown_draft_submit',
  'markdown_draft.review': 'admin.audit.actions.markdown_draft_review',
  'document_version.publish': 'admin.audit.actions.document_version_publish',
  'api_version_diff.compare': 'admin.audit.actions.api_version_diff_compare',
  'markdown_version_diff.compare':
    'admin.audit.actions.markdown_version_diff_compare',
  'mcp_token.create': 'admin.audit.actions.mcp_token_create',
  'mcp_token.reveal': 'admin.audit.actions.mcp_token_reveal',
  'mcp_token.revoke': 'admin.audit.actions.mcp_token_revoke',
  'mcp_token.authenticate': 'admin.audit.actions.mcp_token_authenticate',
  'mcp.tool_call': 'admin.audit.actions.mcp_tool_call',
  'ai.provider.upsert': 'admin.audit.actions.ai_provider_upsert',
  'ai.provider.test': 'admin.audit.actions.ai_provider_test',
  'ai.provider.key.reveal': 'admin.audit.actions.ai_provider_key_reveal',
  'ai.prompt.upsert': 'admin.audit.actions.ai_prompt_upsert',
  'ai.chat.create': 'admin.audit.actions.ai_chat_create',
  'ai.chat.message': 'admin.audit.actions.ai_chat_message',
  'ai.summary.regenerate': 'admin.audit.actions.ai_summary_regenerate',
  'document_share.create': 'admin.audit.actions.document_share_create',
  'document_share.reveal': 'admin.audit.actions.document_share_reveal',
  'document_share.revoke': 'admin.audit.actions.document_share_revoke',
  'document_share.view': 'admin.audit.actions.document_share_view',
  'document_share.download': 'admin.audit.actions.document_share_download',
} as const

export const AUDIT_RESOURCE_LABELS = {
  user: 'admin.audit.resources.user',
  team: 'admin.audit.resources.team',
  project: 'admin.audit.resources.project',
  project_member: 'admin.audit.resources.project_member',
  api_service: 'admin.audit.resources.api_service',
  document: 'admin.audit.resources.document',
  document_folder: 'admin.audit.resources.document_folder',
  contract_branch: 'admin.audit.resources.contract_branch',
  contract_draft: 'admin.audit.resources.contract_draft',
  document_draft: 'admin.audit.resources.document_draft',
  document_version: 'admin.audit.resources.document_version',
  api_version_diff: 'admin.audit.resources.api_version_diff',
  document_version_diff: 'admin.audit.resources.document_version_diff',
  mcp_token: 'admin.audit.resources.mcp_token',
  mcp_tool: 'admin.audit.resources.mcp_tool',
  ai_provider: 'admin.audit.resources.ai_provider',
  ai_prompt: 'admin.audit.resources.ai_prompt',
  ai_chat_session: 'admin.audit.resources.ai_chat_session',
  ai_summary: 'admin.audit.resources.ai_summary',
  document_share: 'admin.audit.resources.document_share',
} as const

export type AuditAction = keyof typeof AUDIT_ACTION_LABELS
export type AuditResource = keyof typeof AUDIT_RESOURCE_LABELS

export function auditActionLabel(action: string, t: TFunction) {
  return action in AUDIT_ACTION_LABELS
    ? t(AUDIT_ACTION_LABELS[action as AuditAction])
    : t('admin.audit.unknownAction')
}

export function auditResourceLabel(resource: string, t: TFunction) {
  return resource in AUDIT_RESOURCE_LABELS
    ? t(AUDIT_RESOURCE_LABELS[resource as AuditResource])
    : t('admin.audit.unknownResource')
}
