import { getCookie } from '@/lib/cookies'

export const languages = ['en', 'zh-CN'] as const
export type Language = (typeof languages)[number]

export const DEFAULT_LANGUAGE: Language = 'en'
export const LANGUAGE_COOKIE_NAME = 'vdoc-admin-language'
export const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const en = {
  app: {
    name: 'Vdoc Admin',
    serviceConsole: 'Product Workbench',
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
    groupWorkspaceSetup: 'Workspace setup',
    groupSourcesDocuments: 'Sources/documents',
    groupVersionsDiffs: 'Versions/diffs',
    groupAgentAccess: 'Agent access',
    groupSystemSettings: 'System/settings',
    dashboard: 'Dashboard',
    users: 'Users',
    teams: 'Teams',
    projects: 'Projects',
    documents: 'Documents',
    drafts: 'Drafts',
    versions: 'Versions',
    diffs: 'Diffs',
    audit: 'Audit Logs',
    mcpTokens: 'MCP Tokens',
    skill: 'Vdoc Skill',
    settings: 'Settings',
  },
  team: {
    label: 'Teams',
    add: 'Add team',
    serviceConsolePlan: 'Workbench + Portal',
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
  publicShare: {
    title: 'Shared document',
    security:
      'This capability grants read-only access to published content. It is never stored in this browser.',
    loading: 'Loading the shared document…',
    unavailable: 'This link is invalid, expired, or revoked.',
    unavailableTitle: 'Shared document unavailable',
    recoverableTitle: 'Shared document could not be loaded',
    recoverable:
      'Check your connection and try again. The link and password have not been stored.',
    passwordPrompt: 'Enter the share password to continue.',
    passwordDescription: 'This shared document is password protected.',
    password: 'Share password',
    passwordHint:
      'Use 12–72 UTF-8 bytes with no leading or trailing whitespace.',
    passwordInvalid:
      'Enter a password of 12–72 UTF-8 bytes without leading or trailing whitespace.',
    unlockRejected:
      'That password could not unlock the document, or the link is no longer available.',
    unlockRetryable:
      'The unlock request did not finish. Check your connection and try again.',
    sessionExpired:
      'Your password session expired. Enter the password again to continue.',
    unlock: 'Unlock document',
    unlocking: 'Unlocking…',
    version: 'Version',
    history: 'Published history',
    latestOnly: 'This link always follows the latest published version.',
    expires: 'Expires {date}',
    download: 'Download original',
    downloading: 'Preparing download…',
    downloadFailed: 'The original file could not be downloaded.',
    versionLoadFailed:
      'That version could not be loaded. The previously opened version remains available.',
    retry: 'Try again',
    unlockAgain: 'Enter password again',
    managementTitle: 'Public sharing',
    managementDescription:
      'Create independent, revocable capability links for published branch content.',
    readOnlyTitle: 'Archived context is read-only',
    readOnlyDescription:
      'Existing share links can still be listed and revoked, but new links and secret reveal are unavailable.',
    managementError:
      'The sharing action could not be completed. Check the branch, password, and current permissions, then try again.',
    object: 'Shared object',
    actions: 'Actions',
    branch: 'Published branch',
    branchLabel: 'Branch: {branch}',
    unknownBranch: 'Unknown branch',
    scope: 'Version access',
    latest: 'Latest published version',
    allVersions: 'All published versions',
    expiry: 'Expiry',
    passwordOptional: 'Optional password (12–72 bytes)',
    create: 'Create share link',
    linkReady: 'Active share link',
    copy: 'Copy link',
    copySuccess: 'Share link copied.',
    copyFailed:
      'The share link could not be copied. Select and copy it manually.',
    reveal: 'Show link',
    revoke: 'Revoke',
    revokeConfirmTitle: 'Revoke {document} / {branch} public link?',
    revokeConfirmDescription:
      'Share {id} will stop working immediately. This action is irreversible, and anyone using the link will lose document and download access.',
    protected: 'Password protected',
    unprotected: 'No password',
    noShares: 'No public links have been created for this document.',
    active: 'Active',
    revoked: 'Revoked',
    expired: 'Expired',
  },
  dashboard: {
    eyebrow: 'Vdoc Admin',
    title: 'Product Workbench',
    description:
      'Product workbench for onboarding, review, versioned documents, developer-portal browsing, diffs, and MCP tokens.',
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
      all: 'All',
      add: 'Add',
      create: 'Create',
      update: 'Update',
      archive: 'Archive',
      revoke: 'Revoke',
      submit: 'Submit',
      approve: 'Approve',
      requestChanges: 'Request changes',
      reject: 'Reject',
      promote: 'Promote',
      createPromotionDraft: 'Create promotion draft',
      refresh: 'Refresh',
      save: 'Save',
      view: 'View',
      compare: 'Compare',
      clear: 'Clear',
      selected: 'Selected',
      none: 'None',
      yes: 'Yes',
      no: 'No',
      total: 'Total',
      operationPanel: 'Operation panel',
      operationPanelDescription:
        'Use this panel for the next controlled change in the Vdoc lifecycle.',
      resourceCollection: 'Resource collection',
      selectedContext: 'Selected context',
      nextAction: 'Next action',
      openNextAction: 'Open next step',
      endpoint: 'Endpoint',
      active: 'Active',
      archived: 'Archived',
      revoked: 'Revoked',
      unknown: 'Unknown',
      generated: 'Generated',
      tokenWarning: 'Copy this token now. The backend may not return it again.',
      attribution:
        'Vdoc Admin keeps the upstream template attribution while replacing starter template data with Vdoc backend API calls.',
    },
    actions: {
      disableUser: 'Disable user',
      enableUser: 'Enable user',
      grantSuperAdmin: 'Grant SuperAdmin',
      revokeSuperAdmin: 'Revoke SuperAdmin',
      removeMember: 'Remove member',
    },
    confirm: {
      archiveTeamTitle: 'Archive team “{name}”?',
      archiveTeamDescription:
        'The team becomes read-only and cannot receive new projects. Existing project history is retained.',
      archiveProjectTitle: 'Archive project “{name}”?',
      archiveProjectDescription:
        'Project management, drafting, publishing, and agent access stop. Existing documents and audit history are retained.',
      archiveDocumentTitle: 'Archive document “{name}”?',
      archiveDocumentDescription:
        'Drafting, publishing, and public-share access stop for this document. Published history is retained.',
      archiveBranchTitle: 'Archive branch “{name}”?',
      archiveBranchDescription:
        'The branch can no longer receive drafts or serve public shares. Existing published history is retained.',
      revokeTokenTitle: 'Revoke token “{name}”?',
      revokeTokenDescription:
        'Agents using this token immediately lose access. A revoked token cannot be restored.',
      disableUserTitle: 'Disable {email}?',
      disableUserDescription:
        'The user immediately loses authenticated access until a SuperAdmin enables the account again.',
      enableUserTitle: 'Enable {email}?',
      enableUserDescription:
        'The user regains authenticated access immediately. Existing project memberships and roles become effective again.',
      grantSuperAdminTitle: 'Grant SuperAdmin to {email}?',
      grantSuperAdminDescription:
        'This grants system-wide user, team, project, configuration, and audit administration privileges.',
      revokeSuperAdminTitle: 'Revoke SuperAdmin from {email}?',
      revokeSuperAdminDescription:
        'The user loses system-wide administration. Project-specific membership is not changed.',
      changeMemberRoleTitle: 'Change {user} from {from} to {to}?',
      changeMemberRoleDescription:
        'This changes the user’s project permissions immediately. Confirm the intended role before saving.',
      removeMemberTitle: 'Remove {user} from this project?',
      removeMemberDescription:
        'The user loses project access immediately. Their prior drafts and audit history are retained.',
    },
    workbench: {
      eyebrow: 'Product workbench',
      title: 'Plan, review, and ship docs from one admin surface.',
      description:
        'Use the console as the product operating room: invite people, organize teams and projects, publish versioned documents, compare breaking changes, and issue MCP tokens for agents.',
      roleTitle: 'Role guidance',
      superAdminRole: 'Super admin workspace',
      adminRole: 'Project admin workspace',
      writerRole: 'Writer workspace',
      readerRole: 'Reader workspace',
      noProjectRole: 'No active project role',
      superAdminGuidance:
        'Start with users and teams, then create projects with an accountable admin before writers publish drafts.',
      adminGuidance:
        'Focus on project membership, document branches, draft review, version browsing, and token hygiene.',
      writerGuidance:
        'Create and revise drafts, inspect review comments, and submit changes for an administrator to publish.',
      readerGuidance:
        'Browse published documents, versions, diffs, and AI explanations without changing project state.',
      noProjectGuidance:
        'Select a project where you have an active membership. No project role is inferred when membership evidence is absent.',
      usersStat: 'People who can collaborate in Vdoc',
      teamsStat: 'Ownership boundaries for projects',
      projectsStat: 'Product spaces ready for docs',
      tokensStat: 'Agent credentials issued from Vdoc',
      nextStepsTitle: 'Recommended setup path',
      nextStepsDescription:
        'Readiness is evaluated for the selected active project and document, not from unrelated historical objects.',
      done: 'Done',
      inspectStep: 'Inspect evidence',
      continueStep: 'Continue this step',
      nextIncompleteStep:
        'Continue with “{step}”, the first incomplete check for this context.',
      lifecycleCompleteTitle: 'Lifecycle complete',
      lifecycleCompleteDescription:
        'Every readiness check is complete for the selected project and document. Open any step below to inspect its evidence.',
      steps: {
        team: {
          title: 'Create a team',
          description: 'Group owners around a product or service boundary.',
        },
        project: {
          title: 'Create a project',
          description:
            'Attach the team and first admin so documents have a home.',
        },
        document: {
          title: 'Add a document',
          description:
            'Choose OpenAPI or Markdown and set the repository-relative path.',
        },
        branch: {
          title: 'Confirm an active branch',
          description:
            'New documents include environment branches; confirm at least one remains active.',
        },
        draft: {
          title: 'Submit a draft',
          description:
            'A draft counts only after it is submitted for review or published.',
        },
        version: {
          title: 'Publish an immutable version',
          description:
            'Approval must create a published version for the selected document.',
        },
        token: {
          title: 'Issue an active read token',
          description:
            'Use a non-expired api:read or doc:read token matching this document.',
        },
        connection: {
          title: 'Verify the Agent connection',
          description:
            'Run tools/list and a read call, then confirm the active token has a last-used timestamp.',
        },
      },
    },
    emptyStates: {
      generic: {
        description: 'No backend data is available for this panel yet.',
      },
      users: {
        title: 'No users yet',
        description:
          'Create the first user before assigning project admins or auditing user MCP tokens.',
        action: 'Use the Create user form above.',
      },
      teams: {
        title: 'No teams yet',
        description:
          'Teams are the ownership boundary for Vdoc projects and should be created before project setup.',
        action: 'Create a team with a clear product or service name.',
      },
      projects: {
        title: 'No projects yet',
        description:
          'Projects connect a team, admin, documents, members, branches, drafts, versions, and diffs.',
        action: 'Create a project after at least one team and user exist.',
      },
      members: {
        title: 'No project members yet',
        description:
          'Select a project, then add readers, writers, and admins so review responsibility is explicit.',
        action: 'Use the member form after selecting a project.',
      },
      memberCandidates: {
        title: 'No eligible users',
        description:
          'Every active account is already a member of this project. Create or reactivate an account before adding another member.',
        action: 'Manage accounts from the Users page if you are a SuperAdmin.',
      },
      documents: {
        title: 'No documents in this project',
        description:
          'Add an OpenAPI or Markdown document so branches, drafts, versions, endpoints, and diffs have a source.',
        action: 'Select a project and use Create document.',
      },
      branches: {
        title: 'No branches for this document',
        description:
          'Branches give drafts a stable review target. New documents normally include dev, test, and prod branches.',
        action:
          'Select a document and confirm an active branch or create another.',
      },
      drafts: {
        title: 'No drafts waiting for review',
        description:
          'Create a draft from a branch, inspect its content and machine diff, then submit it for review.',
        action: 'Select project, document, and branch before creating a draft.',
      },
      versions: {
        title: 'No published versions yet',
        description:
          'Approval publishes an immutable version that becomes the source for content browsing and diffs.',
        action: 'Review the evidence and approve a submitted draft.',
      },
      endpoints: {
        title: 'No endpoints match this version',
        description:
          'Endpoint rows appear for OpenAPI versions. Adjust the search or publish an OpenAPI document version.',
        action: 'Select another version or clear the endpoint search.',
      },
      diffs: {
        title: 'No diff changes to review',
        description:
          'Compare two published versions, then filter by breaking, must-handle, or high-severity changes.',
        action: 'Select from and to versions, then run Compare.',
      },
      audit: {
        title: 'No audit events match these filters',
        description:
          'Audit history appears after authorized mutations and MCP activity. Narrow filters may also hide existing events.',
        action:
          'Choose another project or clear the action and resource filters.',
      },
      tokens: {
        title: 'No MCP tokens yet',
        description:
          'Tokens are created only through the supported Vdoc token API and should be scoped for agent use.',
        action: 'Create a token and copy the one-time raw value immediately.',
      },
      userTokens: {
        title: 'No user tokens selected',
        description:
          'Select a user to audit their MCP tokens or confirm that none have been issued.',
        action: 'Click a user email in the users table.',
      },
    },
    developerPortal: {
      endpointCount: 'Endpoints',
      endpointCountDescription: 'Returned by the selected version',
      methodCount: 'Methods',
      methodCountDescription: 'Unique HTTP methods in view',
      tagCount: 'Tags',
      tagCountDescription: 'Unique OpenAPI tags in view',
      searchLabel: 'Endpoint search',
      searchPlaceholder: 'Search method, path, tag, operation, or summary',
      groupBy: 'Group endpoints by',
      groupByTag: 'Tag',
      groupByMethod: 'Method',
      untagged: 'Untagged',
      endpointBrowserDescription:
        'Browse the selected version like a developer portal without assuming a specific OpenAPI shape.',
      tag: 'Tag',
      deprecated: 'Deprecated',
      noEndpointSummary: 'No endpoint summary provided.',
      operationId: 'Operation ID',
      tags: 'Tags',
      parameters: 'Parameters',
      requestBody: 'Request body',
      responses: 'Responses',
      runtime: 'Security, servers, and schema refs',
      security: 'Security',
      servers: 'Servers',
      schemaRefs: 'Schema refs',
      normalizedOperation: 'Normalized operation',
    },
    permissions: {
      superAdminOnly:
        'This page is available only to active system administrators.',
    },
    audit: {
      title: 'Audit history',
      description:
        'Newest-first product activity. Project admins can inspect only projects they administer.',
      allProjects: 'All projects',
      projectAdminRequired:
        'Select a project where you hold the Project Admin role.',
      action: 'Action',
      actionPlaceholder: 'For example document.create',
      resourceType: 'Resource type',
      resourceTypePlaceholder: 'For example document',
      time: 'Time',
      actor: 'Actor',
      resource: 'Resource',
      result: 'Result',
    },
    review: {
      noteTitle: 'Review note',
      noteDescription:
        'Select one submitted draft, add optional context, then confirm the exact review action.',
      selectedDraft: 'Applies to selected draft: {draft}',
      noDraftSelected: 'Select a draft before adding review context.',
      confirmApproveTitle: 'Publish {draft}?',
      confirmApproveDescription:
        'Approval creates an immutable published version. Confirm that you reviewed this exact draft and its diff.',
      confirmRequestTitle: 'Request changes for {draft}?',
      confirmRequestDescription:
        'The selected draft will return to its author with the review note shown above.',
      confirmRejectTitle: 'Reject {draft}?',
      confirmRejectDescription:
        'The selected draft will be closed as rejected and cannot be edited again.',
    },
    draftEditor: {
      createTitle: 'Create draft',
      editTitle: 'Edit selected draft',
      readOnlyTitle: 'Selected draft is read-only',
      readOnlyDescription:
        'Submitted, rejected, and published drafts keep their review history and cannot be edited. Start a new draft to continue.',
      newDraft: 'New draft',
      branchImmutable:
        'A draft stays on its original branch. Create a new draft to target another branch.',
      archivedTitle: 'Archived context is read-only',
      archivedDescription:
        'The selected project, document, or draft branch is archived. Historical content remains available, but no draft mutation is allowed.',
    },
    projects: {
      initialAdminHint:
        'Leave this blank to make the current signed-in actor the initial Project Admin; choose a user to assign someone else explicitly.',
    },
    promote: {
      unavailableTitle: 'A promotion draft is not available yet',
      unavailableDescription:
        'Publish a version on one active source branch and keep a different active target branch before creating a promotion draft.',
    },
    ai: {
      badge: 'AI',
      panelTitle: 'AI summary and chat',
      panelDescription: 'Scoped to selected {ownerType}: {ownerId}',
      noTarget: 'Select a draft, version, or diff before using AI tools.',
      summaryTitle: 'AI summary',
      regenerateSummary: 'Regenerate AI summary',
      chatTitle: 'AI chat',
      chatSession: 'Chat history',
      noMessages: 'No AI chat messages yet.',
      chatMessage: 'AI chat message',
      sendMessage: 'Send AI message',
      readOnlyTitle: 'Archived context is read-only',
      readOnlyDescription:
        'Historical summaries and chat sessions remain available, but no new AI work can be started.',
      noSummary: 'No AI summary has been generated yet.',
      summaryStatus: 'AI summary status: {status}',
      summaryStatusReady: 'Ready',
      summaryStatusPending: 'Pending',
      summaryStatusSucceeded: 'Succeeded',
      summaryStatusFailed: 'Failed',
      summaryStatusSkipped: 'Skipped',
      settingsTitle: 'AI settings',
      settingsDescription:
        'Configure providers and prompt templates without exposing stored API keys.',
      projectScope: 'Project provider scope',
      noReadableProjects: 'No readable projects are available for AI settings.',
      loadingProjects: 'Loading projects…',
      projectsLoadErrorTitle: 'Projects could not be loaded',
      projectsLoadErrorDescription:
        'Refresh the page before selecting an AI configuration scope.',
      checkingProjectPermission: 'Checking project configuration permission…',
      archivedSettingsTitle: 'Archived project settings are read-only',
      archivedSettingsDescription:
        'Saved provider and prompt configuration remains available to Project Admins and SuperAdmins for history. Provider updates, tests, and prompt changes are disabled.',
      readOnlySettingsTitle: 'Project AI configuration is restricted',
      readOnlySettingsDescription:
        'Only a Project Admin or SuperAdmin can read, change, or test provider and prompt configuration. You can still use page summaries and chat where your document permissions allow it.',
      permissionCheckFailedTitle: 'Project permissions could not be verified',
      permissionCheckFailedDescription:
        'The configuration remains read-only. Refresh after project membership is available.',
      loadingProjectSettings: 'Loading project AI settings…',
      loadingSystemProvider: 'Loading the system AI provider…',
      systemProviderLoadErrorTitle: 'System AI provider could not be loaded',
      systemProviderLoadErrorDescription:
        'Refresh the page before changing or testing the system provider.',
      projectSettingsErrorTitle: 'Project AI settings could not be loaded',
      projectSettingsErrorDescription:
        'The selected project configuration is unavailable. Refresh or select another project.',
      projectPromptsErrorTitle: 'Project prompts could not be loaded',
      projectPromptsErrorDescription:
        'Prompt history for the selected project is unavailable. Refresh or select another project.',
      systemProviderTitle: 'System AI provider',
      projectProviderTitle: 'Project AI provider override',
      systemProviderDescription:
        'Default provider for SuperAdmin-capable system workflows.',
      projectProviderDescription:
        'Optional project override used only for the selected project.',
      projectProviderFallbackStatus:
        'Project override: not configured. AI can use the enabled system provider fallback.',
      providerName: 'Provider name',
      baseUrl: 'Base URL',
      model: 'Model',
      apiMode: 'API mode',
      apiModePlaceholder: 'Select API mode',
      apiModeChatCompletions: 'Chat Completions',
      apiModeResponses: 'Responses',
      systemApiKey: 'System API key',
      projectApiKey: 'Project API key',
      apiKeyPlaceholder: 'Leave blank to keep existing key',
      enabled: 'Enabled',
      temperature: 'Temperature',
      timeoutMs: 'Timeout (ms)',
      maxOutputTokens: 'Max output tokens',
      saveSystemProvider: 'Save system provider',
      saveProjectProvider: 'Save project provider',
      testSystemProvider: 'Test system provider',
      testProjectProvider: 'Test project provider',
      providerTestResult: 'Provider test result',
      providerConfigurationStatus: 'Provider configuration: {status}',
      providerConfigured: 'Configured',
      providerUnconfigured: 'Unconfigured',
      providerTestStatus: 'Provider test status: {status}',
      providerTestIdle: 'Not tested',
      providerTestSuccess: 'Success',
      providerTestError: 'Error',
      providerTestUnknownError: 'Provider test failed without a message.',
      settingsMutationErrorTitle: 'AI settings were not saved',
      settingsMutationErrorRecovery:
        'Your form values are preserved. Fix the error and try again.',
      systemPromptsTitle: 'System prompt settings',
      projectPromptsTitle: 'Project prompt settings',
      promptSettingsDescription:
        'Edit system and user prompt text for AI summaries and chats.',
      loadingPrompts: 'Loading AI prompt templates…',
      promptsLoadErrorTitle: 'AI prompts could not be loaded',
      promptsLoadErrorDescription:
        'Refresh the page before changing prompt configuration.',
      noPrompts: 'No AI prompt templates returned.',
      systemPrompt: 'System prompt',
      userPromptTemplate: 'User prompt template',
      saveSystemPrompt: 'Save system prompt {prompt}',
      saveProjectPrompt: 'Save project prompt {prompt}',
      savePrompt: 'Save prompt',
      keyUnset: 'Key set: no',
      keyStatus: 'Key set: {yes} · last4: {last4}',
    },
    markdownFacts: {
      title: 'Markdown facts',
      description:
        'Structured facts derived from the selected raw or stable Markdown content.',
      headings: 'headings',
      lists: 'lists',
      tasks: 'tasks',
      codeBlocks: 'code blocks',
      links: 'links',
      lineCount: '{count} lines',
      countSummary: '{count} {label}',
      noFacts: 'No Markdown facts found.',
      checked: 'Checked',
      open: 'Open',
      ordered: 'Ordered',
      unordered: 'Unordered',
      noLanguage: 'plain text',
      unsafeLink: 'Unsafe link',
    },
    token: {
      scopesTitle: 'Token scopes',
      apiRead: 'api:read — query OpenAPI contracts and diffs',
      apiDraft: 'api:draft — create and update OpenAPI drafts',
      docRead: 'doc:read — query Markdown documents and diffs',
      docDraft: 'doc:draft — create and update Markdown drafts',
      secretAvailable: 'Active token secret',
      secretGuidance:
        'Active tokens can be viewed and copied again. Revoked or expired tokens remain redacted.',
      copy: 'Copy token',
      copySuccess: 'Token copied.',
      copyFailed: 'The token could not be copied. Select and copy it manually.',
      revealErrorTitle: 'Token could not be revealed',
      revokeErrorTitle: 'Token could not be revoked',
      configTitle: 'MCP client configuration',
      configDescription:
        'Run the Vdoc stdio adapter. The token stays in VDOC_MCP_TOKEN instead of command arguments or copied HTTP headers.',
      connectionVerifiedTitle: 'Agent connection evidence found',
      connectionVerifiedDescription:
        'At {time}, active read token “{name}” completed {tool} against {target}. Vdoc retained this sanitized published-content read summary without the token secret or returned content.',
      connectionPendingTitle: 'Agent connection not verified yet',
      connectionPendingDescription:
        'Copy the configuration into the Agent, run tools/list and one published-content read, then refresh. Authentication alone does not complete this check.',
      refreshConnectionEvidence: 'Refresh connection evidence',
      activityTitle: 'Recent Agent activity',
      activityDescription:
        'Sanitized MCP call summaries contain only tool, adapter, outcome, and exact entity IDs. Token secrets and returned document content are never included.',
      activityTool: 'Tool',
      activityTarget: 'Exact target',
      activityAdapter: 'Adapter',
      activityEvidence: 'Evidence',
      evidencePublishedRead: 'Published read',
      evidenceCapabilityList: 'Capability list',
      evidenceToolCall: 'Tool call',
    },
    deepLink: {
      invalidTitle: 'Linked entity is unavailable',
      invalidDescription:
        'Vdoc did not switch to another record. These exact targets do not exist in your visible scope: {targets}',
    },
    skill: {
      installTitle: 'Install the official Skill',
      installDescription:
        'The Vdoc Skill teaches agents to query reviewed facts, compare versions, and submit drafts without bypassing human publication.',
      stepPackage:
        'Clone the public Vdoc-skill repository into a Codex user or repository Skill directory.',
      stepMcp:
        'Run the Vdoc MCP stdio adapter with the backend URL and an appropriately scoped active token in environment variables.',
      stepVerify:
        'Restart the agent and verify list_projects, list_documents, and read tools before draft workflows.',
      boundaryTitle: 'Human publication boundary',
      boundaryDescription:
        'The Skill and MCP may create, update, and submit drafts. Only Project Admin or SuperAdmin can approve and publish in this workbench.',
    },
    diff: {
      compareHint:
        'Stored comparisons load automatically. A new comparison is created only when the selected pair has no history.',
      noDiffSelected: 'Run a comparison to review changes.',
      existingLoaded: 'Stored diff loaded',
      historyTitle: 'Stored diff history',
      historyDescription:
        'Select a previous comparison or choose an exact version pair above.',
      historyIdentifiers: 'Version IDs {from} → {to} · Diff ID {diff}',
      addedEndpoints: 'Added endpoints',
      removedEndpoints: 'Removed endpoints',
      modifiedEndpoints: 'Modified endpoints',
      breakingChanges: 'Breaking changes',
      addedLines: 'Added lines',
      removedLines: 'Removed lines',
      modifiedLines: 'Modified lines',
      modifiedBlocks: 'Changed blocks',
      addedLinesDescription: 'Lines added to the target Markdown file',
      removedLinesDescription: 'Lines removed from the source Markdown file',
      modifiedLinesDescription: 'Line replacements requiring review',
      modifiedBlocksDescription: 'Unified diff groups containing changes',
      addedDescription: 'New operations in the target version',
      removedDescription: 'Removed operations from the source version',
      modifiedDescription: 'Changed operations requiring review',
      breakingDescription: 'Changes marked as breaking',
      searchLabel: 'Search changes',
      searchPlaceholder: 'Search method, path, message, location, or impact',
      filterLabel: 'Review filter',
      filterAll: 'All changes',
      filterBreaking: 'Breaking only',
      filterMustHandle: 'Must handle',
      filterHigh: 'High severity',
      highSeverity: 'High severity',
      mediumSeverity: 'Medium severity',
      lowSeverity: 'Low severity',
      infoSeverity: 'Informational',
      added: 'Added',
      removed: 'Removed',
      modified: 'Modified',
      breaking: 'Breaking',
      mustHandle: 'Must handle',
      changeCount: 'changes',
      severity: 'Severity',
      oldValue: 'Old value',
      newValue: 'New value',
      unifiedDiff: 'Unified line diff',
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
      initialAdmin: 'Initial Project Admin',
      document: 'Document',
      branch: 'Branch',
      sourceBranch: 'Source branch',
      targetBranch: 'Target branch',
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
      schemaFile: 'Schema or Markdown file',
      contentKind: 'Content kind',
      reviewNote: 'Review note',
      scopes: 'Scopes',
      expiresAt: 'Expires at',
      lastUsedAt: 'Last used at',
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
      defaultBranch: 'Default branch',
      protectedBranch: 'Protected branch',
      token: 'Token',
    },
    placeholders: {
      selectProject: 'Select a project',
      selectTeam: 'Select a team',
      selectDocument: 'Select a document',
      selectVersion: 'Select a version',
      selectBranch: 'Select a branch',
      selectPublishedBranch: 'Select a published source branch',
      selectUser: 'Select a user',
      useCurrentUser: 'Use the current signed-in user',
      optionalIsoDate: 'Optional ISO date',
      endpointPath: 'Filter endpoint path',
      reviewNote: 'Optional note for approve, request changes, or reject',
    },
    pages: {
      dashboard: {
        title: 'Live Product Workbench',
        description:
          'Follow setup, review, version, and agent-access readiness from the Vdoc backend APIs.',
        stage: 'Lifecycle overview',
        cue: 'Start here when a workspace is new or state is unclear.',
        next: 'Confirm the first incomplete lifecycle step before opening entity pages.',
        health: 'Backend health',
        identity: 'Signed-in identity',
      },
      users: {
        title: 'Users',
        description:
          'List users, create accounts, patch status, and oversee user MCP tokens.',
        stage: 'Workspace setup',
        cue: 'People and roles define who can administer projects and review drafts.',
        next: 'Create users before assigning project membership or auditing user tokens.',
      },
      teams: {
        title: 'Teams',
        description: 'Create, update, and archive Vdoc teams.',
        stage: 'Workspace setup',
        cue: 'Teams create the ownership boundary that projects inherit.',
        next: 'Create the team before connecting projects to owners.',
      },
      projects: {
        title: 'Projects',
        description:
          'Manage projects and project membership using real backend APIs.',
        stage: 'Workspace setup',
        cue: 'Projects bind teams, admins, members, documents, drafts, and versions.',
        next: 'Select a project to confirm membership before adding documents.',
      },
      documents: {
        title: 'Documents',
        description: 'Select a project, then manage documents and branches.',
        stage: 'Sources/documents',
        cue: 'Documents and branches are the source targets for draft review.',
        next: 'Create a document and branch before submitting drafts.',
      },
      drafts: {
        title: 'Drafts',
        description:
          'Create and update drafts, inspect machine evidence, then perform review actions.',
        stage: 'Drafts/review',
        cue: 'Drafts are untrusted until submitted and approved into an immutable version.',
        next: 'Inspect the diff, content, and optional AI evidence before approve, reject, or request-changes actions.',
      },
      versions: {
        title: 'Versions',
        description:
          'Browse published versions, content, and OpenAPI endpoints.',
        stage: 'Versions/developer portal',
        cue: 'Published versions are the authoritative facts humans and agents consume.',
        next: 'Select a version to inspect content and endpoint facts.',
      },
      diffs: {
        title: 'Diffs',
        description:
          'Load stored comparisons and create a diff only when a version pair has no history.',
        stage: 'Versions/diffs',
        cue: 'Diffs expose risk between reviewed versions before downstream consumers rely on them.',
        next: 'Choose source and target versions, then filter by breaking or must-handle changes.',
      },
      audit: {
        title: 'Audit Logs',
        description:
          'Inspect authorized product activity by project, action, and resource type.',
        stage: 'System/audit',
        cue: 'Audit evidence connects operator and agent actions to the affected resource.',
        next: 'Select an administered project or use system-wide filters as a SuperAdmin.',
      },
      mcpTokens: {
        title: 'MCP Tokens',
        description:
          'List, create, inspect, and revoke current-user MCP tokens.',
        stage: 'Agent access',
        cue: 'Tokens give agents access to approved Vdoc facts, not direct publication rights.',
        next: 'Issue a scoped token, run tools/list and a read call, then refresh connection evidence.',
      },
      skill: {
        title: 'Vdoc Skill',
        description:
          'Install the official agent workflow package and connect it to the Vdoc MCP endpoint.',
        stage: 'Agent access',
        cue: 'MCP provides tools; the Skill supplies the safe workflow and output templates.',
        next: 'Install the package, configure an active scoped token, then verify read tools before submitting drafts.',
      },
      settings: {
        title: 'Settings',
        description:
          'Runtime, provider, and prompt settings from the current admin session.',
        stage: 'System/settings',
        cue: 'Runtime context and AI configuration stay visible without exposing stored secrets.',
        next: 'Confirm identity, backend health, provider state, and prompt scope before investigating data issues.',
      },
    },
    sections: {
      createUser: 'Create user',
      createTeam: 'Create team',
      createProject: 'Create project',
      createDocument: 'Create document',
      createBranch: 'Create branch',
      createDraft: 'Create or update draft',
      promoteDraft: 'Create a promotion draft from a published branch',
      diffPreview: 'Draft diff preview',
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
      tokenDetails: 'Token details',
    },
    statuses: {
      enabled: 'Enabled',
      disabled: 'Disabled',
      active: 'Active',
      archived: 'Archived',
      revoked: 'Revoked',
      pending: 'Pending',
      draft: 'Draft',
      submitted: 'Submitted',
      approved: 'Approved',
      published: 'Published',
      rejected: 'Rejected',
      changesRequested: 'Changes requested',
      ready: 'Ready',
      degraded: 'Degraded',
      expired: 'Expired',
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
    controlPlane: {
      label: 'Control Plane',
      title:
        'Reviewed documentation operations, without losing the state trail.',
      description:
        'Sign in to review drafts, compare versions, inspect source facts, and manage MCP access from one calm operator surface.',
      sourceTitle: 'Source of truth',
      sourceDescription:
        'Versions, diffs, tokens, and review state remain visible after authentication.',
      ready: 'Ready',
    },
    email: 'Email',
    password: 'Password',
    name: 'Name',
    confirmPassword: 'Confirm Password',
    registrationCheckingTitle: 'Checking registration',
    registrationChecking: 'Checking registration availability…',
    registrationUnavailableShort:
      'Registration availability could not be checked. Sign-in remains available.',
    registrationUnavailableTitle: 'Registration check unavailable',
    registrationUnavailableDescription:
      'Vdoc could not load the public registration configuration. This is not evidence that registration is disabled.',
    registrationUnavailableRecovery:
      'Retry the configuration check or return to sign in. Account creation stays hidden until the setting can be verified.',
    retryRegistrationCheck: 'Retry registration check',
    registrationDisabledShort:
      'Registration is disabled. Ask a system administrator for an account.',
    registrationDisabledTitle: 'Registration is unavailable',
    registrationDisabledDescription:
      'This Vdoc instance does not allow anonymous account creation.',
    registrationDisabledRecovery:
      'Return to sign in and use an account created by a system administrator.',
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    validation: {
      email: 'Please enter your email.',
      password: 'Please enter your password.',
      passwordLength: 'Password must be at least 7 characters long.',
      passwordPolicy:
        'Use 12–72 UTF-8 bytes with no leading or trailing whitespace.',
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
    retry: 'Try again',
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
    maintenanceTitle: 'Vdoc service is temporarily unavailable',
    maintenanceDescription:
      'Your signed-in session is preserved. Restore backend connectivity, then try again.',
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
    serviceConsole: '产品工作台',
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
    groupWorkspaceSetup: '工作区配置',
    groupSourcesDocuments: '来源/文档',
    groupVersionsDiffs: '版本/差异',
    groupAgentAccess: '智能体访问',
    groupSystemSettings: '系统/设置',
    dashboard: '仪表盘',
    users: '用户',
    teams: '团队',
    projects: '项目',
    documents: '文档',
    drafts: '草稿',
    versions: '版本',
    diffs: '差异',
    audit: '审计日志',
    mcpTokens: 'MCP 令牌',
    skill: 'Vdoc Skill',
    settings: '设置',
  },
  team: {
    label: '团队',
    add: '添加团队',
    serviceConsolePlan: '工作台 + 门户',
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
  publicShare: {
    title: '共享文档',
    security: '此能力链接仅可读取已发布内容，分享密钥不会存入浏览器存储。',
    loading: '正在加载共享文档…',
    unavailable: '链接无效、已过期或已撤销。',
    unavailableTitle: '共享文档暂不可用',
    recoverableTitle: '共享文档加载失败',
    recoverable: '请检查网络后重试；链接和密码均未被浏览器存储。',
    passwordPrompt: '请输入分享密码后继续。',
    passwordDescription: '此共享文档受密码保护。',
    password: '分享密码',
    passwordHint: '请输入 12–72 个 UTF-8 字节，且首尾不能包含空白字符。',
    passwordInvalid: '密码必须为 12–72 个 UTF-8 字节，且首尾不能包含空白字符。',
    unlockRejected: '该密码未能解锁文档，或分享链接已失效。',
    unlockRetryable: '解锁请求未完成，请检查网络后重试。',
    sessionExpired: '密码会话已过期，请重新输入密码后继续。',
    unlock: '解锁文档',
    unlocking: '正在解锁…',
    version: '版本',
    history: '已发布历史',
    latestOnly: '此链接始终跟随最新发布版本。',
    expires: '有效期至 {date}',
    download: '下载原文件',
    downloading: '正在准备下载…',
    downloadFailed: '原文件下载失败。',
    versionLoadFailed: '该版本加载失败，之前打开的版本仍可继续查看。',
    retry: '重试',
    unlockAgain: '重新输入密码',
    managementTitle: '公开分享',
    managementDescription: '为已发布分支创建相互独立、可随时撤销的能力链接。',
    readOnlyTitle: '归档上下文为只读',
    readOnlyDescription:
      '仍可查看和撤销已有分享链接，但不能创建新链接或再次揭示密钥。',
    managementError: '分享操作未完成。请检查分支、密码和当前权限后重试。',
    object: '分享对象',
    actions: '操作',
    branch: '已发布分支',
    branchLabel: '分支：{branch}',
    unknownBranch: '未知分支',
    scope: '版本范围',
    latest: '最新已发布版本',
    allVersions: '全部已发布版本',
    expiry: '有效期',
    passwordOptional: '可选密码（12–72 字节）',
    create: '创建分享链接',
    linkReady: '有效分享链接',
    copy: '复制链接',
    copySuccess: '分享链接已复制。',
    copyFailed: '分享链接复制失败，请手动选择并复制。',
    reveal: '显示链接',
    revoke: '撤销',
    revokeConfirmTitle: '撤销 {document} / {branch} 的公开链接？',
    revokeConfirmDescription:
      '分享 {id} 会立即失效。此操作不可恢复，任何正在使用该链接的人都会失去文档查看和下载权限。',
    protected: '密码保护',
    unprotected: '无密码',
    noShares: '该文档尚未创建公开链接。',
    active: '有效',
    revoked: '已撤销',
    expired: '已过期',
  },
  dashboard: {
    eyebrow: 'Vdoc Admin',
    title: '产品工作台',
    description:
      '用于 onboarding、审阅、版本化文档、开发者门户浏览、差异和 MCP 令牌的产品工作台。',
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
      all: '全部',
      add: '添加',
      create: '创建',
      update: '更新',
      archive: '归档',
      revoke: '撤销',
      submit: '提交',
      approve: '批准',
      requestChanges: '请求修改',
      reject: '拒绝',
      promote: '提升',
      createPromotionDraft: '创建晋级草稿',
      refresh: '刷新',
      save: '保存',
      view: '查看',
      compare: '比较',
      clear: '清空',
      selected: '已选择',
      none: '无',
      yes: '是',
      no: '否',
      total: '总数',
      operationPanel: '操作面板',
      operationPanelDescription:
        '在此面板中执行 Vdoc 生命周期的下一次受控变更。',
      resourceCollection: '资源集合',
      selectedContext: '当前上下文',
      nextAction: '下一步',
      openNextAction: '打开下一步',
      endpoint: '端点',
      active: '激活',
      archived: '已归档',
      revoked: '已撤销',
      unknown: '未知',
      generated: '已生成',
      tokenWarning: '请立即复制此令牌。后端可能不会再次返回。',
      attribution:
        'Vdoc Admin 保留上游模板署名，同时用 Vdoc 后端 API 调用替换模板起始数据。',
    },
    actions: {
      disableUser: '停用用户',
      enableUser: '启用用户',
      grantSuperAdmin: '授予超级管理员',
      revokeSuperAdmin: '撤销超级管理员',
      removeMember: '移除成员',
    },
    confirm: {
      archiveTeamTitle: '归档团队“{name}”？',
      archiveTeamDescription:
        '团队将变为只读，不能再接收新项目；现有项目历史会保留。',
      archiveProjectTitle: '归档项目“{name}”？',
      archiveProjectDescription:
        '项目管理、草稿、发布及 Agent 访问都会停止；现有文档和审计历史会保留。',
      archiveDocumentTitle: '归档文档“{name}”？',
      archiveDocumentDescription:
        '该文档的草稿、发布和公开分享访问都会停止；已发布历史会保留。',
      archiveBranchTitle: '归档分支“{name}”？',
      archiveBranchDescription:
        '该分支不能再接收草稿或提供公开分享；现有已发布历史会保留。',
      revokeTokenTitle: '撤销令牌“{name}”？',
      revokeTokenDescription:
        '正在使用此令牌的 Agent 会立即失去访问权限，撤销后不能恢复。',
      disableUserTitle: '停用 {email}？',
      disableUserDescription:
        '该用户会立即失去认证访问权限，直到超级管理员重新启用账号。',
      enableUserTitle: '启用 {email}？',
      enableUserDescription:
        '该用户会立即恢复认证访问，已有项目成员关系和角色也会重新生效。',
      grantSuperAdminTitle: '授予 {email} 超级管理员权限？',
      grantSuperAdminDescription:
        '这将授予全局用户、团队、项目、配置和审计管理权限。',
      revokeSuperAdminTitle: '撤销 {email} 的超级管理员权限？',
      revokeSuperAdminDescription:
        '该用户会失去全局管理权限，已有的项目成员关系不会改变。',
      changeMemberRoleTitle: '将 {user} 的角色从“{from}”改为“{to}”？',
      changeMemberRoleDescription:
        '这会立即更改该用户在项目中的权限，请确认目标角色后再保存。',
      removeMemberTitle: '从项目中移除 {user}？',
      removeMemberDescription:
        '该用户会立即失去项目访问权限，其既有草稿和审计历史会保留。',
    },
    workbench: {
      eyebrow: '产品工作台',
      title: '在一个管理界面中规划、审阅并发布文档。',
      description:
        '把控制台作为产品运营台：邀请成员、组织团队和项目、发布版本化文档、比较破坏性变更，并为智能体签发 MCP 令牌。',
      roleTitle: '角色指引',
      superAdminRole: '超级管理员工作区',
      adminRole: '项目管理员工作区',
      writerRole: '写作者工作区',
      readerRole: '只读工作区',
      noProjectRole: '没有有效项目角色',
      superAdminGuidance:
        '先创建用户和团队，再创建带负责管理员的项目，让作者进入草稿发布流程。',
      adminGuidance:
        '重点关注项目成员、文档分支、草稿审阅、版本浏览和令牌治理。',
      writerGuidance: '创建和修订草稿、查看审核意见，并提交给管理员人工发布。',
      readerGuidance: '浏览已发布文档、版本、差异和 AI 解释，不修改项目状态。',
      noProjectGuidance:
        '请选择你拥有有效成员关系的项目；缺少成员证据时不会自动显示为只读角色。',
      usersStat: '可在 Vdoc 中协作的成员',
      teamsStat: '项目的归属边界',
      projectsStat: '已准备承载文档的产品空间',
      tokensStat: '由 Vdoc 签发的智能体凭据',
      nextStepsTitle: '推荐配置路径',
      nextStepsDescription:
        '就绪状态只根据当前所选的有效项目和文档判断，不使用无关历史对象凑数。',
      done: '已完成',
      inspectStep: '查看证据',
      continueStep: '继续此步骤',
      nextIncompleteStep: '继续“{step}”，这是当前上下文首个未完成的检查项。',
      lifecycleCompleteTitle: '生命周期已完成',
      lifecycleCompleteDescription:
        '当前所选项目和文档的全部就绪检查均已完成，可打开下方任一步骤复核证据。',
      steps: {
        team: {
          title: '创建团队',
          description: '围绕产品或服务边界组织负责人。',
        },
        project: {
          title: '创建项目',
          description: '绑定团队和首个管理员，让文档有明确归属。',
        },
        document: {
          title: '添加文档',
          description: '选择 OpenAPI 或 Markdown，并设置仓库相对路径。',
        },
        branch: {
          title: '确认有效分支',
          description: '新文档会自动创建环境分支，请确认至少一个分支仍有效。',
        },
        draft: {
          title: '提交草稿',
          description: '只有已提交审阅或已发布的草稿才计入此步骤。',
        },
        version: {
          title: '发布不可变版本',
          description: '批准后必须为当前文档生成正式发布版本。',
        },
        token: {
          title: '签发有效读取令牌',
          description: '令牌必须未过期，并具备匹配当前文档的读取范围。',
        },
        connection: {
          title: '验证智能体连接',
          description:
            '执行 tools/list 和一次读取，再确认有效令牌出现最近使用时间。',
        },
      },
    },
    emptyStates: {
      generic: {
        description: '此面板暂时没有可用的后端数据。',
      },
      users: {
        title: '还没有用户',
        description: '先创建首个用户，再分配项目管理员或审计用户 MCP 令牌。',
        action: '使用上方“创建用户”表单。',
      },
      teams: {
        title: '还没有团队',
        description: '团队是 Vdoc 项目的归属边界，应在项目配置前创建。',
        action: '用清晰的产品或服务名称创建团队。',
      },
      projects: {
        title: '还没有项目',
        description:
          '项目连接团队、管理员、文档、成员、分支、草稿、版本和差异。',
        action: '至少存在一个团队和用户后创建项目。',
      },
      members: {
        title: '还没有项目成员',
        description: '选择项目后添加只读、写作和管理员角色，让审阅责任明确。',
        action: '选择项目后使用成员表单。',
      },
      memberCandidates: {
        title: '没有可添加的用户',
        description:
          '所有有效账号都已经是该项目成员。请先创建或重新启用账号，再添加成员。',
        action: '如果你是超级管理员，请前往用户页面管理账号。',
      },
      documents: {
        title: '此项目还没有文档',
        description:
          '添加 OpenAPI 或 Markdown 文档后，分支、草稿、版本、端点和差异才有来源。',
        action: '选择项目并使用“创建文档”。',
      },
      branches: {
        title: '此文档还没有分支',
        description:
          '分支为草稿提供稳定审阅目标；新文档通常会自动创建 dev、test 和 prod 分支。',
        action: '选择文档并确认有效分支，或另行创建分支。',
      },
      drafts: {
        title: '没有待审阅草稿',
        description: '从分支创建草稿，检查内容和机器差异，然后提交审阅。',
        action: '创建草稿前先选择项目、文档和分支。',
      },
      versions: {
        title: '还没有发布版本',
        description: '批准会发布不可变版本，并用于内容浏览和差异比较。',
        action: '检查证据后批准一份已提交草稿。',
      },
      endpoints: {
        title: '此版本没有匹配端点',
        description:
          'OpenAPI 版本会显示端点。请调整搜索或发布 OpenAPI 文档版本。',
        action: '选择其他版本或清空端点搜索。',
      },
      diffs: {
        title: '没有可审阅的差异',
        description:
          '比较两个已发布版本后，可按破坏性、必须处理或高严重级别筛选。',
        action: '选择源版本和目标版本，然后点击比较。',
      },
      audit: {
        title: '没有匹配筛选条件的审计事件',
        description:
          '授权变更和 MCP 活动发生后会产生审计记录；筛选条件也可能隐藏已有事件。',
        action: '选择其他项目，或清空动作和资源类型筛选。',
      },
      tokens: {
        title: '还没有 MCP 令牌',
        description:
          '令牌只通过受支持的 Vdoc 令牌 API 创建，并应按智能体用途限制范围。',
        action: '创建令牌后立即复制一次性原始值。',
      },
      userTokens: {
        title: '未选择用户令牌',
        description: '选择用户后审计其 MCP 令牌，或确认尚未签发。',
        action: '点击用户表格中的邮箱。',
      },
    },
    developerPortal: {
      endpointCount: '端点',
      endpointCountDescription: '所选版本返回的端点',
      methodCount: '方法',
      methodCountDescription: '当前视图中的唯一 HTTP 方法',
      tagCount: '标签',
      tagCountDescription: '当前视图中的唯一 OpenAPI 标签',
      searchLabel: '端点搜索',
      searchPlaceholder: '搜索方法、路径、标签、操作或摘要',
      groupBy: '端点分组',
      groupByTag: '标签',
      groupByMethod: '方法',
      untagged: '未标记',
      endpointBrowserDescription:
        '像开发者门户一样浏览所选版本，同时不假设特定 OpenAPI 结构。',
      tag: '标签',
      deprecated: '已废弃',
      noEndpointSummary: '未提供端点摘要。',
      operationId: '操作 ID',
      tags: '标签',
      parameters: '参数',
      requestBody: '请求体',
      responses: '响应',
      runtime: '安全、服务器和 Schema 引用',
      security: '安全',
      servers: '服务器',
      schemaRefs: 'Schema 引用',
      normalizedOperation: '规范化操作',
    },
    permissions: {
      superAdminOnly: '此页面仅对有效的系统超级管理员开放。',
    },
    audit: {
      title: '审计历史',
      description: '按时间倒序展示产品活动。项目管理员只能查看自己管理的项目。',
      allProjects: '全部项目',
      projectAdminRequired: '请选择你拥有项目管理员角色的项目。',
      action: '动作',
      actionPlaceholder: '例如 document.create',
      resourceType: '资源类型',
      resourceTypePlaceholder: '例如 document',
      time: '时间',
      actor: '操作者',
      resource: '资源',
      result: '结果',
    },
    review: {
      noteTitle: '审阅备注',
      noteDescription:
        '先选择一份已提交草稿，填写可选备注，再确认对该草稿执行的审阅动作。',
      selectedDraft: '作用于所选草稿：{draft}',
      noDraftSelected: '请先选择草稿，再添加审阅上下文。',
      confirmApproveTitle: '发布 {draft}？',
      confirmApproveDescription:
        '批准后会创建不可变的正式版本。请确认你审阅的正是这份草稿及其差异。',
      confirmRequestTitle: '要求修改 {draft}？',
      confirmRequestDescription:
        '所选草稿会退回给作者，并附带上方填写的审阅备注。',
      confirmRejectTitle: '拒绝 {draft}？',
      confirmRejectDescription:
        '所选草稿会以已拒绝状态关闭，之后不能继续编辑。',
    },
    draftEditor: {
      createTitle: '创建草稿',
      editTitle: '编辑所选草稿',
      readOnlyTitle: '所选草稿为只读状态',
      readOnlyDescription:
        '已提交、已拒绝和已发布的草稿会保留审阅历史，不能继续编辑。请新建草稿后继续。',
      newDraft: '新建草稿',
      branchImmutable: '草稿创建后所属分支不可更改。如需换分支，请新建草稿。',
      archivedTitle: '归档上下文为只读',
      archivedDescription:
        '所选项目、文档或草稿所属分支已归档。历史内容仍可查看，但不再允许修改草稿。',
    },
    projects: {
      initialAdminHint:
        '留空时，当前登录操作者会成为首个项目管理员；如需指定其他负责人，请明确选择用户。',
    },
    promote: {
      unavailableTitle: '当前无法创建晋级草稿',
      unavailableDescription:
        '请先在有效源分支发布版本，并保留另一个不同的有效目标分支，再创建晋级草稿。',
    },
    ai: {
      badge: 'AI',
      panelTitle: 'AI 摘要和聊天',
      panelDescription: '作用于所选 {ownerType}：{ownerId}',
      noTarget: '请先选择草稿、版本或差异，再使用 AI 工具。',
      summaryTitle: 'AI 摘要',
      regenerateSummary: '重新生成 AI 摘要',
      chatTitle: 'AI 聊天',
      chatSession: '聊天历史',
      noMessages: '还没有 AI 聊天消息。',
      chatMessage: 'AI 聊天消息',
      sendMessage: '发送 AI 消息',
      readOnlyTitle: '归档上下文为只读',
      readOnlyDescription:
        '历史摘要和聊天会话仍可查看，但不能再启动新的 AI 工作。',
      noSummary: '还没有生成 AI 摘要。',
      summaryStatus: 'AI 摘要状态：{status}',
      summaryStatusReady: '就绪',
      summaryStatusPending: '生成中',
      summaryStatusSucceeded: '已成功',
      summaryStatusFailed: '失败',
      summaryStatusSkipped: '已跳过',
      settingsTitle: 'AI 设置',
      settingsDescription:
        '配置提供商和提示词模板，同时不暴露已保存的 API key。',
      projectScope: '项目提供商范围',
      noReadableProjects: '当前没有可查看 AI 设置的项目。',
      loadingProjects: '正在加载项目…',
      projectsLoadErrorTitle: '无法加载项目',
      projectsLoadErrorDescription: '请刷新页面后再选择 AI 配置范围。',
      checkingProjectPermission: '正在确认项目配置权限…',
      archivedSettingsTitle: '归档项目设置为只读',
      archivedSettingsDescription:
        '已保存的提供商和提示词配置仅供项目管理员和超级管理员查看历史；不能更新或测试提供商，也不能修改提示词。',
      readOnlySettingsTitle: '项目 AI 配置受权限保护',
      readOnlySettingsDescription:
        '只有项目管理员或超级管理员可以读取、修改或测试提供商及提示词配置。你仍可在文档权限允许时使用页面摘要和聊天。',
      permissionCheckFailedTitle: '无法确认项目权限',
      permissionCheckFailedDescription:
        '配置将保持只读。项目成员信息恢复后请刷新页面。',
      loadingProjectSettings: '正在加载项目 AI 设置…',
      loadingSystemProvider: '正在加载系统 AI 提供商…',
      systemProviderLoadErrorTitle: '无法加载系统 AI 提供商',
      systemProviderLoadErrorDescription:
        '请刷新页面后再修改或测试系统提供商。',
      projectSettingsErrorTitle: '无法加载项目 AI 设置',
      projectSettingsErrorDescription:
        '所选项目的配置当前不可用，请刷新或选择其他项目。',
      projectPromptsErrorTitle: '无法加载项目提示词',
      projectPromptsErrorDescription:
        '所选项目的提示词历史当前不可用，请刷新或选择其他项目。',
      systemProviderTitle: '系统 AI 提供商',
      projectProviderTitle: '项目 AI 提供商覆盖',
      systemProviderDescription: '用于超级管理员系统工作流的默认提供商。',
      projectProviderDescription: '仅用于所选项目的可选项目级覆盖。',
      projectProviderFallbackStatus:
        '项目覆盖：未配置。AI 可以回退使用已启用的系统提供商。',
      providerName: '提供商名称',
      baseUrl: 'Base URL',
      model: '模型',
      apiMode: 'API 模式',
      apiModePlaceholder: '选择 API 模式',
      apiModeChatCompletions: 'Chat Completions',
      apiModeResponses: 'Responses',
      systemApiKey: '系统 API key',
      projectApiKey: '项目 API key',
      apiKeyPlaceholder: '留空则保留现有密钥',
      enabled: '启用',
      temperature: '温度',
      timeoutMs: '超时（毫秒）',
      maxOutputTokens: '最大输出 token 数',
      saveSystemProvider: '保存系统提供商',
      saveProjectProvider: '保存项目提供商',
      testSystemProvider: '测试系统提供商',
      testProjectProvider: '测试项目提供商',
      providerTestResult: '提供商测试结果',
      providerConfigurationStatus: '提供商配置：{status}',
      providerConfigured: '已配置',
      providerUnconfigured: '未配置',
      providerTestStatus: '提供商测试状态：{status}',
      providerTestIdle: '未测试',
      providerTestSuccess: '成功',
      providerTestError: '错误',
      providerTestUnknownError: '提供商测试失败，但没有返回错误消息。',
      settingsMutationErrorTitle: 'AI 设置未保存',
      settingsMutationErrorRecovery: '表单内容已保留，请修正错误后重试。',
      systemPromptsTitle: '系统提示词设置',
      projectPromptsTitle: '项目提示词设置',
      promptSettingsDescription:
        '编辑 AI 摘要和聊天使用的系统提示词和用户提示词。',
      loadingPrompts: '正在加载 AI 提示词模板…',
      promptsLoadErrorTitle: '无法加载 AI 提示词',
      promptsLoadErrorDescription: '请刷新页面后再修改提示词配置。',
      noPrompts: '后端没有返回 AI 提示词模板。',
      systemPrompt: '系统提示词',
      userPromptTemplate: '用户提示词模板',
      saveSystemPrompt: '保存系统提示词 {prompt}',
      saveProjectPrompt: '保存项目提示词 {prompt}',
      savePrompt: '保存提示词',
      keyUnset: '密钥状态：未设置',
      keyStatus: '密钥状态：已设置 · 尾号：{last4}',
    },
    markdownFacts: {
      title: 'Markdown 事实',
      description: '从所选原始或稳定 Markdown 内容中提取结构化事实。',
      headings: '标题',
      lists: '列表',
      tasks: '任务',
      codeBlocks: '代码块',
      links: '链接',
      lineCount: '{count} 行',
      countSummary: '{count} 个{label}',
      noFacts: '未找到 Markdown 事实。',
      checked: '已选中',
      open: '未完成',
      ordered: '有序',
      unordered: '无序',
      noLanguage: '纯文本',
      unsafeLink: '不安全链接',
    },
    token: {
      scopesTitle: '令牌权限范围',
      apiRead: 'api:read — 查询 OpenAPI 契约和差异',
      apiDraft: 'api:draft — 创建和更新 OpenAPI 草稿',
      docRead: 'doc:read — 查询 Markdown 文档和差异',
      docDraft: 'doc:draft — 创建和更新 Markdown 草稿',
      secretAvailable: '有效令牌明文',
      secretGuidance: '有效令牌可再次查看和复制；已撤销或过期令牌保持脱敏。',
      copy: '复制令牌',
      copySuccess: '令牌已复制。',
      copyFailed: '令牌复制失败，请手动选择并复制。',
      revealErrorTitle: '无法查看令牌',
      revokeErrorTitle: '无法撤销令牌',
      configTitle: 'MCP 客户端配置',
      configDescription:
        '运行 Vdoc stdio 适配器，并把令牌放入 VDOC_MCP_TOKEN 环境变量，而不是命令参数或 HTTP 配置。',
      connectionVerifiedTitle: '已找到智能体连接证据',
      connectionVerifiedDescription:
        '{time}，有效读取令牌“{name}”已对 {target} 完成 {tool}。Vdoc 仅保留这条脱敏的已发布内容读取摘要，不记录令牌明文或返回内容。',
      connectionPendingTitle: '尚未验证智能体连接',
      connectionPendingDescription:
        '把配置复制到智能体，执行 tools/list 和一次已发布内容读取后刷新；仅鉴权成功不会完成此检查。',
      refreshConnectionEvidence: '刷新连接证据',
      activityTitle: '最近智能体活动',
      activityDescription:
        '脱敏 MCP 调用摘要只包含工具、适配器、结果和精确实体 ID；绝不包含令牌明文或返回的文档内容。',
      activityTool: '工具',
      activityTarget: '精确目标',
      activityAdapter: '适配器',
      activityEvidence: '证据',
      evidencePublishedRead: '已发布内容读取',
      evidenceCapabilityList: '能力列表',
      evidenceToolCall: '工具调用',
    },
    deepLink: {
      invalidTitle: '链接实体不可用',
      invalidDescription:
        'Vdoc 没有静默切换到其他记录。以下精确目标不存在或不在你的可见范围内：{targets}',
    },
    skill: {
      installTitle: '安装官方 Skill',
      installDescription:
        'Vdoc Skill 指导智能体查询已审阅事实、比较版本并提交草稿，同时不绕过人工发布。',
      stepPackage:
        '把公开 Vdoc-skill 仓库克隆到 Codex 用户级或仓库级 Skill 目录。',
      stepMcp:
        '运行 Vdoc MCP stdio 适配器，并通过环境变量配置后端地址和限定范围的有效令牌。',
      stepVerify:
        '重启智能体，先验证 list_projects、list_documents 和读取工具，再执行草稿工作流。',
      boundaryTitle: '人工发布边界',
      boundaryDescription:
        'Skill 和 MCP 可以创建、更新并提交草稿；只有 Project Admin 或 SuperAdmin 能在工作台批准并发布。',
    },
    diff: {
      compareHint: '自动加载历史比较；只有所选版本对没有记录时才创建新差异。',
      noDiffSelected: '运行比较后审阅变更。',
      existingLoaded: '已加载历史差异',
      historyTitle: '历史差异',
      historyDescription: '选择既有比较，或在上方指定精确版本对。',
      historyIdentifiers: '版本 ID {from} → {to} · 差异 ID {diff}',
      addedEndpoints: '新增端点',
      removedEndpoints: '删除端点',
      modifiedEndpoints: '修改端点',
      breakingChanges: '破坏性变更',
      addedLines: '新增行',
      removedLines: '删除行',
      modifiedLines: '修改行',
      modifiedBlocks: '变更块',
      addedLinesDescription: '目标 Markdown 文件新增的行',
      removedLinesDescription: '从源 Markdown 文件删除的行',
      modifiedLinesDescription: '需要审阅的行替换',
      modifiedBlocksDescription: '包含变更的统一差异分组',
      addedDescription: '目标版本中的新增操作',
      removedDescription: '从源版本删除的操作',
      modifiedDescription: '需要审阅的已变更操作',
      breakingDescription: '标记为破坏性的变更',
      searchLabel: '搜索变更',
      searchPlaceholder: '搜索方法、路径、消息、位置或影响',
      filterLabel: '审阅筛选',
      filterAll: '全部变更',
      filterBreaking: '仅破坏性',
      filterMustHandle: '必须处理',
      filterHigh: '高严重级别',
      highSeverity: '高严重级别',
      mediumSeverity: '中严重级别',
      lowSeverity: '低严重级别',
      infoSeverity: '信息',
      added: '新增',
      removed: '删除',
      modified: '修改',
      breaking: '破坏性',
      mustHandle: '必须处理',
      changeCount: '项变更',
      severity: '严重级别',
      oldValue: '旧值',
      newValue: '新值',
      unifiedDiff: '统一行差异',
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
      initialAdmin: '首个项目管理员',
      document: '文档',
      branch: '分支',
      sourceBranch: '源分支',
      targetBranch: '目标分支',
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
      schemaFile: 'Schema 或 Markdown 文件',
      contentKind: '内容类型',
      reviewNote: '审阅备注',
      scopes: '范围',
      expiresAt: '过期时间',
      lastUsedAt: '最近使用时间',
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
      defaultBranch: '默认分支',
      protectedBranch: '受保护分支',
      token: '令牌',
    },
    placeholders: {
      selectProject: '选择项目',
      selectTeam: '选择团队',
      selectDocument: '选择文档',
      selectVersion: '选择版本',
      selectBranch: '选择分支',
      selectPublishedBranch: '选择已有发布版本的源分支',
      selectUser: '选择用户',
      useCurrentUser: '使用当前登录用户',
      optionalIsoDate: '可选 ISO 日期',
      endpointPath: '筛选端点路径',
      reviewNote: '批准、请求修改或拒绝时可附加的备注',
    },
    pages: {
      dashboard: {
        title: '实时产品工作台',
        description:
          '根据 Vdoc 后端 API 跟踪配置、审阅、版本和智能体访问状态。',
        stage: '生命周期总览',
        cue: '当工作区刚开始配置或状态不清晰时从这里开始。',
        next: '进入实体页面前，先确认第一个未完成的生命周期步骤。',
        health: '后端健康状态',
        identity: '当前登录身份',
      },
      users: {
        title: '用户',
        description: '列出用户、创建账号、修补状态，并监管用户 MCP 令牌。',
        stage: '工作区配置',
        cue: '成员和角色决定谁可以管理项目并审阅草稿。',
        next: '先创建用户，再分配项目成员或审计用户令牌。',
      },
      teams: {
        title: '团队',
        description: '创建、更新和归档 Vdoc 团队。',
        stage: '工作区配置',
        cue: '团队为项目提供归属边界。',
        next: '先创建团队，再把项目连接到负责人。',
      },
      projects: {
        title: '项目',
        description: '使用真实后端 API 管理项目和项目成员关系。',
        stage: '工作区配置',
        cue: '项目连接团队、管理员、成员、文档、草稿和版本。',
        next: '选择项目并确认成员关系，再添加文档。',
      },
      documents: {
        title: '文档',
        description: '选择项目后管理文档和分支。',
        stage: '来源/文档',
        cue: '文档和分支是草稿审阅的来源目标。',
        next: '先创建文档和分支，再提交草稿。',
      },
      drafts: {
        title: '草稿',
        description: '创建和更新草稿，先检查机器证据，再执行审阅动作。',
        stage: '草稿/审阅',
        cue: '草稿在提交并批准为不可变版本前都不是可信事实。',
        next: '批准、拒绝或请求修改前，先检查差异、内容和可选 AI 证据。',
      },
      versions: {
        title: '版本',
        description: '浏览已发布版本、内容和 OpenAPI 端点。',
        stage: '版本/开发者门户',
        cue: '已发布版本是人和智能体消费的权威事实。',
        next: '选择版本以检查内容和端点事实。',
      },
      diffs: {
        title: '差异',
        description: '优先加载历史比较，仅在版本对没有记录时创建差异。',
        stage: '版本/差异',
        cue: '差异揭示已审阅版本之间的风险，避免下游消费者误用。',
        next: '选择来源和目标版本，再按破坏性或必须处理变更过滤。',
      },
      audit: {
        title: '审计日志',
        description: '按项目、动作和资源类型检查有权限查看的产品活动。',
        stage: '系统/审计',
        cue: '审计证据把操作员和智能体动作关联到受影响资源。',
        next: '项目管理员选择自己管理的项目；超级管理员可使用全局筛选。',
      },
      mcpTokens: {
        title: 'MCP 令牌',
        description: '列出、创建、查看和撤销当前用户的 MCP 令牌。',
        stage: '智能体访问',
        cue: '令牌允许智能体访问已批准的 Vdoc 事实，而不是直接发布。',
        next: '签发限定范围令牌，执行 tools/list 和一次读取，再刷新连接证据。',
      },
      skill: {
        title: 'Vdoc Skill',
        description: '安装官方智能体工作流包，并连接 Vdoc MCP 端点。',
        stage: '智能体访问',
        cue: 'MCP 提供工具，Skill 提供安全工作流和输出模板。',
        next: '安装包、配置有效的限定范围令牌，并在提交草稿前验证读取工具。',
      },
      settings: {
        title: '设置',
        description: '从当前管理会话读取运行时、提供商和提示词设置。',
        stage: '系统/设置',
        cue: '运行时上下文和 AI 配置保持可见，同时不暴露已保存密钥。',
        next: '排查数据问题前，先确认身份、后端健康状态、提供商状态和提示词范围。',
      },
    },
    sections: {
      createUser: '创建用户',
      createTeam: '创建团队',
      createProject: '创建项目',
      createDocument: '创建文档',
      createBranch: '创建分支',
      createDraft: '创建或更新草稿',
      promoteDraft: '从已发布分支创建晋级草稿',
      diffPreview: '草稿差异预览',
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
      tokenDetails: '令牌详情',
    },
    statuses: {
      enabled: '启用',
      disabled: '停用',
      active: '激活',
      archived: '已归档',
      revoked: '已撤销',
      pending: '待处理',
      draft: '草稿',
      submitted: '已提交',
      approved: '已批准',
      published: '已发布',
      rejected: '已拒绝',
      changesRequested: '请求修改',
      ready: '就绪',
      degraded: '降级',
      expired: '已过期',
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
    controlPlane: {
      label: '控制平面',
      title: '审阅后的文档操作，始终保留状态轨迹。',
      description:
        '登录后可在一个冷静的操作界面中审阅草稿、比较版本、检查源事实并管理 MCP 访问。',
      sourceTitle: '事实源',
      sourceDescription: '版本、差异、令牌和审阅状态在认证后保持可见。',
      ready: '就绪',
    },
    email: '邮箱',
    password: '密码',
    name: '姓名',
    confirmPassword: '确认密码',
    registrationCheckingTitle: '正在检查注册状态',
    registrationChecking: '正在检查注册状态…',
    registrationUnavailableShort: '暂时无法检查注册状态，登录功能仍可使用。',
    registrationUnavailableTitle: '注册状态检查失败',
    registrationUnavailableDescription:
      'Vdoc 未能加载公开注册配置，这不代表注册已被关闭。',
    registrationUnavailableRecovery:
      '请重试配置检查或返回登录；在配置得到确认前不会显示账号创建表单。',
    retryRegistrationCheck: '重试注册状态检查',
    registrationDisabledShort: '注册已关闭，请联系系统管理员创建账号。',
    registrationDisabledTitle: '暂不开放注册',
    registrationDisabledDescription: '此 Vdoc 实例不允许匿名创建账号。',
    registrationDisabledRecovery: '请返回登录，并使用系统管理员创建的账号。',
    terms: '服务条款',
    privacy: '隐私政策',
    validation: {
      email: '请输入邮箱。',
      password: '请输入密码。',
      passwordLength: '密码至少需要 7 个字符。',
      passwordPolicy: '请输入 12–72 个 UTF-8 字节，且首尾不能包含空白字符。',
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
    retry: '重试',
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
    maintenanceTitle: 'Vdoc 服务暂时不可用',
    maintenanceDescription: '登录会话已保留。请恢复后端连接，然后重试。',
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
