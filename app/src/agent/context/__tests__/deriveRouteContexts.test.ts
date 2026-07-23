import type { UIMatch } from "react-router";
import { describe, expect, it } from "vitest";

import {
  SELECTED_SPAN_NODE_ID_PARAM,
  SELECTED_TRACE_ID_PARAM,
} from "@phoenix/constants/searchParams";

import { deriveRouteContexts } from "../deriveRouteContexts";

function match(params: Record<string, string>): UIMatch {
  return {
    id: "test",
    pathname: "/",
    params,
    loaderData: undefined,
    handle: undefined,
  };
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

  it("falls back to the route span node id when no selected span param exists", () => {
    const contexts = deriveRouteContexts(
      [match({ projectId: "P1" }), match({ spanId: "S1" })],
      new URLSearchParams()
    );

    expect(contexts).toEqual([
      { type: "project", projectNodeId: "P1" },
      { type: "span", projectNodeId: "P1", spanNodeId: "S1" },
    ]);
  });

  it("supports selected span context outside a project route", () => {
    const contexts = deriveRouteContexts(
      [],
      new URLSearchParams(`${SELECTED_SPAN_NODE_ID_PARAM}=S1`)
    );

    expect(contexts).toEqual([{ type: "span", spanNodeId: "S1" }]);
  });

  it("derives session context from a project session route", () => {
    const contexts = deriveRouteContexts(
      [match({ projectId: "P1" }), match({ sessionId: "SESSION1" })],
      new URLSearchParams()
    );

    expect(contexts).toEqual([
      { type: "project", projectNodeId: "P1" },
      { type: "session", projectNodeId: "P1", sessionNodeId: "SESSION1" },
    ]);
  });

  it("derives selected trace and span contexts on a project session route", () => {
    const contexts = deriveRouteContexts(
      [match({ projectId: "P1" }), match({ sessionId: "SESSION1" })],
      new URLSearchParams(
        `${SELECTED_TRACE_ID_PARAM}=TRACE1&${SELECTED_SPAN_NODE_ID_PARAM}=SPAN1`
      )
    );

    expect(contexts).toEqual([
      { type: "project", projectNodeId: "P1" },
      { type: "trace", projectNodeId: "P1", otelTraceId: "TRACE1" },
      { type: "session", projectNodeId: "P1", sessionNodeId: "SESSION1" },
      { type: "span", projectNodeId: "P1", spanNodeId: "SPAN1" },
    ]);
  });

  it("derives prompt context from a prompt route", () => {
    const contexts = deriveRouteContexts(
      [match({ promptId: "PROMPT1" })],
      new URLSearchParams()
    );

    expect(contexts).toEqual([{ type: "prompt", promptNodeId: "PROMPT1" }]);
  });

  it("derives prompt and prompt version contexts from a prompt version route", () => {
    const contexts = deriveRouteContexts(
      [match({ promptId: "PROMPT1" }), match({ versionId: "VERSION1" })],
      new URLSearchParams()
    );

    expect(contexts).toEqual([
      { type: "prompt", promptNodeId: "PROMPT1" },
      {
        type: "prompt_version",
        promptNodeId: "PROMPT1",
        promptVersionNodeId: "VERSION1",
      },
    ]);
  });
});
