import type * as ReactRelay from "react-relay";
import { RouterContextProvider } from "react-router";

const mockFetchQuery = vi.hoisted(() => vi.fn());
const mockDispose = vi.hoisted(() => vi.fn());

vi.mock("react-relay", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRelay>()),
  fetchQuery: () => ({ toPromise: () => mockFetchQuery() }),
  loadQuery: () => ({ dispose: mockDispose }),
}));

import { promptLoader } from "../promptLoader";

/** The not-found response a loader throws, as `notFound` builds it. */
const notFoundResponse = (promptId: string) => ({
  type: "DataWithResponseInit",
  data: { kind: "entity", entityType: "prompt", identifier: promptId },
  init: { status: 404 },
});

function load(promptId: string) {
  const url = new URL(`http://localhost/prompts/${promptId}`);
  return promptLoader({
    request: new Request(url),
    url,
    pattern: "/prompts/:promptId",
    params: { promptId },
    context: new RouterContextProvider(),
  });
}

describe("promptLoader", () => {
  beforeEach(() => {
    mockDispose.mockClear();
  });

  it("loads a prompt", async () => {
    mockFetchQuery.mockResolvedValueOnce({
      prompt: { __typename: "Prompt", id: "p-1", name: "support" },
    });
    await expect(load("p-1")).resolves.toMatchObject({
      prompt: { __typename: "Prompt", id: "p-1", name: "support" },
    });
    expect(mockDispose).not.toHaveBeenCalled();
  });

  it("loads a decision under the same route", async () => {
    mockFetchQuery.mockResolvedValueOnce({
      prompt: { __typename: "Decision", id: "d-1", name: "triage" },
    });
    await expect(load("d-1")).resolves.toMatchObject({
      prompt: { __typename: "Decision", id: "d-1", name: "triage" },
    });
  });

  it("is not found when the id names another kind of node", async () => {
    mockFetchQuery.mockResolvedValueOnce({
      prompt: { __typename: "Project", id: "x-1" },
    });
    await expect(load("x-1")).rejects.toMatchObject(notFoundResponse("x-1"));
    expect(mockDispose).toHaveBeenCalled();
  });

  it("is not found when the server rejects the id", async () => {
    mockFetchQuery.mockRejectedValueOnce(
      new Error("Error fetching GraphQL query: Unknown node: garbage")
    );
    await expect(load("garbage")).rejects.toMatchObject(
      notFoundResponse("garbage")
    );
  });

  it("rethrows when the server cannot be reached", async () => {
    mockFetchQuery.mockRejectedValueOnce(new Error("Failed to fetch"));
    await expect(load("p-1")).rejects.toThrow("Failed to fetch");
  });
});
