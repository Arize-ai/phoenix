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
  it("derives project, trace, and selected span contexts in order", () => {
    const contexts = deriveRouteContexts(
      [match({ projectId: "P1" }), match({ traceId: "T1" })],
      new URLSearchParams(`${SELECTED_SPAN_NODE_ID_PARAM}=S1`)
    );

    expect(contexts).toEqual([
      { type: "project", projectNodeId: "P1" },
      { type: "trace", projectNodeId: "P1", otelTraceId: "T1" },
      { type: "span", projectNodeId: "P1", spanNodeId: "S1" },
    ]);
  });

  it("prefers the selected span search param over the route span id", () => {
    const contexts = deriveRouteContexts(
      [match({ projectId: "P1" }), match({ spanId: "route-span" })],
      new URLSearchParams(`${SELECTED_SPAN_NODE_ID_PARAM}=selected-span`)
    );

    expect(contexts).toEqual([
      { type: "project", projectNodeId: "P1" },
      { type: "span", projectNodeId: "P1", spanNodeId: "selected-span" },
    ]);
  });

  it("falls back to the route span id (OTel hex) when no selected span param exists", () => {
    const contexts = deriveRouteContexts(
      [match({ projectId: "P1" }), match({ spanId: "S1" })],
      new URLSearchParams()
    );

    expect(contexts).toEqual([
      { type: "project", projectNodeId: "P1" },
      { type: "span", projectNodeId: "P1", otelSpanId: "S1" },
    ]);
  });

  it("supports selected span context outside a project route", () => {
    const contexts = deriveRouteContexts(
      [],
      new URLSearchParams(`${SELECTED_SPAN_NODE_ID_PARAM}=S1`)
    );

    expect(contexts).toEqual([{ type: "span", spanNodeId: "S1" }]);
  });
});
