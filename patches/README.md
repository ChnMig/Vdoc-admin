# Dependency patches

`@tanstack__react-router@1.170.46.patch` fixes the React 19.3 compatibility issue in `lazyRouteComponent`: a render that suspended with `use()` must consume the same promise when it completes. The patch preserves the resolved import promise and keeps the React 19 `use()` call consistent, while retaining the React 18 fallback.

This follows [TanStack Router PR #8549](https://github.com/TanStack/router/pull/8549), addressing [issue #8487](https://github.com/TanStack/router/issues/8487). Remove the patch once an upstream release includes the fix, then rerun `src/lib/lazy-route-compatibility.test.tsx` and the document workspace browser tests with console error assertions.
