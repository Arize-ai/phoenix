import { describe, expect, it } from "vitest";

import type { AgentState } from "@phoenix/store/agentStore";

import { selectActiveContexts } from "../selectors";

describe("selectActiveContexts", () => {
  it("keeps route contexts first and appends mounted contexts", () => {
    const state = {
      routeContexts: [{ type: "project", projectId: "P1" }],
      mountedContexts: {
        filter: {
          type: "span_filter",
          projectId: "P1",
          condition: "status_code == 'ERROR'",
        },
      },
    } as unknown as AgentState;

    expect(selectActiveContexts(state)).toEqual([
      { type: "project", projectId: "P1" },
      {
        type: "span_filter",
        projectId: "P1",
        condition: "status_code == 'ERROR'",
      },
    ]);
  });

  it("dedupes identical logical contexts across route and mounted sources", () => {
    const state = {
      routeContexts: [{ type: "project", projectId: "P1" }],
      mountedContexts: {
        project: { type: "project", projectId: "P1" },
      },
    } as unknown as AgentState;

    expect(selectActiveContexts(state)).toEqual([
      { type: "project", projectId: "P1" },
    ]);
  });
});
