# Unit Tests

Vitest runs `js/app` tests in jsdom: there is no layout, no real network, and no server. A test is worth adding when it fails if the behavior it covers is removed and still passes after a refactor that keeps that behavior (`REVIEW.md`: tests that only exercise mocks or restate the implementation must not be added).

## Worth a Vitest test

- Pure utilities: formatting, parsing, derived state, URL and search-param handling.
- Hooks with real logic, through `renderHook` with their real inputs.
- Relay updaters. Extract the updater to a named function that takes the store and the values it needs, seed the records with `environment.commitUpdate`, run the updater the same way, and assert on the records.
- A component's own decision logic, such as which state it renders for an input, rendered with its real children and only the data it needs.
- A Relay fragment or query component's decision logic, with data from `relay-test-utils` (see Relay components below).

## Not worth one

These test the fake, or Relay and React, rather than Phoenix code:

- Relay pagination plumbing (`usePaginationFragment`, `@connection`, `loadNext`). Relay owns it.
- Scrolling, resizing, focus, or anything that depends on layout. jsdom has no layout, so the test only checks the numbers it assigned with `Object.defineProperty`.
- Whole pages rendered against a hand-written Relay `Network` or payload that serves query results, cursors or pages. The fake has to match every fragment, ties the test to operation names and aliases, and tests its own pagination. Generate payloads with `MockPayloadGenerator` instead.
- `vi.mock` of the module under test or of the loader hook that feeds it data.
- Silencing `console.warn` or `console.error` so incomplete fake payloads pass.

Cover these with a Playwright test in `js/app/tests/` (see the `phoenix-playwright-tests` skill) against a running server. When no browser is available, list the manual steps under Not verified in the PR body instead of writing a test that fakes one.

## Relay components

Use `relay-test-utils` ([guide](https://relay.dev/docs/guides/testing-relay-components/)) instead of building an `Environment` with a hand-written `Network` and payload. `vitest.setup.ts` maps the `jest.fn` it calls to `vi.fn`.

- `createMockEnvironment()` gives a store-backed environment whose operations stay pending until the test resolves them: `environment.mock.resolveMostRecentOperation(...)` / `rejectMostRecentOperation(...)` inside `act`, or `queueOperationResolver(...)` before render to answer them as they are sent. Assert the loading state before resolving, the error state after rejecting.
- `MockPayloadGenerator.generate(operation, resolvers)` fills every field of the operation, fragments included. Resolvers are keyed by GraphQL type (`Span`, `Project`, `ID`, `String`) and return only the fields the assertions depend on. Return `{ __typename: "Span" }` from `Node` for `node(id:)` queries.
- To test a fragment component, spread its fragment into a test-only query marked `@relay_test_operation` in the test file and render the component from that query. The directive adds schema type info, so Int, Float, Boolean and enum fields get typed values and can have their own resolvers. Run `pnpm run build:relay` and commit the `__tests__/__generated__/` artifact. Keep the directive in `__tests__/` files only. Example: `src/components/trace/__tests__/SpanMetricsDetails.test.tsx`.
- A product query carries no type info, so every scalar but `id` reaches the `String` resolver. Switch on `context.name` (the schema field name, not the alias) for enums and numbers the component reads. Example: `src/pages/trace/__tests__/SpanDetails.test.tsx`.
- For `usePreloadedQuery`, call `queueOperationResolver(...)`, then `queuePendingOperation(query, variables)`, then `loadQuery(environment, query, variables)` with the same query and variables, so the hook does not suspend.

## Example

A fix makes the prompt versions list page through all versions and moves tags in the Relay store instead of refetching. Don't render `PromptVersionsPage` with a fake server that implements `promptVersions` pagination and fake scroll heights: that tests the fake and Relay. Test the tag-moving updater against a store with a few versions, and cover "scrolling loads older versions" in Playwright or under Not verified.
