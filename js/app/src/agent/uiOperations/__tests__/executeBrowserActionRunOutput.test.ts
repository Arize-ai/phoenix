import { describe, expect, it } from "vitest";

import {
  parseExecuteBrowserActionRunOutput,
  renderRunOutput,
} from "../executeBrowserActionTool";

const noCalls = { callCount: 0, calls: [], logs: [] };

describe("renderRunOutput return-value truncation", () => {
  it("passes small return values through untouched", () => {
    const output = renderRunOutput({
      ...noCalls,
      returnValue: '{"ok": true}',
    });
    expect(output).toContain('{"ok": true}');
    expect(output).not.toContain("truncated");
  });

  it("preserves sibling results when one array in a batch is oversized", () => {
    // The field-report failure mode: a 176-model list truncated from the
    // middle of the serialized string, destroying the unrelated result
    // serialized after it.
    const returnValue = JSON.stringify(
      {
        models: Array.from({ length: 500 }, (_, i) => ({
          target: { type: "builtin", provider: "OPENAI", modelName: `m-${i}` },
        })),
        promptRead: { instanceId: 9, revision: "prompt-abc", label: "A" },
      },
      null,
      2
    );
    const output = renderRunOutput({ ...noCalls, returnValue });
    const parsed = parseExecuteBrowserActionRunOutput(output);
    expect(parsed).not.toBeNull();
    const value = JSON.parse(parsed!.returnValue);
    // Every top-level key survives, and the sibling result is intact.
    expect(Object.keys(value)).toEqual(["models", "promptRead"]);
    expect(value.promptRead).toEqual({
      instanceId: 9,
      revision: "prompt-abc",
      label: "A",
    });
    // The oversized array kept leading items and a counted marker.
    expect(value.models.at(-1)).toMatch(/more items omitted/);
    // The note says what was dropped and where.
    expect(parsed!.note).toContain("$.models");
  });

  it("falls back to blind truncation for non-JSON return values", () => {
    const output = renderRunOutput({
      ...noCalls,
      returnValue: "x".repeat(10_000),
    });
    expect(output).toContain("…[truncated");
  });
});

describe("renderRunOutput call telemetry", () => {
  it("renders one line per call and round-trips through the parser", () => {
    const output = renderRunOutput({
      returnValue: '"done"',
      callCount: 2,
      calls: [
        {
          operation: "playground.prompt.read",
          ok: true,
          durationMs: 12,
          outputChars: 842,
        },
        {
          operation: "playground.prompt.edit",
          ok: false,
          durationMs: 3,
          outputChars: 120,
        },
      ],
      logs: ["probing"],
    });
    const parsed = parseExecuteBrowserActionRunOutput(output);
    expect(parsed).not.toBeNull();
    expect(parsed!.status).toBe("Script completed after 2 ui calls.");
    expect(parsed!.calls).toBe(
      [
        "1. playground.prompt.read ok 12ms 842ch",
        "2. playground.prompt.edit FAILED 3ms 120ch",
      ].join("\n")
    );
    expect(parsed!.logs).toBe("probing");
    expect(parsed!.returnValue).toBe('"done"');
    expect(parsed!.note).toBeNull();
  });
});
