import { expect, type Page, type Route } from '@playwright/test'
import { createHash } from 'node:crypto'
import type {
  RepositoryBranch,
  RepositoryChange,
  RepositoryCommit,
  RepositoryMergeRequest,
  RepositoryRelease,
  RepositorySave,
} from '../../../src/lib/repository-api'

export const projectId = 'commit-project'
export const documentId = 'commit-document'
export const repositoryPath = `/api/v1/private/projects/${projectId}/repository`
export const mainId = 'repo-main'
export const workId = 'repo-work'
const timestamp = '2026-10-30T08:00:00Z'
const userId = 'commit-admin'

export async function installRepository(
  page: Page,
  options: {
    reader?: boolean
    importRequired?: boolean
    pageSize?: number
  } = {}
) {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'vdoc_admin_access_token',
      'repository-browser-session'
    )
    document.cookie = 'vdoc-admin-language=en; path=/'
  })
  await page.route(
    /https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\//,
    (route) => route.abort()
  )
  const requests: {
    method: string
    path: string
    body?: Record<string, unknown>
  }[] = []
  const unexpected: string[] = []
  const commits = new Map<string, RepositoryCommit>()
  const bodies = new Map<string, Map<string, string>>()
  const branches: RepositoryBranch[] = []
  const merges: RepositoryMergeRequest[] = []
  const releases: RepositoryRelease[] = []
  const analyses: Record<string, unknown>[] = []
  const subscriptions: Record<string, unknown>[] = []
  const events: Record<string, unknown>[] = []
  const idempotency = new Map<string, RepositoryCommit>()
  let serial = 0
  let loseNextSaveResponse = false
  const identifier = () =>
    createHash('sha256').update(`server-commit-${++serial}`).digest('hex')
  function append(
    branch: RepositoryBranch | undefined,
    changes: RepositoryChange[],
    message: string,
    parents?: string[]
  ) {
    const parent = branch?.head_commit_id
    const previous = parent ? commits.get(parent) : undefined
    const files = new Map(
      previous?.files.map((file) => [file.document_id, { ...file }]) ?? []
    )
    const content = new Map(parent ? bodies.get(parent) : [])
    for (const change of changes) {
      const id = change.document_id || `server-document-${++serial}`
      if (change.operation === 'delete') {
        files.delete(id)
        content.delete(id)
        continue
      }
      files.set(id, {
        document_id: id,
        relative_path: change.relative_path,
        name: change.name,
        document_type: change.document_type,
        description: change.description,
        content_hash: createHash('sha256').update(change.content).digest('hex'),
      })
      content.set(id, change.content)
    }
    const commit: RepositoryCommit = {
      id: identifier(),
      project_id: projectId,
      parent_ids: parents ?? (parent ? [parent] : []),
      tree_hash: identifier(),
      message,
      created_by: userId,
      created_at: timestamp,
      files: [...files.values()],
    }
    commits.set(commit.id, commit)
    bodies.set(commit.id, content)
    if (branch) {
      branch.head_commit_id = commit.id
      branch.generation++
    }
    events.push({
      id: `event-${serial}`,
      sequence: events.length + 1,
      event_type: 'commit.created',
      actor_id: userId,
      created_at: timestamp,
      after_commit_id: commit.id,
    })
    return commit
  }
  const initialBody = '# Shared guide\r\n\r\nOriginal saved body.\r\n'
  const initial = append(
    undefined,
    options.importRequired
      ? []
      : [
          {
            operation: 'upsert',
            document_id: documentId,
            name: 'Shared guide',
            document_type: 2,
            relative_path: 'guides/shared.md',
            content: initialBody,
          },
        ],
    'Initial server commit'
  )
  for (const [id, name, protectedBranch] of [
    [mainId, 'main', true],
    [workId, 'work', false],
  ] as const)
    branches.push({
      id,
      project_id: projectId,
      name,
      is_protected: protectedBranch,
      head_commit_id: initial.id,
      generation: 1,
      created_by: userId,
      created_at: timestamp,
      ...(options.importRequired ? { import_required: true } : {}),
    })
  const document = {
    id: documentId,
    project_id: projectId,
    name: 'Shared guide',
    document_type: 2,
    file_name: 'shared.md',
    relative_path: 'guides/shared.md',
    status: 1,
    latest_version_id: options.importRequired ? 'legacy-version' : null,
    created_by: userId,
    created_at: timestamp,
    updated_at: timestamp,
  }
  async function ok(route: Route, detail: unknown) {
    return route.fulfill({
      json: {
        code: 200,
        status: 'OK',
        timestamp: 1,
        detail,
        ...(Array.isArray(detail) ? { total: detail.length } : {}),
      },
    })
  }
  async function fail(route: Route, code: number, description: string) {
    return route.fulfill({
      status: code,
      json: {
        code,
        status: code === 409 ? 'ABORTED' : 'UNAVAILABLE',
        description,
        timestamp: 1,
      },
    })
  }
  function history(branchId: string) {
    const found: RepositoryCommit[] = []
    let id = branches.find((branch) => branch.id === branchId)?.head_commit_id
    while (id) {
      const commit = commits.get(id)
      if (!commit) break
      found.push(commit)
      id = commit.parent_ids[0]
    }
    return found
  }
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request(),
      method = request.method(),
      url = new URL(request.url()),
      path = url.pathname
    if (method === 'OPTIONS') return route.fulfill({ status: 204 })
    const body = request.postData()
      ? (request.postDataJSON() as Record<string, unknown>)
      : undefined
    requests.push({ method, path, ...(body ? { body } : {}) })
    if (path.endsWith('/identity/me'))
      return ok(route, {
        id: userId,
        email: 'commit@example.test',
        name: 'Commit Admin',
        status: 1,
        is_super_admin: !options.reader,
        can_access_audit: !options.reader,
      })
    if (path === '/api/v1/private/projects')
      return ok(route, [
        {
          id: projectId,
          name: 'Commit workspace',
          team_id: 'commit-team',
          team_name: 'Commit team',
          status: 1,
        },
      ])
    if (path === '/api/v1/private/teams')
      return ok(route, [{ id: 'commit-team', name: 'Commit team' }])
    if (path === `/api/v1/private/projects/${projectId}/members`)
      return ok(route, [
        {
          user_id: userId,
          user_status: 1,
          role: options.reader ? 1 : 3,
          status: 1,
        },
      ])
    if (path === `/api/v1/private/projects/${projectId}/folders`)
      return ok(route, [])
    if (
      path === `/api/v1/private/projects/${projectId}/documents` &&
      method === 'GET'
    )
      return ok(route, [document])
    const local = path.startsWith(repositoryPath)
      ? path.slice(repositoryPath.length)
      : ''
    if (local === '/branches' && method === 'GET') return ok(route, branches)
    if (local === '/branches' && method === 'POST') {
      expect(body).toMatchObject({
        name: expect.any(String),
        from_commit_id: expect.any(String),
      })
      expect(commits.has(String(body!.from_commit_id))).toBe(true)
      const branch = {
        ...branches[1],
        id: `server-branch-${++serial}`,
        name: String(body!.name),
        head_commit_id: String(body!.from_commit_id),
        generation: 1,
        is_protected: false,
      }
      branches.push(branch)
      return ok(route, branch)
    }
    if (local === '/bootstrap' && method === 'POST') {
      for (const branch of branches) {
        delete branch.import_required
        append(
          branch,
          [
            {
              operation: 'upsert',
              document_id: documentId,
              name: 'Shared guide',
              document_type: 2,
              relative_path: 'guides/shared.md',
              content: initialBody,
            },
          ],
          'Imported legacy snapshot'
        )
      }
      return ok(route, branches)
    }
    if (local === '/commits' && method === 'GET') {
      const all = history(url.searchParams.get('branch_id') ?? workId),
        size = options.pageSize ?? 100
      const start = Number(url.searchParams.get('cursor') ?? 0)
      return ok(route, {
        commits: all.slice(start, start + size),
        ...(start + size < all.length
          ? { next_cursor: String(start + size) }
          : {}),
      })
    }
    const fixed = local.match(
      /^\/commits\/([^/]+)(?:\/documents\/([^/]+)\/content)?$/
    )
    if (fixed && method === 'GET') {
      const commit = commits.get(fixed[1])
      expect(commit, 'fixed commit must exist').toBeDefined()
      return ok(
        route,
        fixed[2]
          ? {
              commit_id: commit!.id,
              document: commit!.files.find(
                (file) => file.document_id === fixed[2]
              ),
              content: bodies.get(commit!.id)?.get(fixed[2]),
            }
          : commit
      )
    }
    const save = local.match(/^\/branches\/([^/]+)\/commits$/)
    if (save && method === 'POST') {
      const input = body as RepositorySave
      expect(input).not.toHaveProperty('version_name')
      expect(input).not.toHaveProperty('id')
      expect(input.idempotency_key).toBeTruthy()
      if (idempotency.has(input.idempotency_key))
        return ok(route, idempotency.get(input.idempotency_key))
      const branch = branches.find((item) => item.id === save[1])!
      if (
        branch.generation !== input.expected_generation ||
        branch.head_commit_id !== input.expected_head_commit_id
      )
        return fail(route, 409, 'The branch changed after editing started.')
      expect(branch.is_protected).toBe(false)
      const commit = append(
        branch,
        input.changes,
        input.message || 'Server saved commit'
      )
      idempotency.set(input.idempotency_key, commit)
      if (loseNextSaveResponse) {
        loseNextSaveResponse = false
        return fail(route, 503, 'Response unavailable; retry this save.')
      }
      return ok(route, commit)
    }
    if (local === '/comparisons' && method === 'POST') {
      const from = String(body!.from_commit_id),
        to = String(body!.to_commit_id)
      expect(commits.has(from) && commits.has(to)).toBe(true)
      return ok(route, {
        id: `comparison-${++serial}`,
        from_commit_id: from,
        to_commit_id: to,
        files: commits.get(to)!.files.map((file) => ({
          ...file,
          change_type: 'modified',
          old_content: bodies.get(from)?.get(file.document_id) ?? '',
          new_content: bodies.get(to)?.get(file.document_id) ?? '',
        })),
      })
    }
    if (local === '/merge-requests' && method === 'GET')
      return ok(route, merges)
    if (local === '/merge-requests' && method === 'POST') {
      const source = branches.find(
          (item) => item.id === body!.source_branch_id
        )!,
        target = branches.find((item) => item.id === body!.target_branch_id)!
      const merge: RepositoryMergeRequest = {
        id: `merge-${++serial}`,
        project_id: projectId,
        title: String(body!.title ?? ''),
        source_branch_id: source.id,
        target_branch_id: target.id,
        source_commit_id: source.head_commit_id,
        target_commit_id: target.head_commit_id,
        source_generation: source.generation,
        target_generation: target.generation,
        base_commit_id: initial.id,
        conflicts: [],
        status: 'open',
        created_by: userId,
        created_at: timestamp,
        generation: 1,
        result_files: commits.get(source.head_commit_id)!.files,
      }
      merges.unshift(merge)
      return ok(route, merge)
    }
    const mergeContent = local.match(
      /^\/merge-requests\/([^/]+)\/documents\/([^/]+)\/content$/
    )
    if (mergeContent)
      return ok(route, {
        merge_request_id: mergeContent[1],
        generation: 1,
        content: '# Shared guide\n\nTarget value=1\n\nSource value=1\n',
        document: commits.get(branches[1].head_commit_id)!.files[0],
      })
    const action = local.match(/^\/merge-requests\/([^/]+)\/(approve|merge)$/)
    if (action) {
      const merge = merges.find((item) => item.id === action[1])!,
        source = branches.find((item) => item.id === merge.source_branch_id)!,
        target = branches.find((item) => item.id === merge.target_branch_id)!
      if (
        source.generation !== merge.source_generation ||
        target.generation !== merge.target_generation
      )
        return fail(
          route,
          409,
          'The review is stale. Create a new merge request.'
        )
      if (action[2] === 'approve') {
        merge.status = 'approved'
        merge.approved_by = userId
      } else {
        expect(merge.status).toBe('approved')
        merge.status = 'merged'
        merge.merged_commit_id = append(
          target,
          [],
          'Merged approved snapshot',
          [target.head_commit_id, source.head_commit_id]
        ).id
      }
      return ok(route, merge)
    }
    if (local === '/releases' && method === 'GET') return ok(route, releases)
    if (local === '/releases' && method === 'POST') {
      expect(body).not.toHaveProperty('version_name')
      const branch = branches.find((item) => item.id === body!.branch_id)!
      expect(body!.expected_generation).toBe(branch.generation)
      const release = {
        id: `server-release-${++serial}`,
        branch_id: branch.id,
        commit_id: String(body!.commit_id),
        version_name: `r-20261030-${serial}`,
        message: String(body!.message ?? ''),
        published_by: userId,
        published_at: timestamp,
      }
      releases.unshift(release)
      return ok(route, release)
    }
    if (local === '/ai/analyses' && method === 'GET') return ok(route, analyses)
    if (local === '/ai/analyses' && method === 'POST') {
      expect(commits.has(String(body!.to_commit_id))).toBe(true)
      const analysis = {
        ...body,
        id: `analysis-${++serial}`,
        status: 'succeeded',
        content: '## Fixed commit analysis\n\nThe selected snapshot changed.',
        created_at: timestamp,
      }
      analyses.unshift(analysis)
      return ok(route, analysis)
    }
    if (local === '/events') return ok(route, events)
    if (local === '/event-deliveries') return ok(route, [])
    if (local === '/subscriptions' && method === 'GET')
      return ok(route, subscriptions)
    if (local === '/subscriptions' && method === 'POST') {
      const subscription = {
        ...body,
        id: `subscription-${++serial}`,
        project_id: projectId,
        paused: false,
        generation: 1,
        last_sequence: 0,
        created_by: userId,
        created_at: timestamp,
      }
      subscriptions.push(subscription)
      return ok(route, subscription)
    }
    const pause = local.match(/^\/subscriptions\/([^/]+)\/(pause|resume)$/)
    if (pause) {
      const subscription = subscriptions.find((item) => item.id === pause[1])!
      subscription.paused = pause[2] === 'pause'
      return ok(route, subscription)
    }
    unexpected.push(`${method} ${path}`)
    return fail(route, 500, 'Unexpected fixture request')
  })
  return {
    requests,
    unexpected,
    commits,
    bodies,
    branches,
    merges,
    releases,
    initial,
    initialBody,
    analyses,
    subscriptions,
    loseSaveResponse: () => {
      loseNextSaveResponse = true
    },
    advance: (
      branchId = workId,
      content = '# Shared guide\n\nA concurrent server edit.\n'
    ) =>
      append(
        branches.find((item) => item.id === branchId)!,
        [
          {
            operation: 'upsert',
            document_id: documentId,
            name: 'Shared guide',
            document_type: 2,
            relative_path: 'guides/shared.md',
            content,
          },
        ],
        'Concurrent server commit'
      ),
    open: () =>
      page.goto(
        `/documents/${documentId}?team_id=commit-team&project_id=${projectId}&repository_branch_id=${workId}`
      ),
  }
}

/** A legacy-link test can return to the default workflow without fabricating an import. */
export async function installUnimportedRepository(page: Page, project: string) {
  const prefix = `/api/v1/private/projects/${project}/repository`
  const head = 'd'.repeat(64)
  await page.route(`**${prefix}/branches`, (route) =>
    route.fulfill({
      json: {
        code: 200,
        status: 'OK',
        timestamp: 1,
        detail: [
          {
            id: 'unimported-main',
            project_id: project,
            name: 'main',
            head_commit_id: head,
            generation: 1,
            is_protected: true,
            created_by: userId,
            created_at: timestamp,
            import_required: true,
          },
        ],
      },
    })
  )
  await page.route(`**${prefix}/commits/${head}`, (route) =>
    route.fulfill({
      json: {
        code: 200,
        status: 'OK',
        timestamp: 1,
        detail: {
          id: head,
          project_id: project,
          parent_ids: [],
          tree_hash: 'e'.repeat(64),
          message: 'Awaiting explicit import',
          created_by: userId,
          created_at: timestamp,
          files: [],
        },
      },
    })
  )
}
