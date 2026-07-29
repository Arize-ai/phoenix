import { beforeEach, describe, expect, it, vi } from "vitest";

const relayMocks = vi.hoisted(() => ({
  fetchQuery: vi.fn(),
  graphql: vi.fn((strings: TemplateStringsArray) => strings.join("")),
}));

vi.mock("relay-runtime", () => ({
  fetchQuery: relayMocks.fetchQuery,
  graphql: relayMocks.graphql,
}));

vi.mock("@phoenix/RelayEnvironment", () => ({ default: {} }));

import { validateSpanFilterCondition } from "../spanFilterValidation";

type ValidationPayload = {
  project: {
    validateSpanFilterCondition: {
      isValid: boolean;
      errorMessage: string | null;
    };
    analyzeSpanFilterCondition: {
      selectsRootSpansOnly: boolean;
    };
  };
};

function validPayload(selectsRootSpansOnly = false): ValidationPayload {
  return {
    project: {
      validateSpanFilterCondition: {
        isValid: true,
        errorMessage: null,
      },
      analyzeSpanFilterCondition: { selectsRootSpansOnly },
    },
  };
}

function mockValidationResponse(payload: ValidationPayload) {
  relayMocks.fetchQuery.mockReturnValue({
    toPromise: () => Promise.resolve(payload),
  });
}

describe("validateSpanFilterCondition cache", () => {
  beforeEach(() => {
    relayMocks.fetchQuery.mockReset();
  });

  it("reuses a completed validation for the same project and condition", async () => {
    mockValidationResponse(validPayload(true));

    const first = await validateSpanFilterCondition(
      "parent_id is None and status_code == 'ERROR'",
      "project-cache-reuse"
    );
    const second = await validateSpanFilterCondition(
      "parent_id is None and status_code == 'ERROR'",
      "project-cache-reuse"
    );

    expect(first).toEqual(second);
    expect(relayMocks.fetchQuery).toHaveBeenCalledTimes(1);
  });

  it("does not share validation across projects", async () => {
    mockValidationResponse(validPayload());
    const condition = "status_code == 'ERROR' and name == 'project-scope'";

    await validateSpanFilterCondition(condition, "project-cache-scope-a");
    await validateSpanFilterCondition(condition, "project-cache-scope-b");

    expect(relayMocks.fetchQuery).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent validation for the same key", async () => {
    let resolveResponse: (payload: ValidationPayload) => void = () => undefined;
    const response = new Promise<ValidationPayload>((resolve) => {
      resolveResponse = resolve;
    });
    relayMocks.fetchQuery.mockReturnValue({
      toPromise: () => response,
    });

    const first = validateSpanFilterCondition(
      "status_code == 'ERROR' and name == 'concurrent'",
      "project-cache-concurrent"
    );
    const second = validateSpanFilterCondition(
      "status_code == 'ERROR' and name == 'concurrent'",
      "project-cache-concurrent"
    );

    expect(relayMocks.fetchQuery).toHaveBeenCalledTimes(1);
    resolveResponse(validPayload());
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
  });

  it("evicts a failed request so the condition can retry", async () => {
    relayMocks.fetchQuery.mockReturnValueOnce({
      toPromise: () => Promise.reject(new Error("network failed")),
    });
    const condition = "status_code == 'ERROR' and name == 'retry'";
    const projectId = "project-cache-retry";

    await expect(
      validateSpanFilterCondition(condition, projectId)
    ).rejects.toThrow("network failed");

    mockValidationResponse(validPayload());
    await expect(
      validateSpanFilterCondition(condition, projectId)
    ).resolves.toMatchObject({ isValid: true });
    expect(relayMocks.fetchQuery).toHaveBeenCalledTimes(2);
  });
});
