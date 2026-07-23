import { describe, expect, it } from "vitest";

import {
  getToolIconKey,
  SKILL_ICON_BY_NAME,
  TOOL_ICON_BY_CATEGORY,
} from "../toolIconConfig";

describe("PXI tool icon configuration", () => {
  it.each([
    ["ask_user", "MessagesSquare"],
    ["bash", "Console"],
    ["create_dataset", "Database"],
    ["query_docs_filesystem_phoenix", "Search"],
    ["search_phoenix", "Search"],
    ["run_playground", "Play"],
    ["cancel_playground_run", "Play"],
    ["load_skill", "GraduationCap"],
    ["set_spans_filter", "ListFilter"],
    ["call_subagent", "Subagent"],
    ["read_prompt_tools", "ScanText"],
    ["render_generative_ui", "BarChart"],
  ] as const)("maps %s to %s", (toolName, iconKey) => {
    expect(getToolIconKey({ toolName })).toBe(iconKey);
  });

  it("uses the play icon when loading the playground skill", () => {
    expect(
      getToolIconKey({
        toolName: "load_skill",
        input: { skill_name: "playground" },
      })
    ).toBe("Play");
  });

  it.each(Object.entries(SKILL_ICON_BY_NAME))(
    "maps the %s skill to %s",
    (skillName, iconKey) => {
      expect(
        getToolIconKey({
          toolName: "load_skill",
          input: { skill_name: skillName },
        })
      ).toBe(iconKey);
      expect(
        getToolIconKey({
          toolName: "read_skill_resource",
          input: { skill_name: skillName },
        })
      ).toBe(iconKey);
    }
  );

  it("uses the generic skill icon for an unknown skill", () => {
    expect(
      getToolIconKey({
        toolName: "load_skill",
        input: { skill_name: "future-skill" },
      })
    ).toBe("GraduationCap");
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
