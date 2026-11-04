import type { Language } from '@/lib/i18n'

// Detail-only copy stays in the lazy MCP page instead of the application entry.
const en = {
  capabilitiesTitle: 'Token capabilities',
  inactiveCapabilities:
    'This token is revoked or expired and cannot call tools. Its original permissions are shown below.',
  permissionGranted: 'Granted',
  permissionNotGranted: 'Not granted',
  allowedActions: 'Allowed operations',
  readCapabilities:
    'Discover teams and projects; search and read authorized documents, full source, versions and comparisons.',
  writeCapabilities:
    'Create authorized document types, branches, saved versions and merge requests. Writing does not grant reading.',
  patchCapabilities:
    'Apply exact text changes to document types with both read and write permissions.',
  noKnownCapabilities: 'No supported document permissions are granted.',
  accessBoundary: 'Access boundary',
  crossProjectAccess:
    'One client configuration works across this account’s teams and projects. It is not bound to a single project.',
  roleBoundary:
    'Only projects accessible to the token owner are available. Reading requires Reader or above; writing requires Writer or above. Removing project access also removes this token’s access.',
  publishBoundary:
    'MCP cannot approve merges or publish releases. These actions require a human in the workbench.',
}

const zhCN = {
  capabilitiesTitle: '密钥能力范围',
  inactiveCapabilities:
    '此密钥已撤销或过期，无法调用工具。下方展示其原有授权。',
  permissionGranted: '已授权',
  permissionNotGranted: '未授权',
  allowedActions: '可执行操作',
  readCapabilities:
    '查找团队和项目；搜索、读取已授权类型的文档、完整原文、历史版本和差异。',
  writeCapabilities:
    '创建已授权类型的文档、分支、新版本和合并请求。写入权限不包含读取权限。',
  patchCapabilities: '对同时具备读写权限的文档类型执行精确文本修改。',
  noKnownCapabilities: '未授予受支持的文档权限。',
  accessBoundary: '访问边界',
  crossProjectAccess:
    '同一份客户端配置可用于此账号的不同团队和项目，无需按项目重复配置。',
  roleBoundary:
    '仅可访问密钥所属用户有权进入的项目。读取需要 Reader 及以上角色，写入需要 Writer 及以上角色；移除项目权限后，密钥也随之失去访问权。',
  publishBoundary:
    'MCP 不能批准合并或发布版本，这些操作需要在工作台由人工完成。',
} satisfies Record<keyof typeof en, string>

export const tokenCapabilityCopy: Record<Language, typeof en> = {
  en,
  'zh-CN': zhCN,
}
