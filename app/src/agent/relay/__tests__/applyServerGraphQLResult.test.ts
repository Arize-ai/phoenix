import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const relayEnvironmentMock = vi.hoisted(() => ({
  commitPayload: vi.fn(),
  retain: vi.fn(() => ({ dispose: vi.fn() })),
}));

vi.mock("@phoenix/RelayEnvironment", () => ({
  default: relayEnvironmentMock,
}));

import { applyServerGraphQLResult } from "@phoenix/agent/relay/applyServerGraphQLResult";
import type { ServerGraphQLResult } from "@phoenix/agent/relay/applyServerGraphQLResult";

function buildResult(
  overrides: Partial<ServerGraphQLResult> = {}
): ServerGraphQLResult {
  return {
    query: `
      query ApplyResultUserQuery($id: ID!) {
        user(id: $id) { id __typename name }
      }
    `,
    variables: { id: "u1" },
    data: { user: { id: "u1", __typename: "User", name: "Ada" } },
    operationType: "query",
    ...overrides,
  };
}

describe("applyServerGraphQLResult", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    relayEnvironmentMock.commitPayload.mockClear();
    relayEnvironmentMock.retain.mockClear();
    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("does nothing when data is null or undefined", () => {
    applyServerGraphQLResult(buildResult({ data: null }));
    applyServerGraphQLResult(buildResult({ data: undefined }));
    expect(relayEnvironmentMock.commitPayload).not.toHaveBeenCalled();
    expect(relayEnvironmentMock.retain).not.toHaveBeenCalled();
  });

  it("does nothing when data is not an object", () => {
    applyServerGraphQLResult(buildResult({ data: 42 }));
    applyServerGraphQLResult(buildResult({ data: "nope" }));
    applyServerGraphQLResult(buildResult({ data: [1, 2, 3] }));
    expect(relayEnvironmentMock.commitPayload).not.toHaveBeenCalled();
  });

  it("never throws on a malformed query; it logs and returns", () => {
    expect(() =>
      applyServerGraphQLResult(
        buildResult({ query: "query Broken {", data: { ok: true } })
      )
    ).not.toThrow();
    expect(relayEnvironmentMock.commitPayload).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy.mock.calls[0]?.[0]).toContain("[agent relay]");
  });

  it("commits the payload and retains the operation", () => {
    const result = buildResult();
    applyServerGraphQLResult(result);

    expect(relayEnvironmentMock.commitPayload).toHaveBeenCalledTimes(1);
    const [operation, payload] =
      relayEnvironmentMock.commitPayload.mock.calls[0];
    expect(payload).toBe(result.data);
    // The operation descriptor was built from the streamed query text.
    expect(operation.request.node.params.text).toBe(result.query);
    expect(operation.request.variables).toEqual({ id: "u1" });
    expect(relayEnvironmentMock.retain).toHaveBeenCalledTimes(1);
  });

  it("defaults null variables to an empty object", () => {
    applyServerGraphQLResult(
      buildResult({
        query: "query ApplyResultNoVarsQuery { viewer { id __typename } }",
        variables: null,
        data: { viewer: { id: "v1", __typename: "User" } },
      })
    );
    expect(relayEnvironmentMock.commitPayload).toHaveBeenCalledTimes(1);
    const [operation] = relayEnvironmentMock.commitPayload.mock.calls[0];
    expect(operation.request.variables).toEqual({});
  });

  it("dedupes retains per operation identifier but always recommits", () => {
    const result = buildResult({
      query: `
        query ApplyResultDedupeQuery($id: ID!) {
          user(id: $id) { id __typename name }
        }
      `,
    });
    applyServerGraphQLResult(result);
    applyServerGraphQLResult(result);
    expect(relayEnvironmentMock.commitPayload).toHaveBeenCalledTimes(2);
    expect(relayEnvironmentMock.retain).toHaveBeenCalledTimes(1);

    // Different variables produce a different request identifier: retained
    // separately.
    applyServerGraphQLResult({
      ...result,
      variables: { id: "u2" },
      data: { user: { id: "u2", __typename: "User", name: "Grace" } },
    });
    expect(relayEnvironmentMock.retain).toHaveBeenCalledTimes(2);
  });
});
