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
    dialogDescription:
      'Are you sure you want to sign out? You will need to sign in again to access your account.',
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
        description: 'Project management API integration placeholder',
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
  placeholder: {
    apiTitle: 'API integration placeholder',
    apiDescription:
      'This starter keeps the Vdoc Admin shell ready while the data table wiring is connected to the Vdoc backend.',
    users: {
      title: 'Users',
      description:
        'Manage Vdoc system users and SuperAdmin-owned user lifecycle operations.',
    },
    teams: {
      title: 'Teams',
      description: 'Manage Vdoc teams and their administrative ownership.',
    },
    projects: {
      title: 'Projects',
      description:
        'Track Vdoc projects that group documents, members, and review policy.',
    },
    documents: {
      title: 'Documents',
      description: 'Browse OpenAPI and Markdown documents managed by Vdoc.',
    },
    drafts: {
      title: 'Drafts',
      description: 'Review submitted document drafts before publication.',
    },
    versions: {
      title: 'Versions',
      description: 'Inspect immutable document versions and release history.',
    },
    diffs: {
      title: 'Diffs',
      description:
        'Compare document versions and review semantic change summaries.',
    },
    mcpTokens: {
      title: 'MCP Tokens',
      description: 'Issue and revoke raw Vdoc MCP tokens for agent access.',
    },
    settings: {
      title: 'Settings',
      description:
        'Configure Vdoc Admin preferences and backend connection settings.',
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
      otp: 'Please enter the 6-digit code.',
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
      forgotPassword: 'Forgot password?',
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
    forgotPassword: {
      title: 'Forgot Password',
      description:
        'Enter your registered email and we will send you a link to reset your password.',
      noAccount: "Don't have an account?",
      signUp: 'Sign up',
      continue: 'Continue',
      sending: 'Sending email...',
      sent: 'Email sent to {email}',
      error: 'Error',
    },
    otp: {
      title: 'Two-factor Authentication',
      description:
        'Please enter the authentication code. We have sent the authentication code to your email.',
      label: 'One-Time Password',
      verify: 'Verify',
      notReceived: "Haven't received it?",
      resend: 'Resend a new code.',
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
    dialogDescription: '确定要退出登录吗？你需要重新登录才能访问账号。',
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
        description: '项目管理 API 集成占位',
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
  placeholder: {
    apiTitle: 'API 集成占位',
    apiDescription:
      '该 starter 会保持 Vdoc Admin 外壳可用，直到数据表接入 Vdoc 后端。',
    users: {
      title: '用户',
      description: '管理 Vdoc 系统用户和由 SuperAdmin 拥有的用户生命周期操作。',
    },
    teams: {
      title: '团队',
      description: '管理 Vdoc 团队及其管理员归属。',
    },
    projects: {
      title: '项目',
      description: '跟踪用于组织文档、成员和审阅策略的 Vdoc 项目。',
    },
    documents: {
      title: '文档',
      description: '浏览由 Vdoc 管理的 OpenAPI 和 Markdown 文档。',
    },
    drafts: {
      title: '草稿',
      description: '在发布前审阅提交的文档草稿。',
    },
    versions: {
      title: '版本',
      description: '查看不可变文档版本和发布历史。',
    },
    diffs: {
      title: '差异',
      description: '比较文档版本并审阅语义变更摘要。',
    },
    mcpTokens: {
      title: 'MCP 令牌',
      description: '为 Agent 访问签发和撤销原始 Vdoc MCP 令牌。',
    },
    settings: {
      title: '设置',
      description: '配置 Vdoc Admin 偏好和后端连接设置。',
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
      otp: '请输入 6 位验证码。',
    },
    signIn: {
      title: '登录',
      description: '请输入邮箱和密码登录你的账号。',
      noAccount: '还没有账号？',
      link: '注册',
      submit: '登录 Vdoc',
      footerPrefix: '点击登录即表示你同意我们的',
      footerConnector: '和',
      forgotPassword: '忘记密码？',
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
    forgotPassword: {
      title: '忘记密码',
      description: '请输入注册邮箱，我们会发送重置密码链接。',
      noAccount: '还没有账号？',
      signUp: '注册',
      continue: '继续',
      sending: '正在发送邮件...',
      sent: '邮件已发送至 {email}',
      error: '错误',
    },
    otp: {
      title: '双因素认证',
      description: '请输入认证码。我们已将认证码发送到你的邮箱。',
      label: '一次性密码',
      verify: '验证',
      notReceived: '没有收到？',
      resend: '重新发送验证码。',
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
