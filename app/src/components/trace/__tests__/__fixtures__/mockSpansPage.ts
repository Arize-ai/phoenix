import type { Mock } from "vitest";
import { vi } from "vitest";

import { authApiFetch } from "@phoenix/api/authApiFetch";

/**
 * Resolve the mocked REST client with one page of spans.
 *
 * `authApiFetch.GET` is generic over every GET path in the API, so an inline object
 * literal leaves TypeScript to pick which path's response shape is meant — a choice
 * that shifts whenever an endpoint is added, and adding the media endpoints shifted
 * it. These tests assert on the request rather than on response typing, so the mock
 * value is supplied loosely and in one place instead of at each call site.
 */
export function mockSpansPageOnce(spans: unknown[]): void {
  (vi.mocked(authApiFetch.GET) as unknown as Mock).mockResolvedValueOnce({
    data: { data: spans, next_cursor: null },
    response: new Response(null, { status: 200 }),
  });
}
