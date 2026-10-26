import { RouterContextProvider } from "react-router";
import type * as RelayRuntime from "relay-runtime";

const mockFetchQuery = vi.hoisted(() => vi.fn());

vi.mock("relay-runtime", async (importOriginal) => ({
  ...(await importOriginal<typeof RelayRuntime>()),
  fetchQuery: () => ({ toPromise: () => mockFetchQuery() }),
}));

import { promptVersionsLoader } from "../promptVersionsLoader";

function load(params: { promptId: string; versionId?: string }) {
  const url = new URL(`http://localhost/prompts/${params.promptId}/versions`);
  return promptVersionsLoader({
    request: new Request(url),
    url,
    pattern: "/prompts/:promptId/versions",
    params,
    context: new RouterContextProvider(),
  });
}

function redirectLocation(response: unknown): string | null {
  return response instanceof Response ? response.headers.get("Location") : null;
}

describe("promptVersionsLoader", () => {
  it("does nothing when a version is selected", async () => {
    await expect(load({ promptId: "p-1", versionId: "v-1" })).resolves.toBe(
      null
    );
  });

  it("redirects a prompt to its latest version", async () => {
    mockFetchQuery.mockResolvedValueOnce({
      prompt: {
        __typename: "Prompt",
        promptVersions: { edges: [{ promptVersion: { id: "pv-2" } }] },
      },
    });
    expect(redirectLocation(await load({ promptId: "p-1" }))).toBe(
      "/prompts/p-1/versions/pv-2"
    );
  });

  it("redirects a decision to its latest version", async () => {
    mockFetchQuery.mockResolvedValueOnce({
      prompt: { __typename: "Decision", latestVersion: { id: "dv-3" } },
    });
    expect(redirectLocation(await load({ promptId: "d-1" }))).toBe(
      "/prompts/d-1/versions/dv-3"
    );
  });

  it("throws for a decision without versions", async () => {
    mockFetchQuery.mockResolvedValueOnce({
      prompt: { __typename: "Decision", latestVersion: null },
    });
    await expect(load({ promptId: "d-1" })).rejects.toThrow(
      "Decision does not have any versions"
    );
  });
});
