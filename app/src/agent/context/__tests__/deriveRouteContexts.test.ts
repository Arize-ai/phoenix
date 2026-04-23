import type { UIMatch } from "react-router";
import { describe, expect, it } from "vitest";

import { SELECTED_SPAN_NODE_ID_PARAM } from "@phoenix/constants/searchParams";

import { deriveRouteContexts } from "../deriveRouteContexts";

function match(params: Record<string, string>): UIMatch {
  return {
    id: "test",
    params,
  } as unknown as UIMatch;
}

describe("deriveRouteContexts", () => {
  it("derives project, trace, and selected span contexts", () => {
    const contexts = deriveRouteContexts(
      [match({ projectId: "P1" }), match({ traceId: "T1" })],
      new URLSearchParams(`${SELECTED_SPAN_NODE_ID_PARAM}=S1`)
    );

    expect(contexts).toEqual([
      { type: "project", projectId: "P1" },
      { type: "trace", projectId: "P1", traceId: "T1" },
      { type: "span", projectId: "P1", spanId: "S1" },
    ]);
  });

  it("falls back to the route span id when no selected span param exists", () => {
    const contexts = deriveRouteContexts(
      [match({ projectId: "P1" }), match({ spanId: "S1" })],
      new URLSearchParams()
    );

    expect(contexts).toEqual([
      { type: "project", projectId: "P1" },
      { type: "span", spanId: "S1" },
    ]);
  });
});
