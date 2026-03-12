import { describe, expect, it } from "vitest";

import {
  featureLabel,
  ensureServerFeature,
  GET_SESSION,
  DELETE_SESSION,
  DELETE_SESSIONS,
  LIST_PROJECT_SESSIONS,
  ANNOTATE_SESSIONS,
  GET_SPANS_TRACE_IDS,
  ALL_REQUIREMENTS,
} from "../../src/utils/serverVersionUtils";
import type {
  RouteRequirement,
  ParameterRequirement,
} from "../../src/utils/serverVersionUtils";

describe("featureLabel", () => {
  it("derives label for a route requirement", () => {
    expect(featureLabel(GET_SESSION)).toBe(
      "The GET /v1/sessions/{session_id} route"
    );
  });

  it("derives label for a parameter requirement", () => {
    expect(featureLabel(GET_SPANS_TRACE_IDS)).toBe(
      "The 'trace_ids' query parameter on GET /v1/projects/{id}/spans"
    );
  });

  it("uses description override when provided", () => {
    const req: RouteRequirement = {
      kind: "route",
      method: "GET",
      path: "/v1/foo",
      minVersion: [1, 0, 0],
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
      minVersion: [1, 0, 0],
      description: "Custom param description",
    };
    expect(featureLabel(req)).toBe("Custom param description");
  });
});

describe("ensureServerFeature", () => {
  it("does not throw when server version meets requirement", async () => {
    const guard = ensureServerFeature(GET_SESSION);
    const mockClient = {
      serverVersion: [13, 14, 0] as [number, number, number],
      supportsServerVersion: async () => true,
    };
    await expect(
      guard({ client: mockClient as never })
    ).resolves.toBeUndefined();
  });

  it("throws when server version is below requirement", async () => {
    const guard = ensureServerFeature(GET_SESSION);
    const mockClient = {
      serverVersion: [13, 13, 0] as [number, number, number],
      supportsServerVersion: async () => false,
    };
    await expect(guard({ client: mockClient as never })).rejects.toThrow(
      /requires Phoenix server >= 13\.14\.0/
    );
  });

  it("includes feature label in error message for route", async () => {
    const guard = ensureServerFeature(DELETE_SESSION);
    const mockClient = {
      serverVersion: [12, 0, 0] as [number, number, number],
      supportsServerVersion: async () => false,
    };
    await expect(guard({ client: mockClient as never })).rejects.toThrow(
      /The DELETE \/v1\/sessions\/\{session_id\} route/
    );
  });

  it("includes feature label in error message for parameter", async () => {
    const guard = ensureServerFeature(GET_SPANS_TRACE_IDS);
    const mockClient = {
      serverVersion: [12, 0, 0] as [number, number, number],
      supportsServerVersion: async () => false,
    };
    await expect(guard({ client: mockClient as never })).rejects.toThrow(
      /The 'trace_ids' query parameter/
    );
  });

  it("falls back to supportsServerVersion when serverVersion is undefined", async () => {
    const guard = ensureServerFeature(GET_SESSION);
    const mockClient = {
      serverVersion: undefined,
      supportsServerVersion: async () => true,
    };
    await expect(
      guard({ client: mockClient as never })
    ).resolves.toBeUndefined();
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
