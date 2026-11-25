import { describe, expect, it } from "vitest";

import { getRoutePattern } from "../routePattern";

describe("getRoutePattern", () => {
  it("joins nested relative paths into a pattern", () => {
    expect(
      getRoutePattern({
        matches: [
          { route: { path: "/" } },
          { route: {} },
          { route: { path: "projects" } },
          { route: { path: ":projectId" } },
          { route: { path: "traces/:traceId" } },
        ],
      })
    ).toBe("/projects/:projectId/traces/:traceId");
  });

  it("restarts from an absolute child path", () => {
    expect(
      getRoutePattern({
        matches: [
          { route: { path: "/settings" } },
          { route: { path: "/settings/general" } },
        ],
      })
    ).toBe("/settings/general");
  });

  it("returns the root for pathless matches", () => {
    expect(getRoutePattern({ matches: [{ route: {} }] })).toBe("/");
    expect(getRoutePattern({ matches: [] })).toBe("/");
  });

  it("drops a trailing slash", () => {
    expect(
      getRoutePattern({ matches: [{ route: { path: "datasets/" } }] })
    ).toBe("/datasets");
  });
});
