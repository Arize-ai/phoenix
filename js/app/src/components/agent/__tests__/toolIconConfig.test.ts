import { describe, expect, it } from "vitest";

import { getToolIconKey, TOOL_ICON_BY_CATEGORY } from "../toolIconConfig";

describe("PXI tool icon configuration", () => {
  it.each([
    ["ask_user", "MessagesSquare"],
    ["bash", "Console"],
    ["create_dataset", "Database"],
    ["query_docs_filesystem_phoenix", "Search"],
    ["search_phoenix", "Search"],
    ["web_search", "Globe"],
    ["web_fetch", "Globe"],
    ["run_playground", "Play"],
    ["cancel_playground_run", "Play"],
    ["load_skill", "GraduationCap"],
    ["load_skill_reference", "GraduationCap"],
    ["set_spans_filter", "ListFilter"],
    ["call_subagent", "Subagent"],
    ["read_prompt_tools", "ScanText"],
    ["render_generative_ui", "BarChart"],
  ] as const)("maps %s to %s", (toolName, iconKey) => {
    expect(getToolIconKey({ toolName })).toBe(iconKey);
  });

  it("uses the wrench for unknown tools", () => {
    expect(getToolIconKey({ toolName: "future_tool_without_a_category" })).toBe(
      "Wrench"
    );
  });

  it("assigns a distinct configured icon to every category", () => {
    const iconKeys = Object.values(TOOL_ICON_BY_CATEGORY);
    expect(new Set(iconKeys).size).toBe(iconKeys.length);
  });
});
