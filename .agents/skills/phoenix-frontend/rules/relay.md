# Data Fetching

## Relay store and cache retention

Declarative Relay hooks (`usePreloadedQuery`, `useLazyLoadQuery`) retain their query and fetched data in the Relay store cache for as long as the component using the hook is mounted. This makes them safe for hydrating data that is rendered on a page.

`fetchQuery` does **not** have this retention guarantee. Data fetched via `fetchQuery` can be evicted from the Relay store after enough subsequent requests (e.g., requests triggered by pagination). This means using `fetchQuery` to hydrate data that is rendered on a page is dangerous — the data may silently disappear from the store while the component is still mounted.

Query refs returned by `loadQuery` are retained until they are disposed. Use `useQueryLoader` when the component owns loading. When a route loader or other external owner returns a `loadQuery` ref directly to a component, that component must dispose the ref when it stops owning it.

## Owned preloaded queries

Phoenix provides `app/src/hooks/useOwnedPreloadedQuery.ts` for the common route-loader pattern:

- Loader uses `loadQuery(...)` and returns a query ref.
- Component reads the ref with `useOwnedPreloadedQuery(...)`.
- The hook hands the ref to `useQueryLoader`, so Relay disposes it on replacement or unmount.

Use this hook only when the current component owns the lifecycle of an externally created query ref, such as `useLoaderData()` returning a `loadQuery` result.

Do **not** use this hook when:

- the query ref is already managed by `useQueryLoader`
- the ref is shared and another component owns disposal
- the ref is passed through context or props for multiple readers without clear single-owner semantics

## Rules

- **Prefer declarative hooks.** Use hooks such as `usePreloadedQuery` or `useLazyLoadQuery` to fetch data that will be rendered on a page.
- **Avoid `fetchQuery` for page-rendered data.** Do not use `fetchQuery` to hydrate data that a mounted component depends on for rendering.
- **Limited safe uses of `fetchQuery`.** `fetchQuery` is acceptable when the result is consumed immediately and not held in the store for rendering, such as fetching data for a redirect or a one-shot action.
- **Prefer `useQueryLoader` for component-owned query refs.** It handles retaining and disposal for refs the component loads itself.
- **Use `useOwnedPreloadedQuery` for loader-owned query refs.** If a route loader returns a `loadQuery` ref that this component owns directly, read it with `useOwnedPreloadedQuery` instead of `usePreloadedQuery`.
- **Treat disposal as an ownership decision.** Only the owner should dispose a query ref. Disposing a shared ref too early can make still-mounted readers hit missing-data or GC-related crashes later.
