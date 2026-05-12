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

## Don't over-fetch to look up one entity

When you need a single object by id (e.g. a lazy tooltip, a detail popover), fetch it directly via the `node(id: $id)` root field with an inline fragment on the concrete type — do **not** fetch a whole collection and `.find()` the one you want on the client. Over-fetching a list to grab one row wastes a round trip and scales badly.

If the type isn't yet exposed through the `node` interface, make it a `Node` on the backend (have its GQL type declare `id: NodeID[int]` / implement `Node`, resolve fields lazily from the id, and add an `elif type_name == X.__name__: return X(id=node_id)` branch to `Query.node` in `src/phoenix/server/api/queries.py`) rather than working around it with a collection query.
