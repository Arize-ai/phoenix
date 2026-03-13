import { describe, expect, it, vi } from "vitest";

vi.unmock("../../src/utils/serverVersionUtils");

import {
  GET_SESSION,
  DELETE_SESSION,
  DELETE_SESSIONS,
  LIST_PROJECT_SESSIONS,
  ANNOTATE_SESSIONS,
  GET_SPANS_TRACE_IDS,
  ALL_REQUIREMENTS,
} from "../../src/constants/serverRequirements";
import type {
  RouteRequirement,
  ParameterRequirement,
} from "../../src/types/serverRequirements";
import {
  featureLabel,
  ensureServerFeature,
} from "../../src/utils/serverVersionUtils";

describe("featureLabel", () => {
  it("derives label for a route requirement", () => {
    expect(featureLabel(GET_SESSION)).toBe(
      "The GET /v1/sessions/{session_id} route"
    );
  });

  it("derives label for a parameter requirement", () => {
    expect(featureLabel(GET_SPANS_TRACE_IDS)).toBe(
      "The 'trace_id' query parameter on GET /v1/projects/{id}/spans"
    );
  });

  it("uses description override when provided", () => {
    const req: RouteRequirement = {
      kind: "route",
      method: "GET",
      path: "/v1/foo",
      minServerVersion: [1, 0, 0],
      description: "Custom description",
    };
    expect(featureLabel(req)).toBe("Custom description");
  });

  it("uses description override for parameter requirement", () => {
    const req: ParameterRequirement = {
      kind: "parameter",
      parameterName: "foo",
      parameterLocation: "query",
      route: "GET /v1/bar",
      minServerVersion: [1, 0, 0],
      description: "Custom param description",
    };
    expect(featureLabel(req)).toBe("Custom param description");
  });
});

describe("ensureServerFeature", () => {
  it("does not throw when server version meets requirement", async () => {
    const mockClient = {
      getServerVersion: async () => [13, 5, 0] as [number, number, number],
    };
    await expect(
      ensureServerFeature({ client: mockClient as never, requirement: GET_SESSION })
    ).resolves.toBeUndefined();
  });

  it("throws when server version is below requirement", async () => {
    const mockClient = {
      getServerVersion: async () => [13, 4, 0] as [number, number, number],
    };
    await expect(
      ensureServerFeature({ client: mockClient as never, requirement: GET_SESSION })
    ).rejects.toThrow(/requires Phoenix server >= 13\.5\.0/);
  });

  it("includes feature label in error message for route", async () => {
    const mockClient = {
      getServerVersion: async () => [12, 0, 0] as [number, number, number],
    };
    await expect(
      ensureServerFeature({ client: mockClient as never, requirement: DELETE_SESSION })
    ).rejects.toThrow(
      /The DELETE \/v1\/sessions\/\{session_id\} route/
    );
  });

  it("includes feature label in error message for parameter", async () => {
    const mockClient = {
      getServerVersion: async () => [12, 0, 0] as [number, number, number],
    };
    await expect(
      ensureServerFeature({ client: mockClient as never, requirement: GET_SPANS_TRACE_IDS })
    ).rejects.toThrow(/The 'trace_id' query parameter/);
  });

  it("throws when server version cannot be determined", async () => {
    const mockClient = {
      getServerVersion: async () => {
        throw new Error(
          "Phoenix server version could not be determined. " +
            "Please ensure you are connecting to a supported Phoenix server."
        );
      },
    };
    await expect(
      ensureServerFeature({ client: mockClient as never, requirement: GET_SESSION })
    ).rejects.toThrow(/version could not be determined/);
  });
});

describe("ALL_REQUIREMENTS", () => {
  it("contains all defined requirements", () => {
    expect(ALL_REQUIREMENTS).toContain(GET_SESSION);
    expect(ALL_REQUIREMENTS).toContain(DELETE_SESSION);
    expect(ALL_REQUIREMENTS).toContain(DELETE_SESSIONS);
    expect(ALL_REQUIREMENTS).toContain(LIST_PROJECT_SESSIONS);
    expect(ALL_REQUIREMENTS).toContain(ANNOTATE_SESSIONS);
    expect(ALL_REQUIREMENTS).toContain(GET_SPANS_TRACE_IDS);
    expect(ALL_REQUIREMENTS).toHaveLength(6);
  });
});
