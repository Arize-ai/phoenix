# Data Fetching

## Relay store and cache retention

Declarative Relay hooks (`usePreloadedQuery`, `useLazyLoadQuery`) retain their query and fetched data in the Relay store cache for as long as the component using the hook is mounted. This makes them safe for hydrating data that is rendered on a page.

`fetchQuery` does **not** have this retention guarantee. Data fetched via `fetchQuery` can be evicted from the Relay store after enough subsequent requests (e.g., requests triggered by pagination). This means using `fetchQuery` to hydrate data that is rendered on a page is dangerous — the data may silently disappear from the store while the component is still mounted.

## Rules

- **Prefer declarative hooks.** Use hooks such as `usePreloadedQuery` or `useLazyLoadQuery` to fetch data that will be rendered on a page.
- **Avoid `fetchQuery` for page-rendered data.** Do not use `fetchQuery` to hydrate data that a mounted component depends on for rendering.
- **Limited safe uses of `fetchQuery`.** `fetchQuery` is acceptable when the result is consumed immediately and not held in the store for rendering, such as fetching data for a redirect or a one-shot action.
