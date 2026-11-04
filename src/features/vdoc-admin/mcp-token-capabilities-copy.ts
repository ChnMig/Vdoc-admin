import type { Language } from '@/lib/i18n'

// Detail-only copy stays in the lazy MCP page instead of the application entry.
const en = {
  capabilitiesTitle: 'Token capabilities',
  inactiveCapabilities:
    'This token is revoked or expired and cannot call tools. Its original permissions are shown below.',
  permissionGranted: 'Granted',
  permissionNotGranted: 'Not granted',
  permissionPartial: 'Limited · legacy',
  readSummary: 'Discover, search and read content and history.',
  writeSummary: 'Create, update, move and delete authorized resources.',
  legacyPermissions:
    'This token keeps its original authorization. Limited permissions do not cover every document. Create a new token to use unified capabilities.',
  allowedActions: 'Allowed operations',
  readCapabilities:
    'Discover teams, projects and folders; search and read authorized documents, full source, versions and comparisons.',
  writeCapabilities:
    'Create documents, branches, saved versions and merge requests; rename and move documents, and manage folders. Writing does not grant reading.',
  managementCapabilities:
    'Renaming, moving or deleting documents and managing folders require a project administrator. Only empty folders can be deleted. Document deletion disables its public shares.',
  patchCapabilities:
    'Apply exact text changes when both read and write permissions are granted.',
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
  permissionPartial: '部分授权 · 旧密钥',
  readSummary: '查找资源，搜索和读取内容与历史。',
  writeSummary: '创建、修改、移动和删除已授权资源。',
  legacyPermissions:
    '此密钥保留原有授权，部分授权不代表可以操作所有文档。新建密钥即可使用统一的能力权限。',
  allowedActions: '可执行操作',
  readCapabilities:
    '查找团队、项目和文件夹；搜索、读取已授权文档、完整原文、历史版本和差异。',
  writeCapabilities:
    '创建文档、分支、新版本和合并请求；重命名、移动文档和管理文件夹。写入权限不包含读取权限。',
  managementCapabilities:
    '重命名、移动、删除文档和管理文件夹需要项目管理员权限；只能删除空文件夹。删除文档也会停用其公开分享。',
  patchCapabilities: '同时具备读写权限时，可执行精确文本修改。',
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
