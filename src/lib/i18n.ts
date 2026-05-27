import { getCookie } from '@/lib/cookies'

export const languages = ['en', 'zh-CN'] as const
export type Language = (typeof languages)[number]

export const DEFAULT_LANGUAGE: Language = 'en'
export const LANGUAGE_COOKIE_NAME = 'vdoc-admin-language'
export const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const en = {
  app: {
    name: 'Vdoc Admin',
    serviceConsole: 'Service Console',
    consoleLabel: 'Vdoc Console',
    dashboardPreviewAlt: 'Vdoc Admin dashboard preview',
    skipToMain: 'Skip to main content',
    sidebarTitle: 'Sidebar',
    mobileSidebarDescription: 'Displays the mobile sidebar.',
    toggleSidebar: 'Toggle Sidebar',
    toggleNavigation: 'Toggle navigation menu',
  },
  language: {
    label: 'Language',
    switchLabel: 'Language: {language}',
    english: 'English',
    chinese: 'Chinese',
    englishShort: 'EN',
    chineseShort: '中文',
  },
  nav: {
    groupVdoc: 'Vdoc',
    dashboard: 'Dashboard',
    users: 'Users',
    teams: 'Teams',
    projects: 'Projects',
    documents: 'Documents',
    drafts: 'Drafts',
    versions: 'Versions',
    diffs: 'Diffs',
    mcpTokens: 'MCP Tokens',
    settings: 'Settings',
  },
  team: {
    label: 'Teams',
    add: 'Add team',
    serviceConsolePlan: 'Service Console',
  },
  search: {
    button: 'Search',
    placeholder: 'Type a command or search...',
    empty: 'No results found.',
  },
  command: {
    title: 'Command Palette',
    description: 'Search for a command to run...',
    themeGroup: 'Theme',
  },
  theme: {
    toggle: 'Toggle theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  },
  profile: {
    settings: 'Settings',
    signOut: 'Sign out',
    notSignedIn: 'Not signed in',
    dialogDescription:
      'Are you sure you want to sign out? You will need to sign in again to access your account.',
  },
  common: {
    cancel: 'Cancel',
    continue: 'Continue',
  },
  passwordInput: {
    show: 'Show password',
    hide: 'Hide password',
  },
  dashboard: {
    eyebrow: 'Vdoc Admin',
    title: 'Service Console',
    description:
      'Starter shell for managing Vdoc users, teams, projects, documents, drafts, versions, diffs, and MCP tokens.',
    overview: {
      projects: {
        title: 'Projects',
        value: 'Ready',
        description: 'Project management APIs are connected',
      },
      documents: {
        title: 'Documents',
        value: 'OpenAPI + Markdown',
        description: 'Versioned contract and document surfaces retained',
      },
      drafts: {
        title: 'Drafts',
        value: 'Review-first',
        description: 'Human approval remains the publication boundary',
      },
      mcpTokens: {
        title: 'MCP Tokens',
        value: 'Raw tokens',
        description: 'Agent access follows Vdoc backend token APIs',
      },
    },
    workflow: {
      organize: {
        title: '1. Organize',
        body: 'Super admins create users, teams, projects, and memberships from the console.',
      },
      review: {
        title: '2. Review',
        body: 'Writers and agents submit drafts; admins inspect schema, Markdown, versions, and diffs.',
      },
      publish: {
        title: '3. Publish',
        body: 'Approved drafts become immutable Vdoc versions with stable comparison history.',
      },
    },
  },
  admin: {
    common: {
      loading: 'Loading backend data...',
      error: 'Backend request failed',
      empty: 'No records returned by the backend.',
      create: 'Create',
      update: 'Update',
      archive: 'Archive',
      revoke: 'Revoke',
      submit: 'Submit',
      approve: 'Approve',
      requestChanges: 'Request changes',
      reject: 'Reject',
      promote: 'Promote',
      refresh: 'Refresh',
      save: 'Save',
      view: 'View',
      compare: 'Compare',
      selected: 'Selected',
      none: 'None',
      yes: 'Yes',
      no: 'No',
      total: 'Total',
      endpoint: 'Endpoint',
      active: 'Active',
      archived: 'Archived',
      revoked: 'Revoked',
      unknown: 'Unknown',
      generated: 'Generated',
      tokenWarning: 'Copy this token now. The backend may not return it again.',
      attribution: 'Vdoc Admin keeps the upstream template attribution while replacing starter template data with Vdoc backend API calls.',
    },
    fields: {
      id: 'ID',
      name: 'Name',
      email: 'Email',
      password: 'Password',
      description: 'Description',
      status: 'Status',
      actions: 'Actions',
      createdAt: 'Created at',
      updatedAt: 'Updated at',
      project: 'Project',
      team: 'Team',
      user: 'User',
      document: 'Document',
      branch: 'Branch',
      version: 'Version',
      draft: 'Draft',
      role: 'Role',
      type: 'Type',
      path: 'Path',
      relativePath: 'Relative path',
      versionName: 'Version name',
      changelog: 'Changelog',
      gitCommit: 'Git commit',
      content: 'Content',
      contentKind: 'Content kind',
      scopes: 'Scopes',
      expiresAt: 'Expires at',
      superAdmin: 'Super admin',
      fromVersion: 'From version',
      toVersion: 'To version',
      method: 'Method',
      summary: 'Summary',
      request: 'Request',
      response: 'Response',
      theme: 'Theme',
      language: 'Language',
      session: 'Session',
      apiBaseUrl: 'API base URL',
      health: 'Health',
      identity: 'Identity',
    },
    placeholders: {
      selectProject: 'Select a project',
      selectDocument: 'Select a document',
      selectVersion: 'Select a version',
      selectBranch: 'Select a branch',
      selectUser: 'Select a user',
      optionalIsoDate: 'Optional ISO date',
      endpointPath: 'Filter endpoint path',
    },
    pages: {
      dashboard: {
        title: 'Live Service Console',
        description: 'Real-time status and counts from the Vdoc backend APIs.',
        health: 'Backend health',
        identity: 'Signed-in identity',
      },
      users: {
        title: 'Users',
        description: 'List users, create accounts, patch status, and oversee user MCP tokens.',
      },
      teams: {
        title: 'Teams',
        description: 'Create, update, and archive Vdoc teams.',
      },
      projects: {
        title: 'Projects',
        description: 'Manage projects and project membership using real backend APIs.',
      },
      documents: {
        title: 'Documents',
        description: 'Select a project, then manage documents and branches.',
      },
      drafts: {
        title: 'Drafts',
        description: 'Create, update, review, and inspect draft content.',
      },
      versions: {
        title: 'Versions',
        description: 'Browse published versions, content, and OpenAPI endpoints.',
      },
      diffs: {
        title: 'Diffs',
        description: 'Compare two versions on demand. Vdoc has no diff history list endpoint.',
      },
      mcpTokens: {
        title: 'MCP Tokens',
        description: 'List, create, inspect, and revoke current-user MCP tokens.',
      },
      settings: {
        title: 'Settings',
        description: 'Read-only runtime settings from the current admin session.',
      },
    },
    sections: {
      createUser: 'Create user',
      createTeam: 'Create team',
      createProject: 'Create project',
      createDocument: 'Create document',
      createBranch: 'Create branch',
      createDraft: 'Create or update draft',
      createToken: 'Create MCP token',
      members: 'Project members',
      branches: 'Branches',
      drafts: 'Drafts',
      versions: 'Versions',
      endpoints: 'OpenAPI endpoints',
      diffResult: 'Diff result',
      contentViewer: 'Content viewer',
      dependencies: 'Dependencies',
      userTokens: 'Selected user MCP tokens',
    },
    statuses: {
      enabled: 'Enabled',
      disabled: 'Disabled',
      active: 'Active',
      archived: 'Archived',
      pending: 'Pending',
      submitted: 'Submitted',
      approved: 'Approved',
      rejected: 'Rejected',
      changesRequested: 'Changes requested',
      ready: 'Ready',
      degraded: 'Degraded',
    },
    roles: {
      reader: 'Reader',
      writer: 'Writer',
      admin: 'Admin',
    },
    types: {
      openapi: 'OpenAPI',
      markdown: 'Markdown',
      raw: 'Raw',
      stable: 'Stable',
      normalized: 'Normalized',
    },
  },
  auth: {
    brand: 'Vdoc Admin',
    email: 'Email',
    password: 'Password',
    name: 'Name',
    confirmPassword: 'Confirm Password',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    validation: {
      email: 'Please enter your email.',
      password: 'Please enter your password.',
      passwordLength: 'Password must be at least 7 characters long.',
      confirmPassword: 'Please confirm your password.',
      passwordMismatch: "Passwords don't match.",
    },
    signIn: {
      title: 'Sign in',
      description:
        'Enter your email and password below to log into your account.',
      noAccount: "Don't have an account?",
      link: 'Sign Up',
      submit: 'Sign in to Vdoc',
      footerPrefix: 'By clicking sign in, you agree to our',
      footerConnector: 'and',
      welcomeBack: 'Welcome back, {name}.',
    },
    signUp: {
      title: 'Create an account',
      description: 'Enter your email and password to create an account.',
      haveAccount: 'Already have an account?',
      link: 'Sign In',
      submit: 'Create Vdoc account',
      footerPrefix: 'By creating an account, you agree to our',
      created: 'Vdoc account created.',
    },
  },
  toasts: {
    contentNotModified: 'Content not modified!',
    sessionExpired: 'Session expired!',
    internalServerError: 'Internal Server Error!',
    somethingWrong: 'Something went wrong!',
    noContent: 'No content.',
  },
  errors: {
    goBack: 'Go Back',
    backHome: 'Back to Home',
    notFoundTitle: 'Oops! Page Not Found!',
    notFoundDescription:
      "It seems like the page you're looking for does not exist or might have been removed.",
    generalTitle: 'Oops! Something went wrong {smile}',
    generalDescription:
      'We apologize for the inconvenience. Please try again later.',
    forbiddenTitle: 'Access Forbidden',
    forbiddenDescription:
      "You don't have necessary permission to view this resource.",
    unauthorizedTitle: 'Unauthorized Access',
    unauthorizedDescription:
      'Please log in with the appropriate credentials to access this resource.',
    maintenanceTitle: 'Website is under maintenance!',
    maintenanceDescription:
      "The site is not available at the moment. We'll be back online shortly.",
    learnMore: 'Learn more',
  },
}

type WidenMessages<T> = {
  [Key in keyof T]: T[Key] extends string ? string : WidenMessages<T[Key]>
}

type Messages = WidenMessages<typeof en>

type LeafPaths<T> = {
  [Key in keyof T & string]: T[Key] extends string
    ? Key
    : `${Key}.${LeafPaths<T[Key]>}`
}[keyof T & string]

export type TranslationKey = LeafPaths<Messages>
export type TranslationValues = Record<string, string | number>
export type TFunction = (
  key: TranslationKey,
  values?: TranslationValues
) => string

const zhCN = {
  app: {
    name: 'Vdoc Admin',
    serviceConsole: '服务控制台',
    consoleLabel: 'Vdoc 控制台',
    dashboardPreviewAlt: 'Vdoc Admin 仪表盘预览',
    skipToMain: '跳到主内容',
    sidebarTitle: '侧边栏',
    mobileSidebarDescription: '显示移动端侧边栏。',
    toggleSidebar: '切换侧边栏',
    toggleNavigation: '切换导航菜单',
  },
  language: {
    label: '语言',
    switchLabel: '语言：{language}',
    english: '英文',
    chinese: '中文',
    englishShort: 'EN',
    chineseShort: '中文',
  },
  nav: {
    groupVdoc: 'Vdoc',
    dashboard: '仪表盘',
    users: '用户',
    teams: '团队',
    projects: '项目',
    documents: '文档',
    drafts: '草稿',
    versions: '版本',
    diffs: '差异',
    mcpTokens: 'MCP 令牌',
    settings: '设置',
  },
  team: {
    label: '团队',
    add: '添加团队',
    serviceConsolePlan: '服务控制台',
  },
  search: {
    button: '搜索',
    placeholder: '输入命令或搜索...',
    empty: '没有找到结果。',
  },
  command: {
    title: '命令面板',
    description: '搜索要执行的命令...',
    themeGroup: '主题',
  },
  theme: {
    toggle: '切换主题',
    light: '浅色',
    dark: '深色',
    system: '跟随系统',
  },
  profile: {
    settings: '设置',
    signOut: '退出登录',
    notSignedIn: '未登录',
    dialogDescription: '确定要退出登录吗？你需要重新登录才能访问账号。',
  },
  common: {
    cancel: '取消',
    continue: '继续',
  },
  passwordInput: {
    show: '显示密码',
    hide: '隐藏密码',
  },
  dashboard: {
    eyebrow: 'Vdoc Admin',
    title: '服务控制台',
    description:
      '用于管理 Vdoc 用户、团队、项目、文档、草稿、版本、差异和 MCP 令牌的起始管理外壳。',
    overview: {
      projects: {
        title: '项目',
        value: '就绪',
        description: '项目管理 API 已连接',
      },
      documents: {
        title: '文档',
        value: 'OpenAPI + Markdown',
        description: '保留版本化契约和文档界面',
      },
      drafts: {
        title: '草稿',
        value: '先审阅',
        description: '人工批准仍是发布边界',
      },
      mcpTokens: {
        title: 'MCP 令牌',
        value: '原始令牌',
        description: 'Agent 访问遵循 Vdoc 后端令牌 API',
      },
    },
    workflow: {
      organize: {
        title: '1. 组织',
        body: '超级管理员可在控制台创建用户、团队、项目和成员关系。',
      },
      review: {
        title: '2. 审阅',
        body: '写作者和 Agent 提交草稿；管理员检查 schema、Markdown、版本和差异。',
      },
      publish: {
        title: '3. 发布',
        body: '批准后的草稿会成为不可变的 Vdoc 版本，并保留稳定的比较历史。',
      },
    },
  },
  admin: {
    common: {
      loading: '正在加载后端数据...',
      error: '后端请求失败',
      empty: '后端未返回记录。',
      create: '创建',
      update: '更新',
      archive: '归档',
      revoke: '撤销',
      submit: '提交',
      approve: '批准',
      requestChanges: '请求修改',
      reject: '拒绝',
      promote: '提升',
      refresh: '刷新',
      save: '保存',
      view: '查看',
      compare: '比较',
      selected: '已选择',
      none: '无',
      yes: '是',
      no: '否',
      total: '总数',
      endpoint: '端点',
      active: '激活',
      archived: '已归档',
      revoked: '已撤销',
      unknown: '未知',
      generated: '已生成',
      tokenWarning: '请立即复制此令牌。后端可能不会再次返回。',
      attribution: 'Vdoc Admin 保留上游模板署名，同时用 Vdoc 后端 API 调用替换模板起始数据。',
    },
    fields: {
      id: 'ID',
      name: '名称',
      email: '邮箱',
      password: '密码',
      description: '描述',
      status: '状态',
      actions: '操作',
      createdAt: '创建时间',
      updatedAt: '更新时间',
      project: '项目',
      team: '团队',
      user: '用户',
      document: '文档',
      branch: '分支',
      version: '版本',
      draft: '草稿',
      role: '角色',
      type: '类型',
      path: '路径',
      relativePath: '相对路径',
      versionName: '版本名',
      changelog: '变更日志',
      gitCommit: 'Git 提交',
      content: '内容',
      contentKind: '内容类型',
      scopes: '范围',
      expiresAt: '过期时间',
      superAdmin: '超级管理员',
      fromVersion: '源版本',
      toVersion: '目标版本',
      method: '方法',
      summary: '摘要',
      request: '请求',
      response: '响应',
      theme: '主题',
      language: '语言',
      session: '会话',
      apiBaseUrl: 'API 基础地址',
      health: '健康状态',
      identity: '身份',
    },
    placeholders: {
      selectProject: '选择项目',
      selectDocument: '选择文档',
      selectVersion: '选择版本',
      selectBranch: '选择分支',
      selectUser: '选择用户',
      optionalIsoDate: '可选 ISO 日期',
      endpointPath: '筛选端点路径',
    },
    pages: {
      dashboard: {
        title: '实时服务控制台',
        description: '来自 Vdoc 后端 API 的实时状态和计数。',
        health: '后端健康状态',
        identity: '当前登录身份',
      },
      users: {
        title: '用户',
        description: '列出用户、创建账号、修补状态，并监管用户 MCP 令牌。',
      },
      teams: {
        title: '团队',
        description: '创建、更新和归档 Vdoc 团队。',
      },
      projects: {
        title: '项目',
        description: '使用真实后端 API 管理项目和项目成员关系。',
      },
      documents: {
        title: '文档',
        description: '选择项目后管理文档和分支。',
      },
      drafts: {
        title: '草稿',
        description: '创建、更新、审阅并检查草稿内容。',
      },
      versions: {
        title: '版本',
        description: '浏览已发布版本、内容和 OpenAPI 端点。',
      },
      diffs: {
        title: '差异',
        description: '按需比较两个版本。Vdoc 没有差异历史列表端点。',
      },
      mcpTokens: {
        title: 'MCP 令牌',
        description: '列出、创建、查看和撤销当前用户的 MCP 令牌。',
      },
      settings: {
        title: '设置',
        description: '从当前管理会话读取运行时设置。',
      },
    },
    sections: {
      createUser: '创建用户',
      createTeam: '创建团队',
      createProject: '创建项目',
      createDocument: '创建文档',
      createBranch: '创建分支',
      createDraft: '创建或更新草稿',
      createToken: '创建 MCP 令牌',
      members: '项目成员',
      branches: '分支',
      drafts: '草稿',
      versions: '版本',
      endpoints: 'OpenAPI 端点',
      diffResult: '差异结果',
      contentViewer: '内容查看器',
      dependencies: '依赖',
      userTokens: '所选用户 MCP 令牌',
    },
    statuses: {
      enabled: '启用',
      disabled: '停用',
      active: '激活',
      archived: '已归档',
      pending: '待处理',
      submitted: '已提交',
      approved: '已批准',
      rejected: '已拒绝',
      changesRequested: '请求修改',
      ready: '就绪',
      degraded: '降级',
    },
    roles: {
      reader: '只读',
      writer: '写作',
      admin: '管理员',
    },
    types: {
      openapi: 'OpenAPI',
      markdown: 'Markdown',
      raw: '原始',
      stable: '稳定',
      normalized: '规范化',
    },
  },
  auth: {
    brand: 'Vdoc Admin',
    email: '邮箱',
    password: '密码',
    name: '姓名',
    confirmPassword: '确认密码',
    terms: '服务条款',
    privacy: '隐私政策',
    validation: {
      email: '请输入邮箱。',
      password: '请输入密码。',
      passwordLength: '密码至少需要 7 个字符。',
      confirmPassword: '请确认密码。',
      passwordMismatch: '两次输入的密码不一致。',
    },
    signIn: {
      title: '登录',
      description: '请输入邮箱和密码登录你的账号。',
      noAccount: '还没有账号？',
      link: '注册',
      submit: '登录 Vdoc',
      footerPrefix: '点击登录即表示你同意我们的',
      footerConnector: '和',
      welcomeBack: '欢迎回来，{name}。',
    },
    signUp: {
      title: '创建账号',
      description: '请输入邮箱和密码来创建账号。',
      haveAccount: '已经有账号？',
      link: '登录',
      submit: '创建 Vdoc 账号',
      footerPrefix: '创建账号即表示你同意我们的',
      created: 'Vdoc 账号已创建。',
    },
  },
  toasts: {
    contentNotModified: '内容未修改！',
    sessionExpired: '会话已过期！',
    internalServerError: '服务器内部错误！',
    somethingWrong: '出现了一些问题！',
    noContent: '没有内容。',
  },
  errors: {
    goBack: '返回',
    backHome: '回到首页',
    notFoundTitle: '糟糕！页面未找到！',
    notFoundDescription: '你要查找的页面不存在，或可能已经被移除。',
    generalTitle: '糟糕！出错了 {smile}',
    generalDescription: '给你带来不便我们深感抱歉。请稍后再试。',
    forbiddenTitle: '禁止访问',
    forbiddenDescription: '你没有查看此资源所需的权限。',
    unauthorizedTitle: '未授权访问',
    unauthorizedDescription: '请使用合适的凭据登录以访问此资源。',
    maintenanceTitle: '网站正在维护！',
    maintenanceDescription: '网站暂时不可用。我们很快会恢复在线。',
    learnMore: '了解更多',
  },
} satisfies Messages

const messages = {
  en,
  'zh-CN': zhCN,
} as const satisfies Record<Language, Messages>

function isLanguage(value: string | undefined): value is Language {
  return languages.includes(value as Language)
}

function normalizeLanguage(value: string | undefined): Language {
  return isLanguage(value) ? value : DEFAULT_LANGUAGE
}

export function getStoredLanguage(): Language {
  return normalizeLanguage(getCookie(LANGUAGE_COOKIE_NAME))
}

export function translate(
  language: Language,
  key: TranslationKey,
  values?: TranslationValues
): string {
  let current: unknown = messages[language]

  for (const part of key.split('.')) {
    if (typeof current !== 'object' || current === null || !(part in current)) {
      return key
    }
    current = (current as Record<string, unknown>)[part]
  }

  if (typeof current !== 'string') return key

  if (!values) return current

  return current.replace(/\{(\w+)\}/g, (match, valueKey: string) => {
    const value = values[valueKey]
    return value === undefined ? match : String(value)
  })
}
