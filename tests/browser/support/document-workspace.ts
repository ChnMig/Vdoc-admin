import { expect, type Locator, type Page, type Route } from '@playwright/test'
import { selectOption } from '../helpers/select-option'
import { registerCapabilitySecret } from './secret-safety.mjs'

export const projectId = 'workspace-project'
export const documentId = 'workspace-handbook'
export const mainBranchId = 'branch-main'
export const releaseBranchId = 'branch-release'
export const latestId = 'a'.repeat(32)
export const historicalId = 'b'.repeat(32)
export const releaseId = 'c'.repeat(32)
export const mainDraftId = 'draft-main'
export const releaseDraftId = 'draft-release'
export const timestamp = '2026-10-25T08:00:00Z'
export const basePath = `/api/v1/private/projects/${projectId}/documents/${documentId}`
const headers = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Authorization, Content-Type',
  'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

const document = {
  id: documentId,
  project_id: projectId,
  folder_id: 'folder-guides',
  name: 'Integration handbook',
  file_name: 'integration.md',
  relative_path: 'guides/integration.md',
  document_type: 2,
  status: 1,
  workflow_state: 'published',
  has_draft: true,
  latest_version_id: latestId,
  latest_draft_id: mainDraftId,
  created_at: timestamp,
  updated_at: timestamp,
}

const branch = {
  id: mainBranchId,
  document_id: documentId,
  name: 'main',
  kind: 1,
  is_default: true,
  is_protected: true,
  status: 1,
  created_at: timestamp,
  updated_at: timestamp,
}

const versions = [
  { id: latestId, branch_id: mainBranchId, version_name: '2.4.0' },
  { id: historicalId, branch_id: mainBranchId, version_name: '2.3.0' },
  { id: releaseId, branch_id: releaseBranchId, version_name: '3.0.0-rc.1' },
].map((version) => ({
  ...version,
  project_id: projectId,
  document_id: documentId,
  document_format: 3,
  source_type: 1,
  status: 1,
  changelog: 'Reviewed integration guidance',
  published_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
}))

const drafts = [
  { id: mainDraftId, branch_id: mainBranchId, version_name: '2.5.0-draft' },
  {
    id: releaseDraftId,
    branch_id: releaseBranchId,
    version_name: '3.0.0-draft',
  },
].map((draft) => ({
  ...draft,
  project_id: projectId,
  document_id: documentId,
  revision: `revision-${draft.id}`,
  document_format: 3,
  source_type: 1,
  status: 1,
  changelog: 'Saved draft for editorial review',
  created_at: timestamp,
  updated_at: timestamp,
}))

export const contentById: Record<string, string> = {
  [latestId]:
    '# Integration handbook 2.4\n\nUse this reviewed guide to connect the workspace to your service.\n\n## Authentication\n\nCreate a project credential and send it with each API request.\n\n## Release checklist\n\n1. Validate the request schema.\n2. Review the saved draft.\n3. Publish an immutable version.\n\nThe published release remains stable while new drafts evolve.',
  [historicalId]:
    '# Historical handbook 2.3\n\nThis immutable historical revision uses the legacy credential flow.\n\n## Migration\n\nCompare the previous release with version 2.4 before upgrading.',
  [releaseId]:
    '# Release candidate handbook\n\nThis release branch documents the upcoming integration contract.',
  [mainDraftId]:
    '# Main branch working draft\n\nThis saved draft adds the new retry policy and remains private.',
  [releaseDraftId]:
    '# Release branch working draft\n\nThis exact saved draft describes the upcoming webhook contract.',
}

type ApiRequest = {
  method: string
  path: string
  query: Record<string, string>
  body?: Record<string, unknown>
}

async function envelope(route: Route, detail: unknown, total?: number) {
  await route.fulfill({
    status: 200,
    headers,
    contentType: 'application/json',
    body: JSON.stringify({
      code: 200,
      status: 'OK',
      description: 'OK',
      timestamp: 1,
      detail,
      ...(total === undefined ? {} : { total }),
    }),
  })
}

export async function installWorkspace(
  page: Page,
  language = 'en',
  role: 'admin' | 'writer' | 'reader' = 'admin',
  longContent = false,
  options: { chatHistory?: boolean; archivedReleaseBranch?: boolean } = {}
) {
  const requests: ApiRequest[] = []
  const diffs: Array<Record<string, unknown>> = []
  const unexpected: string[] = []
  const branches = [
    branch,
    {
      ...branch,
      id: releaseBranchId,
      name: 'release/2026',
      status: options.archivedReleaseBranch ? 2 : 1,
      is_default: false,
      is_protected: false,
    },
  ]
  await page.addInitScript((locale) => {
    sessionStorage.setItem(
      'vdoc_admin_access_token',
      'synthetic-workspace-session'
    )
    document.cookie = `vdoc-admin-language=${locale}; path=/`
  }, language)
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS')
      return route.fulfill({ status: 204, headers })
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    const body = request.postData() ? request.postDataJSON() : undefined
    requests.push({
      method,
      path,
      query: Object.fromEntries(url.searchParams),
      ...(body === undefined ? {} : { body }),
    })
    if (path.endsWith('/identity/me'))
      return envelope(route, {
        id: `workspace-${role}`,
        name: 'Documentation admin',
        email: 'admin@example.test',
        is_super_admin: role === 'admin',
        can_access_audit: role === 'admin',
        status: 1,
      })
    if (path === '/api/v1/private/teams')
      return envelope(
        route,
        [
          {
            id: 'workspace-team',
            name: 'Documentation team',
            description: 'Shared product knowledge',
          },
        ],
        1
      )
    if (path === `/api/v1/private/projects/${projectId}/members`)
      return envelope(
        route,
        [
          {
            project_id: projectId,
            user_id: `workspace-${role}`,
            user_name: role,
            user_email: `${role}@example.test`,
            user_status: 1,
            status: 1,
            role: role === 'reader' ? 1 : 2,
          },
        ],
        1
      )
    if (path === '/api/v1/private/projects')
      return envelope(
        route,
        [
          {
            id: projectId,
            team_id: 'workspace-team',
            team_name: 'Documentation team',
            name: 'Developer platform',
            status: 1,
          },
        ],
        1
      )
    if (path === `/api/v1/private/projects/${projectId}/folders`)
      return envelope(
        route,
        [
          {
            id: 'folder-guides',
            project_id: projectId,
            parent_id: null,
            name: 'guides',
            path: 'guides',
          },
          {
            id: 'folder-reference',
            project_id: projectId,
            parent_id: null,
            name: 'reference',
            path: 'reference',
          },
        ],
        2
      )
    if (path === `/api/v1/private/projects/${projectId}/documents`)
      return envelope(
        route,
        [
          document,
          {
            ...document,
            id: 'workspace-openapi',
            name: 'Platform API',
            file_name: 'platform.yaml',
            relative_path: 'guides/platform.yaml',
            document_type: 1,
          },
          {
            ...document,
            id: 'workspace-text',
            name: 'Operations notes',
            file_name: 'operations.txt',
            relative_path: 'guides/operations.txt',
            document_type: 3,
          },
        ],
        3
      )
    if (path === `${basePath}/branches` && method === 'GET')
      return envelope(route, branches, branches.length)
    if (path === `${basePath}/branches` && method === 'POST') {
      const created = {
        ...branch,
        id: 'branch-custom',
        ...body,
        is_default: false,
        is_protected: false,
      }
      branches.push(created)
      return envelope(route, created)
    }
    if (path === `${basePath}/versions`) {
      const items = versions.filter(
        (version) =>
          !url.searchParams.get('branch_id') ||
          version.branch_id === url.searchParams.get('branch_id')
      )
      return envelope(route, items, items.length)
    }
    if (path === `${basePath}/drafts`) {
      const items = drafts.filter(
        (draft) =>
          !url.searchParams.get('branch_id') ||
          draft.branch_id === url.searchParams.get('branch_id')
      )
      return envelope(route, items, items.length)
    }
    const version = versions.find(
      (version) => path === `${basePath}/versions/${version.id}`
    )
    if (version) return envelope(route, version)
    const contentMatch = path.match(
      /\/(versions|drafts)\/([^/]+)\/content\/raw$/
    )
    if (contentMatch) {
      const id = contentMatch[2]
      return envelope(route, {
        owner_type: contentMatch[1] === 'versions' ? 'version' : 'draft',
        owner_id: id,
        content:
          longContent && id === latestId
            ? `${contentById[id].replace('## Release checklist', `${Array.from({ length: 16 }, (_, index) => `Integration step ${index + 1}: validate the credential scope and the reviewed document contract before enabling traffic.`).join('\n\n')}\n\n## Release checklist`)}\n\n## Appendix\n\n${Array.from({ length: 8 }, () => 'Keep an audit record of the reviewed integration and verify its published version before deployment.').join('\n\n')}`
            : contentById[id],
        content_kind: 'markdown',
        kind: 'raw',
        hash: `synthetic-${id}`,
        ...(contentMatch[1] === 'drafts'
          ? { draft: drafts.find((draft) => draft.id === id) }
          : {}),
      })
    }
    if (path === `${basePath}/overview`)
      return envelope(route, {
        version_count: 3,
        endpoint_count: 0,
        latest_version: versions[0],
        published_branch_ids: [mainBranchId, releaseBranchId],
        raw_line_count: 16,
        raw_size_bytes: 490,
      })
    if (path === `${basePath}/shares` && method === 'GET')
      return envelope(route, [], 0)
    if (path === `${basePath}/shares` && method === 'POST') {
      const registryPath = process.env['VDOC_PLAYWRIGHT_SECRET_REGISTRY']
      if (!registryPath)
        throw new Error('The Playwright secret registry is required.')
      const secret = `vdoc_share_${'d'.repeat(48)}`
      await registerCapabilitySecret(registryPath, secret)
      return envelope(route, {
        secret,
        share: {
          id: 'e'.repeat(32),
          project_id: projectId,
          document_id: documentId,
          ...body,
          status: 1,
          password_protected: false,
          created_at: timestamp,
          updated_at: timestamp,
        },
      })
    }
    if (path === `${basePath}/diffs`) {
      if (method === 'POST') {
        const created = {
          id: `synthetic-diff-${diffs.length + 1}`,
          document_id: documentId,
          ...body,
          diff_status: 1,
          summary: {
            document_format: 3,
            added_endpoints: 1,
            removed_endpoints: 0,
            modified_endpoints: 1,
            breaking_changes: 0,
            must_handle: 0,
          },
          items: [],
          created_at: timestamp,
          updated_at: timestamp,
        }
        diffs.push(created)
        return envelope(route, created)
      }
      const items = diffs.filter(
        (diff) =>
          (!url.searchParams.get('from_version_id') ||
            diff.from_version_id === url.searchParams.get('from_version_id')) &&
          (!url.searchParams.get('to_version_id') ||
            diff.to_version_id === url.searchParams.get('to_version_id'))
      )
      return envelope(route, items, items.length)
    }
    const requestedDiff = diffs.find(
      (diff) => path === `${basePath}/diffs/${diff.id}`
    )
    if (requestedDiff) return envelope(route, requestedDiff)
    if (path.endsWith('/ai-summary')) {
      const ownerId = path.split('/').at(-2)
      return envelope(route, {
        id: `summary-${ownerId}`,
        status: 'ready',
        content: `Summary for exact revision ${ownerId}.`,
      })
    }
    if (path === `/api/v1/private/projects/${projectId}/ai/chat-sessions`) {
      if (method === 'POST')
        return envelope(route, { id: 'chat-exact-revision', ...body })
      return envelope(
        route,
        options.chatHistory
          ? [
              {
                id: 'chat-history-policy',
                project_id: projectId,
                title: 'Reviewed integration policy',
                context_type: url.searchParams.get('context_type'),
                context_id: url.searchParams.get('context_id'),
                created_at: timestamp,
                updated_at: timestamp,
              },
              {
                id: 'chat-history-upgrade',
                project_id: projectId,
                title: 'Release upgrade plan',
                context_type: url.searchParams.get('context_type'),
                context_id: url.searchParams.get('context_id'),
                created_at: timestamp,
                updated_at: timestamp,
              },
            ]
          : [],
        options.chatHistory ? 2 : 0
      )
    }
    if (
      path.endsWith('/chat-history-policy') ||
      path.endsWith('/chat-history-upgrade')
    )
      return envelope(route, { id: path.split('/').at(-1), messages: [] })
    if (path.endsWith('/chat-exact-revision/messages'))
      return envelope(route, {
        id: 'assistant-answer',
        session_id: 'chat-exact-revision',
        role: 'assistant',
        content: 'This answer uses the selected document revision.',
      })
    if (path.endsWith('/chat-exact-revision'))
      return envelope(route, { id: 'chat-exact-revision', messages: [] })
    unexpected.push(`${method} ${path}`)
    await route.fulfill({
      status: 404,
      headers,
      body: 'Unexpected synthetic API request',
    })
  })
  return { requests, unexpected }
}

export async function chooseWorkspaceOption(trigger: Locator, value: string) {
  const page = trigger.page()
  await expect(page.getByRole('listbox', { includeHidden: true })).toHaveCount(
    0
  )
  await selectOption(trigger, value)
  await expect(trigger).toHaveAttribute('value', value)
  await expect(page.getByRole('listbox', { includeHidden: true })).toHaveCount(
    0
  )
}

// Legacy reader coverage always opens an explicit saved revision. The default
// project commit workflow is exercised separately in repository-workflow.pw.ts.
export async function openDocument(page: Page) {
  await page.goto(
    `/documents/${documentId}?team_id=workspace-team&project_id=${projectId}&version_id=${latestId}`
  )
  await expect(
    page.getByRole('heading', { name: 'Integration handbook 2.4', exact: true })
  ).toBeVisible()
  return page.getByRole('navigation', { name: 'Files', exact: true })
}

export async function showFiles(page: Page) {
  const tree = page.getByRole('navigation', { name: 'Files', exact: true })
  if (!(await tree.isVisible()))
    await page.getByRole('button', { name: 'Show files', exact: true }).click()
  await expect(tree).toBeVisible()
  return tree
}

export async function closeMobileFiles(page: Page) {
  if (
    (page.viewportSize()?.width ?? 0) < 768 &&
    (await page.getByRole('dialog', { name: 'Files', exact: true }).isVisible())
  ) {
    await page
      .getByRole('dialog', { name: 'Files', exact: true })
      .getByRole('button', { name: 'Close', exact: true })
      .click()
    await expect(
      page.getByRole('dialog', { name: 'Files', exact: true })
    ).toHaveCount(0)
  }
}

export async function openTool(
  page: Page,
  name: 'Versions' | 'Diffs' | 'Document AI' | 'Document settings'
) {
  const navigation = page
    .getByRole('navigation', { name: 'Document tools', exact: true })
    .filter({ visible: true })
    .first()
  await navigation.getByRole('button', { name, exact: true }).click()
}
