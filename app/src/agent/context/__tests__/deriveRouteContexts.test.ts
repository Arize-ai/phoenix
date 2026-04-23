import type { UIMatch } from "react-router";

import { deriveRouteContexts } from "../deriveRouteContexts";

function match(
  id: string,
  params: Record<string, string | undefined>
): UIMatch {
  return {
    id,
    pathname: "",
    params,
    data: undefined,
    handle: undefined,
  } as unknown as UIMatch;
}

describe("deriveRouteContexts", () => {
  it("returns empty for routes with no relevant params", () => {
    const result = deriveRouteContexts(
      [match("settings", {})],
      new URLSearchParams()
    );
    expect(result).toEqual([]);
  });

  it("derives project-only context", () => {
    const result = deriveRouteContexts(
      [match("project", { projectId: "P1" })],
      new URLSearchParams()
    );
    expect(result).toEqual([{ type: "project", projectId: "P1" }]);
  });

  it("derives project + trace for a trace route", () => {
    const result = deriveRouteContexts(
      [
        match("project", { projectId: "P1" }),
        match("trace", { traceId: "T1" }),
      ],
      new URLSearchParams()
    );
    expect(result).toEqual([
      { type: "project", projectId: "P1" },
      { type: "trace", projectId: "P1", traceId: "T1" },
    ]);
  });

  it("derives span context from selectedSpanNodeId search param", () => {
    const result = deriveRouteContexts(
      [
        match("project", { projectId: "P1" }),
        match("trace", { traceId: "T1" }),
      ],
      new URLSearchParams("selectedSpanNodeId=S1")
    );
    expect(result).toContainEqual({
      type: "span",
      projectId: "P1",
      spanId: "S1",
    });
  });

  it("derives standalone span context from playground route", () => {
    const result = deriveRouteContexts(
      [match("playground-span", { spanId: "S2" })],
      new URLSearchParams()
    );
    expect(result).toEqual([{ type: "span", spanId: "S2" }]);
  });
});
