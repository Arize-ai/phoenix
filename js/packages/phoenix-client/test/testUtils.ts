import { DEFAULT_MOCK_BASE_URL } from "@arizeai/phoenix-testing";

import { createClient } from "../src";

/**
 * Create a Phoenix client for vitest tests. Ignores ambient environment
 * variables and points at the base URL that `@arizeai/phoenix-testing` mock
 * handlers are registered against by default.
 * @param params - client overrides
 * @param params.baseUrl - base URL the client sends requests to (defaults to
 * the mock server's base URL)
 */
export function createTestClient({
  baseUrl = DEFAULT_MOCK_BASE_URL,
}: {
  baseUrl?: string;
} = {}) {
  return createClient({
    getEnvironmentOptions: () => ({}),
    options: { baseUrl },
  });
}

/**
 * Builds a stand-in for `T` from only the members a test actually exercises.
 *
 * This is the single sanctioned home for the partial-double assertion. Prefer it
 * over `as never` / `as T` at the call site: the `Partial<T>` parameter still
 * checks the members you do provide against the real type, so a renamed method
 * or a changed signature fails the test build instead of silently passing.
 *
 * Only use this where the code under test provably touches the provided subset.
 */
export function partialMock<T>(partial: Partial<T>): T {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see the doc comment above; this is the one place the partial-double gap is acknowledged
  return partial as T;
}
