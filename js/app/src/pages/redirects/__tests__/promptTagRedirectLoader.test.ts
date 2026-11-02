import { RouterContextProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const relayMocks = vi.hoisted(() => ({
  fetchQuery: vi.fn(),
  graphql: vi.fn((strings: TemplateStringsArray) => strings.join("")),
}));

vi.mock("react-relay", () => ({
  fetchQuery: relayMocks.fetchQuery,
  graphql: relayMocks.graphql,
}));

vi.mock("@phoenix/RelayEnvironment", () => ({ default: {} }));

import { ServerResponseError } from "@phoenix/components/exception/serverConnectionError";

import { promptTagRedirectLoader } from "../promptTagRedirectLoader";

function getLoaderArgs(): Parameters<typeof promptTagRedirectLoader>[0] {
  const url = "http://localhost/redirects/prompts/prompt-id/tags/production";
  return {
    params: { promptId: "prompt-id", tagName: "production" },
    request: new Request(url),
    url: new URL(url),
    pattern: "/redirects/prompts/:promptId/tags/:tagName",
    context: new RouterContextProvider(),
  };
}

function mockRejectedQuery(error: Error) {
  relayMocks.fetchQuery.mockReturnValue({
    toPromise: () => Promise.reject(error),
  });
}

describe("promptTagRedirectLoader", () => {
  beforeEach(() => {
    relayMocks.fetchQuery.mockReset();
  });

  it.each([403, 500])("rethrows a tagged %s response", async (status) => {
    const error = new ServerResponseError("Non-GraphQL response", status);
    mockRejectedQuery(error);

    await expect(promptTagRedirectLoader(getLoaderArgs())).rejects.toBe(error);
  });

  it("treats a GraphQL error as a missing prompt version", async () => {
    mockRejectedQuery(new Error("GraphQL error"));

    await expect(
      promptTagRedirectLoader(getLoaderArgs())
    ).rejects.toMatchObject({
      data: {
        kind: "entity",
        entityType: "prompt version",
        identifier: "production",
      },
      init: { status: 404 },
    });
  });
});
