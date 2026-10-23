import type * as ReactRelay from "react-relay";
import { RouterContextProvider } from "react-router";

const mockFetchQuery = vi.hoisted(() => vi.fn());

vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  fetchQuery: () => ({ toPromise: () => mockFetchQuery() }),
}));

import { decisionLoader } from "../decisionLoader";

/** The not-found response a loader throws, as `notFound` builds it. */
const notFoundResponse = (decisionId: string) => ({
  type: "DataWithResponseInit",
  data: { kind: "entity", entityType: "decision", identifier: decisionId },
  init: { status: 404 },
});

function load(decisionId: string) {
  const url = new URL(`http://localhost/decisions/${decisionId}`);
  return decisionLoader({
    request: new Request(url),
    url,
    pattern: "/decisions/:decisionId",
    params: { decisionId },
    context: new RouterContextProvider(),
  });
}

describe("decisionLoader", () => {
  it("loads a decision", async () => {
    mockFetchQuery.mockResolvedValueOnce({
      decision: { __typename: "Decision", id: "d-1", name: "triage" },
    });
    await expect(load("d-1")).resolves.toEqual({
      decision: { __typename: "Decision", id: "d-1", name: "triage" },
    });
  });

  it("is not found when the server rejects the id", async () => {
    mockFetchQuery.mockRejectedValueOnce(
      new Error("Error fetching GraphQL query: Unknown node: garbage")
    );
    await expect(load("garbage")).rejects.toMatchObject(
      notFoundResponse("garbage")
    );
  });

  it("is not found when the id names another kind of node", async () => {
    mockFetchQuery.mockResolvedValueOnce({
      decision: { __typename: "Prompt" },
    });
    await expect(load("p-1")).rejects.toMatchObject(notFoundResponse("p-1"));
  });

  it("rethrows when the server cannot be reached", async () => {
    mockFetchQuery.mockRejectedValueOnce(new Error("Failed to fetch"));
    await expect(load("d-1")).rejects.toThrow("Failed to fetch");
  });
});
