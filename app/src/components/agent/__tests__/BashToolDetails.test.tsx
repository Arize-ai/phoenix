import { describe, expect, it } from "vitest";

import { getBashToolPreview } from "../BashToolDetails";
import type { ToolInvocationPart } from "../toolPartTypes";

function createBashPart(
  overrides: Partial<ToolInvocationPart> = {}
): ToolInvocationPart {
  return {
    type: "tool-bash",
    toolCallId: "tool-call-1",
    state: "input-streaming",
    input: {},
    output: undefined,
    errorText: undefined,
    ...overrides,
  } as ToolInvocationPart;
}

describe("getBashToolPreview", () => {
  it("shows the summary while it is still streaming, before the command arrives", () => {
    // The model emits `summary` before `command`, so mid-stream the parsed
    // input has a summary but no command yet. The preview must surface the
    // summary rather than the partial-JSON "{".
    const part = createBashPart({
      state: "input-streaming",
      input: { summary: "Listing your traces" },
    });

    expect(getBashToolPreview(part)).toBe("Listing your traces");
  });

  it("prefers the summary once the full input is available", () => {
    const part = createBashPart({
      state: "input-available",
      input: { command: "ls -la /phoenix", summary: "Listing your traces" },
    });

    expect(getBashToolPreview(part)).toBe("Listing your traces");
  });
});
