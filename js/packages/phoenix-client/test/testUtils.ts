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
