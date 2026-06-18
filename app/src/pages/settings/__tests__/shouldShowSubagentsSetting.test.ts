import { describe, expect, it } from "vitest";

import { shouldShowSubagentsSetting } from "../agentSettingsUtils";

describe("shouldShowSubagentsSetting", () => {
  it("shows the subagents setting when server-side bash is not disabled", () => {
    expect(shouldShowSubagentsSetting(false)).toBe(true);
  });

  it("hides the subagents setting when PHOENIX_AGENTS_DISABLE_BASH is set", () => {
    // The server-side bash tool is reachable only through subagents, so the
    // deployment kill switch hides the toggle that would attach them.
    expect(shouldShowSubagentsSetting(true)).toBe(false);
  });
});
