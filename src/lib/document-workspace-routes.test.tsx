import { Suspense, type ComponentType } from 'react'
import { isRedirect } from '@tanstack/react-router'
import { Route as DiffsRoute } from '@/routes/_authenticated/diffs/index'
import { Route as DetailRoute } from '@/routes/_authenticated/documents/$documentId'
import { Route as DocumentsRoute } from '@/routes/_authenticated/documents/index'
import { Route as DraftsRoute } from '@/routes/_authenticated/drafts/index'
import { Route as HomeRoute } from '@/routes/_authenticated/index'
import { Route as VersionsRoute } from '@/routes/_authenticated/versions/index'
import { act, render, type RenderResult } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  VdocPageDeepLinkProps,
  VdocRouteSearch,
} from './vdoc-route-search'

const state = vi.hoisted(() => ({
  search: {} as VdocRouteSearch,
  documentId: 'path-document',
  navigate: vi.fn(),
  documentPage: vi.fn(),
  hierarchyPage: vi.fn(),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  createFileRoute: () => (options: unknown) => ({
    options,
    useSearch: () => state.search,
    useParams: () => ({ documentId: state.documentId }),
    useNavigate: () => state.navigate,
  }),
}))

vi.mock('@/features/vdoc-admin/document-workspace-page', () => ({
  DocumentWorkspacePage: (props: VdocPageDeepLinkProps) => {
    state.documentPage(props)
    return <div>Document page</div>
  },
}))

vi.mock('@/features/vdoc-admin/workspace-hierarchy-page', () => ({
  WorkspaceHierarchyPage: (props: VdocPageDeepLinkProps) => {
    state.hierarchyPage(props)
    return <div>Workspace hierarchy</div>
  },
}))

type TestRoute = {
  options: unknown
}

async function renderRoute(route: TestRoute) {
  const { component: Component } = route.options as {
    component: ComponentType & { preload?: () => Promise<void> }
  }
  await Component.preload?.()
  let screen!: RenderResult
  await act(async () => {
    screen = render(
      <Suspense fallback={<div>Loading route</div>}>
        <Component />
      </Suspense>
    )
  })
  await screen.findByText(/^(Document page|Workspace hierarchy)$/)
  return screen
}

function beforeLoad(route: TestRoute, search: VdocRouteSearch) {
  return (
    route.options as {
      beforeLoad?: (context: { search: VdocRouteSearch }) => unknown
    }
  ).beforeLoad?.({ search })
}

function redirectedOptions(route: TestRoute, search: VdocRouteSearch) {
  try {
    beforeLoad(route, search)
  } catch (error) {
    if (!isRedirect(error)) throw error
    return error.options
  }
  throw new Error('Expected a document redirect')
}

beforeEach(() => {
  vi.clearAllMocks()
  state.search = { team_id: 'team-1', project_id: 'project-1' }
  state.documentId = 'path-document'
})

describe('document routes', () => {
  it.each([
    ['home', HomeRoute],
    ['documents', DocumentsRoute],
  ] as const)(
    'renders the hierarchy at %s when no document is selected',
    async (_, route) => {
      expect(beforeLoad(route, state.search)).toBeUndefined()
      const screen = await renderRoute(route)
      expect(screen.getByText('Workspace hierarchy')).toBeInTheDocument()
      expect(state.documentPage).not.toHaveBeenCalled()
      expect(state.hierarchyPage).toHaveBeenCalledWith(
        expect.objectContaining({ search: state.search })
      )
    }
  )

  it.each([
    ['home', HomeRoute, 'content'],
    ['documents', DocumentsRoute, 'content'],
    ['drafts', DraftsRoute, 'drafts'],
    ['versions', VersionsRoute, 'versions'],
    ['diffs', DiffsRoute, 'diffs'],
  ] as const)(
    'redirects legacy %s links while preserving the revision and original view',
    (_, route, workspaceView) => {
      expect(
        redirectedOptions(route, {
          ...state.search,
          document_id: 'legacy-document',
          version_id: 'selected-version',
        })
      ).toMatchObject({
        to: '/documents/$documentId',
        params: { documentId: 'legacy-document' },
        replace: true,
        search: {
          ...state.search,
          document_id: undefined,
          version_id: 'selected-version',
          workspace_view: workspaceView,
        },
      })
    }
  )

  it('lets an explicit legacy workspace view override the alias default', () => {
    expect(
      redirectedOptions(VersionsRoute, {
        ...state.search,
        document_id: 'legacy-document',
        workspace_view: 'share',
      })
    ).toMatchObject({ search: { workspace_view: 'share' } })
  })

  it('opens a legacy endpoint link in the reader with the exact version and branch', () => {
    expect(
      redirectedOptions(VersionsRoute, {
        ...state.search,
        document_id: 'legacy-document',
        branch_id: 'selected-branch',
        version_id: 'selected-version',
        endpoint_id: 'selected-endpoint',
      })
    ).toMatchObject({
      to: '/documents/$documentId',
      params: { documentId: 'legacy-document' },
      replace: true,
      search: {
        ...state.search,
        document_id: undefined,
        branch_id: 'selected-branch',
        version_id: 'selected-version',
        endpoint_id: 'selected-endpoint',
        workspace_view: 'content',
      },
    })
    expect(
      redirectedOptions(VersionsRoute, {
        ...state.search,
        document_id: 'legacy-document',
        endpoint_id: 'selected-endpoint',
        workspace_view: 'versions',
      })
    ).toMatchObject({ search: { workspace_view: 'versions' } })
  })

  it.each([DraftsRoute, VersionsRoute, DiffsRoute])(
    'returns a legacy tool URL without document identity to the scoped hierarchy',
    (route) => {
      expect(redirectedOptions(route, state.search)).toMatchObject({
        to: '/documents',
        replace: true,
        search: state.search,
      })
    }
  )

  it('uses the path document identity even if an old query contains a different one', async () => {
    state.search = {
      ...state.search,
      document_id: 'stale-query-document',
      version_id: 'version-1',
    }
    await renderRoute(DetailRoute)
    expect(state.documentPage).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultView: 'content',
        search: {
          ...state.search,
          document_id: 'path-document',
        },
      })
    )
  })

  it('keeps tool changes on the same detail path and honors replace', async () => {
    await renderRoute(DetailRoute)
    const props = state.documentPage.mock.calls[0][0] as VdocPageDeepLinkProps
    props.onSearchChange?.(
      { workspace_view: 'versions', version_id: 'version-2' },
      { replace: true }
    )
    expect(state.navigate).toHaveBeenCalledWith({
      replace: true,
      search: {
        ...state.search,
        document_id: undefined,
        workspace_view: 'versions',
        version_id: 'version-2',
      },
    })
  })

  it('navigates a newly created draft from the hierarchy into the independent document route', async () => {
    await renderRoute(DocumentsRoute)
    const props = state.hierarchyPage.mock.calls[0][0] as VdocPageDeepLinkProps
    props.onSearchChange?.({
      document_id: 'new-document',
      draft_id: 'new-draft',
      branch_id: 'new-branch',
      workspace_view: 'drafts',
    })
    expect(state.navigate).toHaveBeenCalledWith({
      to: '/documents/$documentId',
      params: { documentId: 'new-document' },
      replace: false,
      search: {
        ...state.search,
        document_id: undefined,
        draft_id: 'new-draft',
        branch_id: 'new-branch',
        workspace_view: 'drafts',
      },
    })
  })

  it('opens a hierarchy document with its selected team and project scope', async () => {
    await renderRoute(HomeRoute)
    const props = state.hierarchyPage.mock.calls[0][0] as {
      onDocumentOpen: (
        projectId: string,
        documentId: string,
        teamId: string
      ) => void
    }
    props.onDocumentOpen('project-2', 'document-2', 'team-2')
    expect(state.navigate).toHaveBeenCalledWith({
      to: '/documents/$documentId',
      params: { documentId: 'document-2' },
      replace: false,
      search: {
        team_id: 'team-2',
        project_id: 'project-2',
        document_id: undefined,
        workspace_view: 'content',
      },
    })
  })
})
