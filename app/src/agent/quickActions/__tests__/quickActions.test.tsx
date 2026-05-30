import { describe, expect, it } from "vitest";

import { DEFAULT_QUICK_ACTIONS } from "@phoenix/components/agent/ChatEmptyState";

import { buildAgentQuickActions } from "../quickActions";

const labels = (actions: ReturnType<typeof buildAgentQuickActions>) =>
  actions.map((action) => action.label);

describe("buildAgentQuickActions", () => {
  it("falls back to the generic defaults when no actionable context is active", () => {
    expect(buildAgentQuickActions([])).toBe(DEFAULT_QUICK_ACTIONS);
    // app/graphql/web_access are request-only metadata and contribute nothing.
    expect(buildAgentQuickActions(["app", "graphql", "web_access"])).toBe(
      DEFAULT_QUICK_ACTIONS
    );
  });

  it("surfaces playground-specific actions on the playground", () => {
    expect(labels(buildAgentQuickActions(["playground", "app"]))).toEqual([
      "Enhance the prompt",
      "Run the playground",
      "Fill in variables",
    ]);
  });

  it("orders the most specific context's actions first", () => {
    const actions = labels(
      buildAgentQuickActions(["project", "trace", "span"])
    );
    // span (most specific) leads, then trace, then project.
    expect(actions[0]).toBe("Explain this span");
    expect(actions).toContain("Explain this trace");
  });

  it("caps the number of actions and dedupes shared labels", () => {
    const actions = buildAgentQuickActions(["project", "trace", "span"]);
    expect(actions.length).toBeLessThanOrEqual(3);
    expect(new Set(labels(actions)).size).toBe(actions.length);
  });
});
